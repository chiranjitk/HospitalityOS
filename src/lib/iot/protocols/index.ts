/**
 * StaySuite-HospitalityOS — IoT Protocol Index
 *
 * Re-exports all IoT protocol stub modules for MQTT, Zigbee, and Z-Wave.
 * These are lightweight interfaces that document the expected API but return
 * NOT_IMPLEMENTED until real hardware integrations are available.
 *
 * @see mqtt.ts   — MQTT broker integration (telemetry + commands)
 * @see zigbee.ts  — Zigbee mesh network (sensors, thermostats, lights)
 * @see zwave.ts   — Z-Wave mesh network (locks, thermostats, sensors)
 */

export { connectMQTTBroker, publishCommand, subscribeTelemetry, disconnectMQTTBroker } from './mqtt';
export type { MQTTConnectionConfig, MQTTTelemetryMessage, MQTTCommandMessage } from './mqtt';

export { getNetworkDevices, sendZigbeeCommand, pairDevice } from './zigbee';
export type { ZigbeeCoordinatorConfig, ZigbeeDevice, ZigbeeCommand } from './zigbee';

export { getNodes, sendZWaveCommand, startInclusion, removeNode } from './zwave';
export type { ZWaveControllerConfig, ZWaveNode, ZWaveCommand } from './zwave';
