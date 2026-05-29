/**
 * StaySuite-HospitalityOS — IoT Protocol: Z-Wave Integration
 *
 * Simulated Z-Wave protocol manager for hotel IoT device communication.
 * Maintains in-memory state for mesh network topology, controller nodes,
 * inclusion/exclusion lifecycle, and simulated command class execution.
 *
 * To upgrade to a real Z-Wave integration:
 * 1. Deploy a Z-Wave controller (USB stick or Raspberry Pi + Z-Wave module).
 * 2. Install OpenZWave (ozwdaemon) or use the Z-Wave JS (openzwave) library.
 * 3. Configure the controller serial port or TCP connection.
 * 4. Enumerate Z-Wave nodes and query their capabilities.
 * 5. Implement Z-Wave command classes: Door Lock (0x62), Thermostat (0x44), etc.
 * 6. Handle Z-Wave inclusion/exclusion, association groups, and scene activation.
 */

// --- Type Definitions ---

export interface ZWaveControllerConfig {
  driverUrl?: string;       // e.g., 'tcp://127.0.0.1:2121' for OpenZWave
  serialPort?: string;       // e.g., '/dev/ttyACM0' for USB stick
  networkKey?: string;      // Z-Wave network key for secure inclusion
  pollingIntervalMs?: number; // Status polling interval (default: 30000)
}

export interface ZWaveNode {
  nodeId: number;
  deviceType?: string;
  manufacturerId?: string;
  productType?: string;
  name?: string;
  location?: string;
  supportedCommandClasses: string[];
  isListening: boolean;
  isFailed: boolean;
  isDead: boolean;
}

export interface ZWaveCommand {
  nodeId: number;
  commandClass: string;
  command: string;
  value?: unknown;
}

// --- Utility Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Z-Wave Device Catalog ---

interface ZWaveDeviceTemplate {
  deviceType: string;
  manufacturerId: string;
  productType: string;
  name: string;
  location: string;
  supportedCommandClasses: string[];
  isListening: boolean;
}

const ZWAVE_DEVICE_TEMPLATES: ZWaveDeviceTemplate[] = [
  {
    deviceType: 'Binary Power Switch',
    manufacturerId: '0x0115',
    productType: '0x0100',
    name: 'Wall Switch',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x25', '0x27', '0x2B', '0x2C', '0x70', '0x72', '0x86'],
    isListening: true,
  },
  {
    deviceType: 'Multilevel Switch',
    manufacturerId: '0x0086',
    productType: '0x0201',
    name: 'Dimmer Switch',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x26', '0x27', '0x2B', '0x2C', '0x70', '0x72', '0x86'],
    isListening: true,
  },
  {
    deviceType: 'Thermostat HVAC',
    manufacturerId: '0x014F',
    productType: '0x0402',
    name: 'Thermostat',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x22', '0x25', '0x27', '0x2B', '0x2C', '0x31', '0x42', '0x43', '0x44', '0x49', '0x55', '0x69', '0x70', '0x72', '0x86', '0xEF'],
    isListening: true,
  },
  {
    deviceType: 'Door Lock',
    manufacturerId: '0x0090',
    productType: '0x0001',
    name: 'Smart Lock',
    location: 'Entrance',
    supportedCommandClasses: ['0x20', '0x25', '0x27', '0x2B', '0x40', '0x62', '0x63', '0x63', '0x70', '0x72', '0x86', '0x98'],
    isListening: true,
  },
  {
    deviceType: 'Binary Sensor',
    manufacturerId: '0x0147',
    productType: '0x0201',
    name: 'Door/Window Sensor',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x30', '0x55', '0x70', '0x72', '0x84', '0x85', '0x86'],
    isListening: false,
  },
  {
    deviceType: 'Multilevel Sensor',
    manufacturerId: '0x0159',
    productType: '0x0100',
    name: 'Temperature Sensor',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x30', '0x31', '0x55', '0x70', '0x72', '0x84', '0x85', '0x86'],
    isListening: false,
  },
  {
    deviceType: 'Motion Sensor',
    manufacturerId: '0x010F',
    productType: '0x0802',
    name: 'Motion Sensor',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x30', '0x55', '0x70', '0x72', '0x84', '0x85', '0x86', '0xA1'],
    isListening: false,
  },
  {
    deviceType: 'Binary Power Switch',
    manufacturerId: '0x0115',
    productType: '0x0500',
    name: 'Plug-in Switch',
    location: 'Room',
    supportedCommandClasses: ['0x20', '0x25', '0x27', '0x2B', '0x2C', '0x32', '0x70', '0x72', '0x86'],
    isListening: true,
  },
];

// --- Z-Wave Mesh Network Types ---

interface MeshNode extends ZWaveNode {
  neighbors: number[];  // Neighbor node IDs (for mesh routing)
  routes: number[];      // Known routes through this node
  security: 'S0' | 'S2' | 'none' | 'unsupported';
  maxBaudRate: number;   // bps
  lastSeen: string;
  pairedAt: string;
}

// --- ZWaveControllerState Class ---

class ZWaveControllerState {
  private nodes: Map<number, MeshNode> = new Map();
  private controllerNodeId: number = 1;
  private initialized: boolean = false;
  private inclusionMode: boolean = false;
  private inclusionTimer: ReturnType<typeof setTimeout> | null = null;
  private homeId: string = '';
  private networkKey: string = '';
  private pollingIntervalMs: number = 30000;
  private commandHistory: Array<{
    nodeId: number;
    commandClass: string;
    command: string;
    status: 'completed' | 'failed' | 'timeout';
    sentAt: string;
    respondedAt?: string;
    responseTimeMs?: number;
  }> = [];

  private nextNodeId: number = 2;

  private getNextNodeId(): number {
    let id = this.nextNodeId;
    while (this.nodes.has(id)) id++;
    this.nextNodeId = id + 1;
    return id;
  }

  initialize(config: ZWaveControllerConfig): void {
    if (this.initialized) return;

    this.homeId = `0x${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase()}`;
    this.networkKey = config.networkKey || `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 30000;

    // Seed initial Z-Wave nodes (simulating pre-included hotel devices)
    this.seedInitialNodes();

    this.initialized = true;
  }

  private seedInitialNodes(): void {
    const initialDevices = [
      { templateIdx: 0, room: '101', label: 'Wall Switch - Main' },
      { templateIdx: 1, room: '101', label: 'Dimmer - Bedside' },
      { templateIdx: 2, room: '101', label: 'Thermostat' },
      { templateIdx: 3, room: '101', label: 'Smart Lock' },
      { templateIdx: 4, room: '101', label: 'Door Sensor' },
      { templateIdx: 6, room: '101', label: 'Motion Sensor' },
      { templateIdx: 0, room: '202', label: 'Wall Switch - Main' },
      { templateIdx: 1, room: '202', label: 'Dimmer - Bedside' },
      { templateIdx: 2, room: '202', label: 'Thermostat' },
      { templateIdx: 3, room: '202', label: 'Smart Lock' },
      { templateIdx: 4, room: '202', label: 'Door Sensor' },
      { templateIdx: 6, room: '202', label: 'Motion Sensor' },
      { templateIdx: 0, room: '305', label: 'Wall Switch - Main' },
      { templateIdx: 1, room: '305', label: 'Dimmer - Bedside' },
      { templateIdx: 2, room: '305', label: 'Thermostat' },
      { templateIdx: 3, room: '305', label: 'Smart Lock' },
      { templateIdx: 5, room: '305', label: 'Temperature Sensor' },
    ];

    const listeningNodeIds: number[] = [];

    for (const { templateIdx, room, label } of initialDevices) {
      const template = ZWAVE_DEVICE_TEMPLATES[templateIdx];
      const nodeId = this.getNextNodeId();

      if (template.isListening) {
        listeningNodeIds.push(nodeId);
      }

      // Simulate mesh routing: always listening nodes have more neighbors
      const neighbors: number[] = [this.controllerNodeId];
      // Add some other listening nodes as neighbors
      for (const lid of listeningNodeIds) {
        if (lid !== nodeId && Math.random() > 0.3) {
          neighbors.push(lid);
        }
      }
      // Ensure at least 2 neighbors
      if (neighbors.length < 2 && listeningNodeIds.length > 0) {
        const candidate = listeningNodeIds.find((id) => id !== nodeId && !neighbors.includes(id));
        if (candidate) neighbors.push(candidate);
      }

      const node: MeshNode = {
        nodeId,
        deviceType: template.deviceType,
        manufacturerId: template.manufacturerId,
        productType: template.productType,
        name: `${label} - Room ${room}`,
        location: `Room ${room}`,
        supportedCommandClasses: template.supportedCommandClasses,
        isListening: template.isListening,
        isFailed: false,
        isDead: false,
        neighbors,
        routes: listeningNodeIds.filter((id) => id !== nodeId),
        security: Math.random() > 0.4 ? (Math.random() > 0.5 ? 'S2' : 'S0') : 'none',
        maxBaudRate: template.isListening ? 100000 : 40000,
        lastSeen: new Date().toISOString(),
        pairedAt: new Date(Date.now() - Math.random() * 86400000 * 180).toISOString(),
      };

      this.nodes.set(nodeId, node);
    }
  }

  getNodes(): ZWaveNode[] {
    return Array.from(this.nodes.values()).map((n) => ({
      nodeId: n.nodeId,
      deviceType: n.deviceType,
      manufacturerId: n.manufacturerId,
      productType: n.productType,
      name: n.name,
      location: n.location,
      supportedCommandClasses: n.supportedCommandClasses,
      isListening: n.isListening,
      isFailed: n.isFailed,
      isDead: n.isDead,
    }));
  }

  getNode(nodeId: number): MeshNode | undefined {
    return this.nodes.get(nodeId);
  }

  async executeCommand(command: ZWaveCommand): Promise<{ success: boolean; message: string }> {
    const node = this.nodes.get(command.nodeId);
    if (!node) {
      return {
        success: false,
        message: `Node ${command.nodeId} not found in Z-Wave network.`,
      };
    }

    if (node.isFailed || node.isDead) {
      return {
        success: false,
        message: `Node ${command.nodeId} (${node.name}) is marked as ${node.isDead ? 'dead' : 'failed'}. Cannot send commands.`,
      };
    }

    // Validate command class
    if (!node.supportedCommandClasses.includes(command.commandClass)) {
      return {
        success: false,
        message: `Command class "${command.commandClass}" not supported by node ${command.nodeId} (${node.name}). Supported: ${node.supportedCommandClasses.join(', ')}.`,
      };
    }

    // Simulate Z-Wave transmission (multi-hop mesh, typical 200-500ms)
    const hops = node.isListening ? 1 : Math.ceil(node.neighbors.length / 2);
    const transmitDelay = 200 + hops * 100 + Math.random() * 200;

    await delay(transmitDelay);

    // Simulate occasional failure (3% for listening, 8% for non-listening)
    const failureRate = node.isListening ? 0.03 : 0.08;
    const failed = Math.random() < failureRate;

    // Simulate timeout (2%)
    const timedOut = Math.random() < 0.02;

    let status: 'completed' | 'failed' | 'timeout';
    let message: string;

    if (timedOut) {
      status = 'timeout';
      message = `Command "${command.command}" (${command.commandClass}) to node ${command.nodeId} (${node.name}) timed out after ${Math.round(transmitDelay * 1.5)}ms. No response received.`;
    } else if (failed) {
      status = 'failed';
      message = `Command "${command.command}" (${command.commandClass}) to node ${command.nodeId} (${node.name}) failed. The node did not acknowledge the command. Retransmission recommended.`;
    } else {
      status = 'completed';
      message = `Command "${command.command}" (${command.commandClass}) executed on node ${command.nodeId} (${node.name}). ${hops > 1 ? `Relayed through ${hops} hops. ` : ''}Response time: ${Math.round(transmitDelay)}ms.`;
      node.lastSeen = new Date().toISOString();
    }

    this.commandHistory.push({
      nodeId: command.nodeId,
      commandClass: command.commandClass,
      command: command.command,
      status,
      sentAt: new Date(Date.now() - transmitDelay).toISOString(),
      respondedAt: new Date().toISOString(),
      responseTimeMs: Math.round(transmitDelay),
    });

    if (this.commandHistory.length > 500) {
      this.commandHistory = this.commandHistory.slice(-500);
    }

    return {
      success: status === 'completed',
      message,
    };
  }

  startInclusion(mode: 'classic' | 'network-wide' = 'network-wide'): { success: boolean; message: string } {
    if (this.inclusionMode) {
      return {
        success: true,
        message: `Z-Wave controller is already in inclusion mode (${mode}).`,
      };
    }

    this.inclusionMode = true;

    if (this.inclusionTimer) clearTimeout(this.inclusionTimer);
    this.inclusionTimer = setTimeout(() => {
      this.inclusionMode = false;
      this.inclusionTimer = null;
    }, 60000);

    const modeLabel = mode === 'network-wide' ? 'Network-Wide Inclusion (NWI)' : 'Classic Inclusion';
    return {
      success: true,
      message: `Z-Wave controller entered ${modeLabel} mode for 60 seconds. Home ID: ${this.homeId}. Activate the inclusion button on the device to add it.`,
    };
  }

  stopInclusion(): void {
    this.inclusionMode = false;
    if (this.inclusionTimer) {
      clearTimeout(this.inclusionTimer);
      this.inclusionTimer = null;
    }
  }

  isIncluding(): boolean {
    return this.inclusionMode;
  }

  async includeNextDevice(): Promise<{ success: boolean; message: string; node?: ZWaveNode }> {
    if (!this.inclusionMode) {
      return {
        success: false,
        message: 'Controller is not in inclusion mode. Call startInclusion() first.',
      };
    }

    // Simulate device discovery (3-7 seconds for NWI)
    const discoveryDelay = 3000 + Math.random() * 4000;
    await delay(discoveryDelay);

    // Pick a random device template
    const template = ZWAVE_DEVICE_TEMPLATES[Math.floor(Math.random() * ZWAVE_DEVICE_TEMPLATES.length)];
    const nodeId = this.getNextNodeId();

    // Compute neighbors from existing always-listening nodes
    const listeningNodes = Array.from(this.nodes.values()).filter((n) => n.isListening);
    const neighbors: number[] = [this.controllerNodeId];
    for (const ln of listeningNodes) {
      if (Math.random() > 0.2) neighbors.push(ln.nodeId);
    }
    // Ensure at least 2 neighbors
    if (neighbors.length < 2 && listeningNodes.length > 0) {
      neighbors.push(listeningNodes[Math.floor(Math.random() * listeningNodes.length)].nodeId);
    }

    const node: MeshNode = {
      nodeId,
      deviceType: template.deviceType,
      manufacturerId: template.manufacturerId,
      productType: template.productType,
      name: `${template.name} (New)`,
      location: template.location,
      supportedCommandClasses: template.supportedCommandClasses,
      isListening: template.isListening,
      isFailed: false,
      isDead: false,
      neighbors,
      routes: listeningNodes.map((n) => n.nodeId),
      security: Math.random() > 0.3 ? (Math.random() > 0.5 ? 'S2' : 'S0') : 'none',
      maxBaudRate: template.isListening ? 100000 : 40000,
      lastSeen: new Date().toISOString(),
      pairedAt: new Date().toISOString(),
    };

    this.nodes.set(nodeId, node);

    // Update neighbor tables for existing nodes
    if (template.isListening) {
      for (const existingNode of listeningNodes) {
        if (existingNode.nodeId !== nodeId && Math.random() > 0.4) {
          existingNode.neighbors.push(nodeId);
          existingNode.routes.push(nodeId);
        }
      }
    }

    const zwaveNode: ZWaveNode = {
      nodeId: node.nodeId,
      deviceType: node.deviceType,
      manufacturerId: node.manufacturerId,
      productType: node.productType,
      name: node.name,
      location: node.location,
      supportedCommandClasses: node.supportedCommandClasses,
      isListening: node.isListening,
      isFailed: node.isFailed,
      isDead: node.isDead,
    };

    return {
      success: true,
      message: `Device included: ${template.deviceType} "${template.name}" as Node ${nodeId}. Manufacturer: ${template.manufacturerId}, Security: ${node.security}, Neighbors: [${neighbors.join(', ')}].`,
      node: zwaveNode,
    };
  }

  async removeNode(nodeId: number): Promise<{ success: boolean; message: string }> {
    await delay(150 + Math.random() * 200);

    const node = this.nodes.get(nodeId);
    if (!node) {
      return {
        success: false,
        message: `Node ${nodeId} not found in Z-Wave network.`,
      };
    }

    if (nodeId === this.controllerNodeId) {
      return {
        success: false,
        message: `Cannot remove controller node (Node ${this.controllerNodeId}).`,
      };
    }

    // Remove this node from neighbor tables of other nodes
    for (const [id, existingNode] of this.nodes) {
      if (id === nodeId) continue;
      existingNode.neighbors = existingNode.neighbors.filter((n) => n !== nodeId);
      existingNode.routes = existingNode.routes.filter((r) => r !== nodeId);
    }

    this.nodes.delete(nodeId);

    return {
      success: true,
      message: `Node ${nodeId} (${node.name}) removed from Z-Wave network. Neighbor tables updated.`,
    };
  }

  getMeshInfo(): {
    homeId: string;
    controllerNodeId: number;
    totalNodes: number;
    listeningNodes: number;
    failedNodes: number;
    maxRoutes: number;
    commandHistory: Array<{
      nodeId: number;
      commandClass: string;
      command: string;
      status: 'completed' | 'failed' | 'timeout';
      sentAt: string;
      respondedAt?: string;
      responseTimeMs?: number;
    }>;
  } {
    const nodes = Array.from(this.nodes.values());
    return {
      homeId: this.homeId,
      controllerNodeId: this.controllerNodeId,
      totalNodes: nodes.length,
      listeningNodes: nodes.filter((n) => n.isListening).length,
      failedNodes: nodes.filter((n) => n.isFailed || n.isDead).length,
      maxRoutes: Math.max(...nodes.map((n) => n.neighbors.length), 0),
      commandHistory: this.commandHistory.slice(-50),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// --- Global Singleton State ---

const controllerState = new ZWaveControllerState();

// --- Public API ---

export async function getNodes(config: ZWaveControllerConfig): Promise<ZWaveNode[]> {
  await delay(200 + Math.random() * 300);

  controllerState.initialize(config);

  return controllerState.getNodes();
}

export async function sendZWaveCommand(command: ZWaveCommand): Promise<{ success: boolean; message: string }> {
  if (!controllerState.isInitialized()) {
    return {
      success: false,
      message: 'Z-Wave controller not initialized. Call getNodes() first to initialize.',
    };
  }

  return controllerState.executeCommand(command);
}

export async function startInclusion(mode: 'classic' | 'network-wide' = 'network-wide'): Promise<{ success: boolean; message: string }> {
  await delay(100);

  if (!controllerState.isInitialized()) {
    // Auto-initialize with defaults for convenience
    controllerState.initialize({});
  }

  const result = controllerState.startInclusion(mode);

  // If inclusion started successfully, simulate finding a device
  if (result.success) {
    const inclusionResult = await controllerState.includeNextDevice();
    controllerState.stopInclusion();

    return {
      success: inclusionResult.success,
      message: `${result.message}\n${inclusionResult.message}`,
    };
  }

  return result;
}

export async function removeNode(nodeId: number): Promise<{ success: boolean; message: string }> {
  if (!controllerState.isInitialized()) {
    return {
      success: false,
      message: 'Z-Wave controller not initialized. Call getNodes() first to initialize.',
    };
  }

  return controllerState.removeNode(nodeId);
}

/**
 * Get Z-Wave mesh network diagnostics.
 */
export async function getZWaveMeshInfo(config: ZWaveControllerConfig): Promise<ReturnType<typeof controllerState.getMeshInfo>> {
  await delay(100);
  controllerState.initialize(config);
  return controllerState.getMeshInfo();
}
