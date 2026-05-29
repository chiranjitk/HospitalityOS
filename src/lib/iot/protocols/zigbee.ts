/**
 * StaySuite-HospitalityOS — IoT Protocol: Zigbee Integration
 *
 * Simulated Zigbee protocol manager for hotel IoT device communication.
 * Maintains in-memory state for network topology, paired devices, coordinator
 * state, and simulated command execution with realistic delays.
 *
 * To upgrade to a real Zigbee integration:
 * 1. Deploy a Zigbee coordinator (e.g., Zigbee2MQTT bridge, Home Assistant ZHA).
 * 2. Expose a REST API or direct serial interface to the coordinator.
 * 3. Register Zigbee devices and bind them to the coordinator network.
 * 4. Implement ZCL (Zigbee Cluster Library) command parsing for device control.
 * 5. Handle Zigbee network discovery, pairing, and OTA firmware updates.
 */

// --- Type Definitions ---

export interface ZigbeeCoordinatorConfig {
  coordinatorUrl?: string; // URL of Zigbee2MQTT or similar bridge
  serialPort?: string;   // Direct serial port for USB dongle
  baudRate?: number;     // Default: 115200
  networkKey?: string;   // 16-byte network key (hex)
}

export interface ZigbeeDevice {
  ieeeAddress: string;  // 64-bit IEEE address
  networkAddress: number;
  endpointId: number;
  manufacturerId: string;
  modelId?: string;
  clusters: string[];   // ZCL cluster IDs
}

export interface ZigbeeCommand {
  ieeeAddress: string;
  endpointId: number;
  clusterId: string;
  commandId: string;
  payload: Record<string, unknown>;
}

// --- Utility Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16).padStart(2, '0')).join('');
}

// --- Simulated Zigbee Device Catalog ---

interface DeviceTemplate {
  manufacturerId: string;
  modelId: string;
  clusters: string[];
  deviceType: string;
}

const DEVICE_TEMPLATES: DeviceTemplate[] = [
  {
    manufacturerId: '0x1102', // Philips Hue
    modelId: 'LCT001',
    clusters: ['0x0000', '0x0003', '0x0004', '0x0006', '0x0008', '0x0300'],
    deviceType: 'smart_bulb',
  },
  {
    manufacturerId: '0x104E', // Centralite
    modelId: '3305-S',
    clusters: ['0x0000', '0x0001', '0x0003', '0x0402', '0x0405'],
    deviceType: 'motion_sensor',
  },
  {
    manufacturerId: '0x104E', // Centralite
    modelId: '3205-S',
    clusters: ['0x0000', '0x0001', '0x0003', '0x0402', '0x0406'],
    deviceType: 'contact_sensor',
  },
  {
    manufacturerId: '0x015F', // ikea
    modelId: 'TRADFRI on/off switch',
    clusters: ['0x0000', '0x0003', '0x0006', '0xFC00'],
    deviceType: 'on_off_switch',
  },
  {
    manufacturerId: '0x0046', // Kwikset
    modelId: 'SMARTCODE_10',
    clusters: ['0x0000', '0x0001', '0x0003', '0x0101'],
    deviceType: 'door_lock',
  },
  {
    manufacturerId: '0x015F', // IKEA
    modelId: 'TRADFRI remote control',
    clusters: ['0x0000', '0x0001', '0x0003', '0x0008', '0x0300', '0x0B05'],
    deviceType: 'remote_control',
  },
  {
    manufacturerId: '0x115F', // Third Reality
    modelId: '3RSS008Z',
    clusters: ['0x0000', '0x0001', '0x0003', '0x042E', '0x0406'],
    deviceType: 'temperature_humidity',
  },
  {
    manufacturerId: '0x100B', // Philips
    modelId: 'SML001',
    clusters: ['0x0000', '0x0003', '0x0004', '0x0006', '0x0008', '0x0300', '0x0406'],
    deviceType: 'motion_sensor_light',
  },
];

// --- Network Topology Types ---

type DeviceRole = 'coordinator' | 'router' | 'end_device';

interface NetworkNode {
  ieeeAddress: string;
  networkAddress: number;
  role: DeviceRole;
  parentId?: string; // IEEE address of parent in mesh
  children: string[]; // IEEE addresses of children
  lqi: number; // Link quality (0-255)
  pairedAt: string;
  template?: DeviceTemplate;
}

// --- ZigbeeCoordinatorState Class ---

class ZigbeeCoordinatorState {
  private networkNodes: Map<string, NetworkNode> = new Map();
  private initialized: boolean = false;
  private pairingMode: boolean = false;
  private pairingTimer: ReturnType<typeof setTimeout> | null = null;
  private networkPanId: number = 0;
  private networkChannel: number = 0;
  private networkKey: string = '';
  private commandHistory: Array<{
    ieeeAddress: string;
    clusterId: string;
    commandId: string;
    status: 'sent' | 'acknowledged' | 'failed';
    sentAt: string;
    respondedAt?: string;
    responseTimeMs?: number;
  }> = [];

  private coordinatorIeee: string = '';

  private getNextNetworkAddress(): number {
    const used = new Set(Array.from(this.networkNodes.values()).map((n) => n.networkAddress));
    let addr = 0x0001;
    while (used.has(addr)) addr++;
    return addr;
  }

  initialize(config: ZigbeeCoordinatorConfig): void {
    if (this.initialized) return;

    this.networkPanId = 0x1A2B;
    this.networkChannel = 15; // Channel 15 is common for hotel deployments
    this.networkKey = config.networkKey || randomHex(16).toUpperCase();

    // Create coordinator node
    this.coordinatorIeee = `0x00124B00${randomHex(8).toUpperCase()}`;
    const coordinator: NetworkNode = {
      ieeeAddress: this.coordinatorIeee,
      networkAddress: 0x0000,
      role: 'coordinator',
      children: [],
      lqi: 255,
      pairedAt: new Date().toISOString(),
    };
    this.networkNodes.set(this.coordinatorIeee, coordinator);

    // Seed some initial devices (simulating pre-paired hotel devices)
    this.seedInitialDevices();

    this.initialized = true;
  }

  private seedInitialDevices(): void {
    const initialDevices = [
      { templateIdx: 0, room: '101' },  // Smart bulb
      { templateIdx: 0, room: '101' },  // Smart bulb (2nd)
      { templateIdx: 1, room: '101' },  // Motion sensor
      { templateIdx: 3, room: '101' },  // On/off switch
      { templateIdx: 6, room: '101' },  // Temperature/humidity sensor
      { templateIdx: 0, room: '202' },  // Smart bulb
      { templateIdx: 1, room: '202' },  // Motion sensor
      { templateIdx: 3, room: '202' },  // On/off switch
      { templateIdx: 4, room: '202' },  // Door lock
      { templateIdx: 6, room: '202' },  // Temperature/humidity sensor
      { templateIdx: 0, room: '305' },  // Smart bulb
      { templateIdx: 0, room: '305' },  // Smart bulb (2nd)
      { templateIdx: 1, room: '305' },  // Motion sensor
      { templateIdx: 3, room: '305' },  // On/off switch
      { templateIdx: 4, room: '305' },  // Door lock
    ];

    // Create router nodes to simulate mesh topology
    const routerCount = 2;
    for (let i = 0; i < routerCount; i++) {
      const routerIeee = `0x${randomHex(16).toUpperCase()}`;
      const router: NetworkNode = {
        ieeeAddress: routerIeee,
        networkAddress: this.getNextNetworkAddress(),
        role: 'router',
        parentId: this.coordinatorIeee,
        children: [],
        lqi: 200 + Math.floor(Math.random() * 55),
        pairedAt: new Date(Date.now() - Math.random() * 86400000 * 90).toISOString(),
      };
      this.networkNodes.set(routerIeee, router);
      // Register router as child of coordinator
      const coord = this.networkNodes.get(this.coordinatorIeee)!;
      coord.children.push(routerIeee);
    }

    const routers = Array.from(this.networkNodes.values()).filter((n) => n.role === 'router');

    for (const { templateIdx } of initialDevices) {
      const template = DEVICE_TEMPLATES[templateIdx];
      const ieeeAddress = `0x${randomHex(16).toUpperCase()}`;
      const parent = routers[Math.floor(Math.random() * routers.length)];
      const node: NetworkNode = {
        ieeeAddress,
        networkAddress: this.getNextNetworkAddress(),
        role: 'end_device',
        parentId: parent.ieeeAddress,
        children: [],
        lqi: 100 + Math.floor(Math.random() * 155),
        pairedAt: new Date(Date.now() - Math.random() * 86400000 * 90).toISOString(),
        template,
      };
      this.networkNodes.set(ieeeAddress, node);
      parent.children.push(ieeeAddress);
    }
  }

  getDevices(): ZigbeeDevice[] {
    return Array.from(this.networkNodes.values())
      .filter((n) => n.role !== 'coordinator' && n.template)
      .map((n) => ({
        ieeeAddress: n.ieeeAddress,
        networkAddress: n.networkAddress,
        endpointId: 1,
        manufacturerId: n.template!.manufacturerId,
        modelId: n.template!.modelId,
        clusters: n.template!.clusters,
      }));
  }

  async executeCommand(command: ZigbeeCommand): Promise<{ success: boolean; message: string }> {
    const device = this.networkNodes.get(command.ieeeAddress);
    if (!device || !device.template) {
      return {
        success: false,
        message: `Device "${command.ieeeAddress}" not found in Zigbee network.`,
      };
    }

    // Validate cluster
    if (!device.template.clusters.includes(command.clusterId)) {
      return {
        success: false,
        message: `Cluster "${command.clusterId}" not supported by device "${command.ieeeAddress}". Supported clusters: ${device.template.clusters.join(', ')}.`,
      };
    }

    // Simulate command transmission delay (Zigbee is ~100ms typical)
    const hops = device.role === 'end_device' ? 2 : 1;
    const transmitDelay = 100 + hops * 50 + Math.random() * 100;

    await delay(transmitDelay);

    // Simulate small failure rate (5%)
    const failed = Math.random() < 0.05;

    const record = {
      ieeeAddress: command.ieeeAddress,
      clusterId: command.clusterId,
      commandId: command.commandId,
      status: (failed ? 'failed' as const : 'acknowledged' as const),
      sentAt: new Date(Date.now() - transmitDelay).toISOString(),
      respondedAt: new Date().toISOString(),
      responseTimeMs: Math.round(transmitDelay),
    };

    this.commandHistory.push(record);
    if (this.commandHistory.length > 500) {
      this.commandHistory = this.commandHistory.slice(-500);
    }

    if (failed) {
      return {
        success: false,
        message: `Command "${command.commandId}" sent to cluster "${command.clusterId}" on device "${command.ieeeAddress}" but no acknowledgment received. Retransmission may be needed.`,
      };
    }

    return {
      success: true,
      message: `Command "${command.commandId}" executed on cluster "${command.clusterId}" of device "${command.ieeeAddress}" (${device.template.modelId}). Response time: ${record.responseTimeMs}ms.`,
    };
  }

  async pairDevice(installCode?: string): Promise<{ success: boolean; message: string; device?: ZigbeeDevice }> {
    if (!this.pairingMode) {
      return {
        success: false,
        message: 'Zigbee coordinator is not in pairing mode. Start pairing first by calling pairDevice(). The coordinator will enter pairing mode automatically.',
      };
    }

    // Simulate device discovery and pairing (2-5 seconds)
    const pairingDuration = 2000 + Math.random() * 3000;
    await delay(pairingDuration);

    // Pick a random device template
    const template = DEVICE_TEMPLATES[Math.floor(Math.random() * DEVICE_TEMPLATES.length)];
    const ieeeAddress = `0x${randomHex(16).toUpperCase()}`;

    // Find a parent (prefer routers, fallback to coordinator)
    const routers = Array.from(this.networkNodes.values()).filter((n) => n.role === 'router');
    const parent = routers.length > 0 ? routers[Math.floor(Math.random() * routers.length)] : this.networkNodes.get(this.coordinatorIeee)!;

    const node: NetworkNode = {
      ieeeAddress,
      networkAddress: this.getNextNetworkAddress(),
      role: 'end_device',
      parentId: parent.ieeeAddress,
      children: [],
      lqi: 100 + Math.floor(Math.random() * 155),
      pairedAt: new Date().toISOString(),
      template,
    };

    this.networkNodes.set(ieeeAddress, node);
    parent.children.push(ieeeAddress);

    const device: ZigbeeDevice = {
      ieeeAddress,
      networkAddress: node.networkAddress,
      endpointId: 1,
      manufacturerId: template.manufacturerId,
      modelId: template.modelId,
      clusters: template.clusters,
    };

    return {
      success: true,
      message: `Device paired successfully: ${template.modelId} (${template.deviceType}). IEEE: ${ieeeAddress}, Network Address: 0x${node.networkAddress.toString(16).padStart(4, '0')}, Parent: ${parent.ieeeAddress}.${installCode ? ' Install code used for secure pairing.' : ''}`,
      device,
    };
  }

  startPairing(durationMs: number = 60000): { success: boolean; message: string } {
    if (this.pairingMode) {
      return {
        success: true,
        message: `Coordinator is already in pairing mode. Timer will reset to ${durationMs / 1000}s.`,
      };
    }

    this.pairingMode = true;

    if (this.pairingTimer) clearTimeout(this.pairingTimer);
    this.pairingTimer = setTimeout(() => {
      this.pairingMode = false;
      this.pairingTimer = null;
    }, durationMs);

    return {
      success: true,
      message: `Zigbee coordinator entered pairing mode for ${durationMs / 1000}s. Network PAN: 0x${this.networkPanId.toString(16).toUpperCase()}, Channel: ${this.networkChannel}.`,
    };
  }

  stopPairing(): void {
    this.pairingMode = false;
    if (this.pairingTimer) {
      clearTimeout(this.pairingTimer);
      this.pairingTimer = null;
    }
  }

  unpairDevice(ieeeAddress: string): { success: boolean; message: string } {
    const node = this.networkNodes.get(ieeeAddress);
    if (!node || node.role === 'coordinator') {
      return {
        success: false,
        message: `Device "${ieeeAddress}" not found or cannot be unpaired (coordinator cannot be removed).`,
      };
    }

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.networkNodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((c) => c !== ieeeAddress);
      }
    }

    // Remove children references
    for (const childIeee of node.children) {
      const child = this.networkNodes.get(childIeee);
      if (child) child.parentId = undefined;
    }

    this.networkNodes.delete(ieeeAddress);
    return {
      success: true,
      message: `Device "${ieeeAddress}" (${node.template?.modelId ?? 'unknown'}) unpaired from Zigbee network.`,
    };
  }

  getNetworkTopology(): {
    panId: string;
    channel: number;
    totalNodes: number;
    routers: number;
    endDevices: number;
    coordinator: { ieeeAddress: string; children: string[] };
  } {
    const nodes = Array.from(this.networkNodes.values());
    const coordinator = this.networkNodes.get(this.coordinatorIeee)!;
    return {
      panId: `0x${this.networkPanId.toString(16).toUpperCase()}`,
      channel: this.networkChannel,
      totalNodes: nodes.length,
      routers: nodes.filter((n) => n.role === 'router').length,
      endDevices: nodes.filter((n) => n.role === 'end_device').length,
      coordinator: { ieeeAddress: coordinator.ieeeAddress, children: coordinator.children },
    };
  }

  getCommandHistory() {
    return this.commandHistory.slice(-50);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// --- Global Singleton State ---

const coordinatorState = new ZigbeeCoordinatorState();

// --- Public API ---

export async function getNetworkDevices(config: ZigbeeCoordinatorConfig): Promise<ZigbeeDevice[]> {
  await delay(150 + Math.random() * 200);

  coordinatorState.initialize(config);

  return coordinatorState.getDevices();
}

export async function sendZigbeeCommand(command: ZigbeeCommand): Promise<{ success: boolean; message: string }> {
  if (!coordinatorState.isInitialized()) {
    return {
      success: false,
      message: 'Zigbee coordinator not initialized. Call getNetworkDevices() first to initialize.',
    };
  }

  return coordinatorState.executeCommand(command);
}

export async function pairDevice(ieeeAddress?: string, installCode?: string): Promise<{ success: boolean; message: string }> {
  if (!coordinatorState.isInitialized()) {
    return {
      success: false,
      message: 'Zigbee coordinator not initialized. Call getNetworkDevices() first to initialize.',
    };
  }

  // Start pairing mode if not already active (60-second window)
  const pairingResult = coordinatorState.startPairing(60000);

  // Then simulate the pairing process
  return coordinatorState.pairDevice(installCode);
}

/**
 * Get Zigbee network topology information.
 */
export async function getZigbeeNetworkTopology(config: ZigbeeCoordinatorConfig): Promise<{
  topology: ReturnType<typeof coordinatorState.getNetworkTopology>;
  commandHistory: ReturnType<typeof coordinatorState.getCommandHistory>;
}> {
  await delay(100);
  coordinatorState.initialize(config);
  return {
    topology: coordinatorState.getNetworkTopology(),
    commandHistory: coordinatorState.getCommandHistory(),
  };
}

/**
 * Remove a device from the Zigbee network.
 */
export async function unpairZigbeeDevice(ieeeAddress: string, _config?: ZigbeeCoordinatorConfig): Promise<{ success: boolean; message: string }> {
  await delay(100 + Math.random() * 100);
  if (!coordinatorState.isInitialized()) {
    return {
      success: false,
      message: 'Zigbee coordinator not initialized. Call getNetworkDevices() first to initialize.',
    };
  }
  return coordinatorState.unpairDevice(ieeeAddress);
}
