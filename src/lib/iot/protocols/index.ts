/**
 * StaySuite-HospitalityOS — IoT Protocol Index
 *
 * Re-exports all IoT protocol modules for MQTT, Zigbee, and Z-Wave.
 * Each protocol manager maintains in-memory simulated state with
 * realistic behavior for development and testing.
 *
 * @see mqtt.ts   — MQTT broker integration (telemetry + commands)
 * @see zigbee.ts  — Zigbee mesh network (sensors, thermostats, lights)
 * @see zwave.ts   — Z-Wave mesh network (locks, thermostats, sensors)
 */

// --- MQTT ---
export { connectMQTTBroker, publishCommand, subscribeTelemetry, disconnectMQTTBroker, getMQTTStatus } from './mqtt';
export type { MQTTConnectionConfig, MQTTTelemetryMessage, MQTTCommandMessage } from './mqtt';

// --- Zigbee ---
export { getNetworkDevices, sendZigbeeCommand, pairDevice, getZigbeeNetworkTopology, unpairZigbeeDevice } from './zigbee';
export type { ZigbeeCoordinatorConfig, ZigbeeDevice, ZigbeeCommand } from './zigbee';

// --- Z-Wave ---
export { getNodes, sendZWaveCommand, startInclusion, removeNode, getZWaveMeshInfo } from './zwave';
export type { ZWaveControllerConfig, ZWaveNode, ZWaveCommand } from './zwave';
