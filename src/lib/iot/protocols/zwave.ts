/**
 * StaySuite-HospitalityOS — IoT Protocol: Z-Wave Integration
 *
 * Stub/placeholder for Z-Wave protocol integration. Z-Wave is a wireless mesh
 * protocol commonly used for smart locks, thermostats, lighting, and sensors
 * in hospitality environments.
 *
 * To implement a real Z-Wave integration:
 * 1. Deploy a Z-Wave controller (USB stick or Raspberry Pi + Z-Wave module).
 * 2. Install OpenZWave (ozwdaemon) or use the Z-Wave JS (openzwave) library.
 * 3. Configure the controller serial port or TCP connection.
 * 4. Enumerate Z-Wave nodes and query their capabilities.
 * 5. Implement Z-Wave command classes: Door Lock (0x62), Thermostat (0x44), etc.
 * 6. Handle Z-Wave inclusion/exclusion, association groups, and scene activation.
 */

// TODO(L-25): Connect to Z-Wave controller via OpenZWave or Z-Wave JS
// TODO(L-25): Implement Z-Wave node enumeration and capability caching
// TODO(L-25): Map Z-Wave command classes to StaySuite device operations

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

export async function getNodes(_config: ZWaveControllerConfig): Promise<ZWaveNode[]> {
  // TODO(L-25): Query Z-Wave controller for nodes
  return [];
}

export async function sendZWaveCommand(_command: ZWaveCommand): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Send Z-Wave command via controller
  return {
    success: false,
    message: 'Z-Wave integration not yet implemented. Install openzwave or use a Z-Wave JS binding.',
  };
}

export async function startInclusion(_mode?: 'classic' | 'network-wide'): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Put Z-Wave controller into inclusion mode
  return {
    success: false,
    message: 'Z-Wave inclusion not yet implemented.',
  };
}

export async function removeNode(_nodeId: number): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Remove Z-Wave node from controller
  return {
    success: false,
    message: 'Z-Wave node removal not yet implemented.',
  };
}
