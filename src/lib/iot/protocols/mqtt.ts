/**
 * StaySuite-HospitalityOS — IoT Protocol: MQTT Integration
 *
 * Stub/placeholder for MQTT protocol integration. This module documents the expected
 * API surface for connecting to an MQTT broker for real-time IoT device communication.
 *
 * To implement a real MQTT integration:
 * 1. Install an MQTT client library (e.g., `mqtt` package).
 * 2. Configure broker URL, credentials, and TLS settings via SystemConfig.
 * 3. Subscribe to device-specific topics (e.g., `staysuite/devices/{deviceId}/telemetry`).
 * 4. Publish commands to device command topics (e.g., `staysuite/devices/{deviceId}/commands`).
 * 5. Handle connection lifecycle (reconnect, QoS, will messages).
 * 6. Route incoming telemetry to the IoT readings storage.
 */

// TODO(L-25): Implement real MQTT broker connection using the `mqtt` package
// TODO(L-25): Subscribe to device telemetry topics and persist readings
// TODO(L-25): Publish device commands through MQTT

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

export async function connectMQTTBroker(_config: MQTTConnectionConfig): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Implement actual MQTT broker connection
  return {
    success: false,
    message: 'MQTT integration not yet implemented. Install `mqtt` package and configure broker credentials.',
  };
}

export async function publishCommand(_deviceId: string, _command: MQTTCommandMessage): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Publish MQTT command to device topic
  return {
    success: false,
    message: 'MQTT command publishing not yet implemented.',
  };
}

export async function subscribeTelemetry(_deviceId: string, _callback: (msg: MQTTTelemetryMessage) => void): Promise<{ success: boolean; message: string }> {
  // TODO(L-25): Subscribe to device telemetry topic
  return {
    success: false,
    message: 'MQTT telemetry subscription not yet implemented.',
  };
}

export async function disconnectMQTTBroker(): Promise<void> {
  // TODO(L-25): Gracefully disconnect from MQTT broker
}
