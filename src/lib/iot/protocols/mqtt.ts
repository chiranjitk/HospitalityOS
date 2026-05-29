/**
 * StaySuite-HospitalityOS — IoT Protocol: MQTT Integration
 *
 * Simulated MQTT protocol manager for hotel IoT device communication.
 * Maintains in-memory state for connections, subscriptions, message queues,
 * and simulated telemetry data streams.
 *
 * To upgrade to a real MQTT integration:
 * 1. Install an MQTT client library (e.g., `mqtt` package).
 * 2. Configure broker URL, credentials, and TLS settings via SystemConfig.
 * 3. Subscribe to device-specific topics (e.g., `staysuite/devices/{deviceId}/telemetry`).
 * 4. Publish commands to device command topics (e.g., `staysuite/devices/{deviceId}/commands`).
 * 5. Handle connection lifecycle (reconnect, QoS, will messages).
 * 6. Route incoming telemetry to the IoT readings storage.
 */

// --- Type Definitions ---

export interface MQTTConnectionConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  tls?: { enabled: boolean; caCert?: string };
  keepalive?: number; // seconds
  protocol?: 'mqtt' | 'mqtts'; // mqtts = MQTT over TLS
}

export interface MQTTTelemetryMessage {
  topic: string;
  payload: unknown;
  qos: number;
  retain: boolean;
  receivedAt: string;
}

export interface MQTTCommandMessage {
  topic: string;
  payload: unknown;
  qos: number;
}

export interface MQTTConnectionState {
  connectionId: string;
  config: MQTTConnectionConfig;
  connected: boolean;
  connectedAt: string | null;
  lastPingAt: string | null;
  subscriptions: Map<string, { qos: number; callback: ((msg: MQTTTelemetryMessage) => void) | null; active: boolean }>;
  pendingMessages: QueuedMessage[];
  telemetryHistory: MQTTTelemetryMessage[];
}

interface QueuedMessage {
  messageId: string;
  topic: string;
  payload: unknown;
  qos: number;
  createdAt: string;
  status: 'queued' | 'sent' | 'acknowledged' | 'failed';
  sentAt?: string;
}

// --- Utility Helpers ---

function generateId(): string {
  return `mqtt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter++;
  return `MSG-${String(messageIdCounter).padStart(6, '0')}`;
}

// --- Simulated Telemetry Data ---

const TELEMETRY_PROFILES: Record<string, () => Record<string, unknown>> = {
  temperature: () => ({
    type: 'temperature',
    celsius: +(20 + Math.random() * 6).toFixed(2),
    fahrenheit: +((20 + Math.random() * 6) * 9 / 5 + 32).toFixed(2),
    humidity: +(35 + Math.random() * 30).toFixed(1),
    unit: 'celsius',
  }),
  occupancy: () => ({
    type: 'occupancy',
    present: Math.random() > 0.3,
    confidence: +(70 + Math.random() * 30).toFixed(1),
    count: Math.floor(Math.random() * 4),
  }),
  energy: () => ({
    type: 'energy',
    powerWatts: +(5 + Math.random() * 45).toFixed(2),
    voltage: +(110 + Math.random() * 10).toFixed(1),
    currentAmps: +(0.1 + Math.random() * 0.4).toFixed(3),
    totalKwh: +(Math.random() * 50).toFixed(2),
  }),
  lighting: () => ({
    type: 'lighting',
    brightness: Math.floor(Math.random() * 101),
    colorTemp: +(2700 + Math.random() * 2300).toFixed(0),
    state: Math.random() > 0.2 ? 'on' : 'off',
  }),
  contact: () => ({
    type: 'contact',
    open: Math.random() > 0.7,
    lastTriggered: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    batteryLevel: Math.floor(80 + Math.random() * 20),
  }),
};

function inferTelemetryType(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('temp')) return 'temperature';
  if (lower.includes('occup')) return 'occupancy';
  if (lower.includes('energy') || lower.includes('power')) return 'energy';
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('bulb')) return 'lighting';
  if (lower.includes('door') || lower.includes('window') || lower.includes('contact')) return 'contact';
  const types = Object.keys(TELEMETRY_PROFILES);
  return types[Math.floor(Math.random() * types.length)];
}

// --- MQTTClientState Class ---

class MQTTClientState {
  private connections: Map<string, MQTTConnectionState> = new Map();
  private telemetryIntervals: Map<string, NodeJS.Timeout> = new Map();

  getConnection(connectionId: string): MQTTConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): MQTTConnectionState[] {
    return Array.from(this.connections.values());
  }

  addConnection(config: MQTTConnectionConfig): MQTTConnectionState {
    const connectionId = generateId();
    const state: MQTTConnectionState = {
      connectionId,
      config,
      connected: false,
      connectedAt: null,
      lastPingAt: null,
      subscriptions: new Map(),
      pendingMessages: [],
      telemetryHistory: [],
    };
    this.connections.set(connectionId, state);
    return state;
  }

  removeConnection(connectionId: string): boolean {
    // Clear all telemetry intervals for this connection
    for (const [intervalKey, interval] of this.telemetryIntervals) {
      if (intervalKey.startsWith(`${connectionId}:`)) {
        clearInterval(interval);
        this.telemetryIntervals.delete(intervalKey);
      }
    }
    return this.connections.delete(connectionId);
  }

  startTelemetryStream(connectionId: string, topic: string, subscriptionEntry: { qos: number; callback: ((msg: MQTTTelemetryMessage) => void) | null; active: boolean }): void {
    const intervalKey = `${connectionId}:${topic}`;
    // Clear existing interval if any
    const existing = this.telemetryIntervals.get(intervalKey);
    if (existing) clearInterval(existing);

    const state = this.connections.get(connectionId);
    if (!state) return;

    const telemetryType = inferTelemetryType(topic);

    const interval = setInterval(() => {
      const profile = TELEMETRY_PROFILES[telemetryType];
      if (!profile) return;

      const payload = profile();
      const message: MQTTTelemetryMessage = {
        topic,
        payload,
        qos: subscriptionEntry.qos,
        retain: false,
        receivedAt: new Date().toISOString(),
      };

      state.telemetryHistory.push(message);
      // Keep only the last 500 messages
      if (state.telemetryHistory.length > 500) {
        state.telemetryHistory = state.telemetryHistory.slice(-500);
      }

      if (subscriptionEntry.callback && subscriptionEntry.active) {
        subscriptionEntry.callback(message);
      }
    }, 2000 + Math.random() * 3000);

    this.telemetryIntervals.set(intervalKey, interval);
    subscriptionEntry.active = true;
  }

  stopTelemetryStream(connectionId: string, topic: string): void {
    const intervalKey = `${connectionId}:${topic}`;
    const interval = this.telemetryIntervals.get(intervalKey);
    if (interval) {
      clearInterval(interval);
      this.telemetryIntervals.delete(intervalKey);
    }
    const state = this.connections.get(connectionId);
    if (state) {
      const sub = state.subscriptions.get(topic);
      if (sub) sub.active = false;
    }
  }

  stopAllTelemetryStreams(connectionId: string): void {
    for (const [intervalKey, interval] of this.telemetryIntervals) {
      if (intervalKey.startsWith(`${connectionId}:`)) {
        clearInterval(interval);
        this.telemetryIntervals.delete(intervalKey);
      }
    }
  }

  getStats() {
    const connections = this.getAllConnections();
    const totalSubscriptions = connections.reduce((sum, c) => sum + c.subscriptions.size, 0);
    const totalPending = connections.reduce((sum, c) => sum + c.pendingMessages.length, 0);
    const totalTelemetry = connections.reduce((sum, c) => sum + c.telemetryHistory.length, 0);
    return {
      activeConnections: connections.filter((c) => c.connected).length,
      totalConnections: connections.length,
      totalSubscriptions,
      totalPendingMessages: totalPending,
      totalTelemetryMessages: totalTelemetry,
      activeTelemetryStreams: this.telemetryIntervals.size,
    };
  }
}

// --- Global Singleton State ---

const clientState = new MQTTClientState();
let activeConnectionId: string | null = null;

// --- Public API ---

export async function connectMQTTBroker(config: MQTTConnectionConfig): Promise<{ success: boolean; message: string; connectionId?: string }> {
  // Simulate connection handshake with delay
  await delay(150 + Math.random() * 200);

  // Check for duplicate clientId
  const existing = clientState.getAllConnections().find((c) => c.config.clientId === config.clientId && c.connected);
  if (existing) {
    return {
      success: false,
      message: `Client "${config.clientId}" is already connected (connectionId: ${existing.connectionId}). Disconnect first or use a different clientId.`,
    };
  }

  const state = clientState.addConnection(config);
  await delay(100 + Math.random() * 150); // Simulate CONNECT/CONNACK exchange

  state.connected = true;
  state.connectedAt = new Date().toISOString();
  state.lastPingAt = new Date().toISOString();
  activeConnectionId = state.connectionId;

  const protocolLabel = config.protocol === 'mqtts' ? 'MQTT over TLS' : 'MQTT';
  const tlsInfo = config.tls?.enabled ? ' (TLS enabled)' : '';

  return {
    success: true,
    message: `${protocolLabel} connection established to ${config.brokerUrl}${tlsInfo}. ClientId: ${config.clientId}, Keepalive: ${config.keepalive ?? 60}s.`,
    connectionId: state.connectionId,
  };
}

export async function publishCommand(deviceId: string, command: MQTTCommandMessage): Promise<{ success: boolean; message: string; messageId?: string }> {
  await delay(50 + Math.random() * 100);

  if (!activeConnectionId) {
    const conn = clientState.getAllConnections().find((c) => c.connected);
    if (!conn) {
      return {
        success: false,
        message: 'No active MQTT connection. Call connectMQTTBroker() first.',
      };
    }
    activeConnectionId = conn.connectionId;
  }

  const state = clientState.getConnection(activeConnectionId);
  if (!state || !state.connected) {
    return {
      success: false,
      message: 'MQTT broker is not connected. Call connectMQTTBroker() first.',
    };
  }

  const messageId = nextMessageId();
  const topic = command.topic || `staysuite/devices/${deviceId}/commands`;

  const queuedMessage: QueuedMessage = {
    messageId,
    topic,
    payload: command.payload,
    qos: command.qos ?? 1,
    createdAt: new Date().toISOString(),
    status: 'queued',
  };

  state.pendingMessages.push(queuedMessage);

  // Simulate message sending with delay
  await delay(80 + Math.random() * 120);
  queuedMessage.status = command.qos >= 2 ? 'acknowledged' : 'sent';
  queuedMessage.sentAt = new Date().toISOString();

  // Keep pending queue manageable
  if (state.pendingMessages.length > 1000) {
    state.pendingMessages = state.pendingMessages.filter((m) => m.status === 'queued');
  }

  return {
    success: true,
    message: `Command published to topic "${topic}" for device "${deviceId}". MessageId: ${messageId}, QoS: ${command.qos ?? 1}.`,
    messageId,
  };
}

export async function subscribeTelemetry(deviceId: string, callback: (msg: MQTTTelemetryMessage) => void): Promise<{ success: boolean; message: string; topic?: string }> {
  await delay(80 + Math.random() * 150);

  if (!activeConnectionId) {
    const conn = clientState.getAllConnections().find((c) => c.connected);
    if (!conn) {
      return {
        success: false,
        message: 'No active MQTT connection. Call connectMQTTBroker() first.',
      };
    }
    activeConnectionId = conn.connectionId;
  }

  const state = clientState.getConnection(activeConnectionId);
  if (!state || !state.connected) {
    return {
      success: false,
      message: 'MQTT broker is not connected. Call connectMQTTBroker() first.',
    };
  }

  const topic = `staysuite/devices/${deviceId}/telemetry`;

  // Check if already subscribed
  if (state.subscriptions.has(topic)) {
    const existing = state.subscriptions.get(topic)!;
    if (existing.active) {
      return {
        success: true,
        message: `Already subscribed to "${topic}". Telemetry stream is active.`,
        topic,
      };
    }
    // Re-activate existing subscription
    existing.callback = callback;
    clientState.startTelemetryStream(state.connectionId, topic, existing);
    return {
      success: true,
      message: `Re-activated subscription to "${topic}". Telemetry stream resumed.`,
      topic,
    };
  }

  const qos = 1;
  const entry = { qos, callback, active: false };
  state.subscriptions.set(topic, entry);
  clientState.startTelemetryStream(state.connectionId, topic, entry);

  return {
    success: true,
    message: `Subscribed to "${topic}". Telemetry data stream started with QoS ${qos}.`,
    topic,
  };
}

export async function disconnectMQTTBroker(): Promise<{ success: boolean; message: string }> {
  await delay(100 + Math.random() * 100);

  if (!activeConnectionId) {
    const conn = clientState.getAllConnections().find((c) => c.connected);
    if (!conn) {
      return { success: true, message: 'No active MQTT connection to disconnect.' };
    }
    activeConnectionId = conn.connectionId;
  }

  const state = clientState.getConnection(activeConnectionId);
  if (!state) {
    return { success: true, message: 'No active connection found.' };
  }

  const clientId = state.config.clientId;

  // Stop all telemetry streams
  clientState.stopAllTelemetryStreams(state.connectionId);

  // Mark as disconnected
  state.connected = false;
  state.connectedAt = null;
  state.lastPingAt = null;

  // Clear subscriptions
  state.subscriptions.clear();

  clientState.removeConnection(state.connectionId);
  activeConnectionId = null;

  return {
    success: true,
    message: `MQTT broker disconnected for client "${clientId}". All subscriptions and telemetry streams have been cleaned up.`,
  };
}

/**
 * Get the current MQTT client statistics and connection state.
 * Useful for monitoring and debugging.
 */
export async function getMQTTStatus(): Promise<{
  connected: boolean;
  connectionId: string | null;
  brokerUrl: string | null;
  clientId: string | null;
  stats: ReturnType<typeof clientState.getStats>;
  subscriptions: string[];
}> {
  const conn = clientState.getAllConnections().find((c) => c.connected);
  return {
    connected: !!conn,
    connectionId: conn?.connectionId ?? null,
    brokerUrl: conn?.config.brokerUrl ?? null,
    clientId: conn?.config.clientId ?? null,
    stats: clientState.getStats(),
    subscriptions: conn ? Array.from(conn.subscriptions.keys()) : [],
  };
}
