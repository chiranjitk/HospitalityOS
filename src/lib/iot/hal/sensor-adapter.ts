/**
 * L-27: IoT HAL — Sensor Adapter Interface
 *
 * TODO(L-27): Implement concrete sensor adapter classes.
 *
 * This module defines the contract for IoT sensor adapters used in
 * hospitality environments (occupancy, door/window, motion, temperature/humidity,
 * energy, water leak, smoke/CO detectors).
 *
 * To integrate a new sensor vendor:
 *
 * 1. Create a class extending BaseIoTAdapter (from ./index.ts)
 * 2. Implement getInfo() returning { category: 'sensor', providerId: '<vendor>' }
 * 3. Implement connect() — sensors typically push data via MQTT or report via gateway
 * 4. Implement executeCommand() mapping:
 *    - poll:         Force a reading (params: { sensorIds?: string[] })
 *    - calibrate:    Calibrate sensor (params: { offset?: number })
 *    - set_interval: Change reporting interval (params: { intervalSeconds: number })
 *    - arm:          Enable alerts (params: { thresholds: object })
 *    - disarm:       Disable alerts
 * 5. Implement getDeviceState() returning { type, value, unit, lastReadingAt, batteryLevel }
 * 6. Implement discoverDevices() to enumerate sensors from the gateway/network
 * 7. Store readings in IoTReading table for historical queries and dashboards
 * 8. Emit real-time events when readings exceed thresholds (fire/burglar/water alerts)
 *
 * Sensor data flow:
 *   Sensor → MQTT/Zigbee/Z-Wave → Protocol Layer → Adapter → DB (IoTReading)
 *                                                             → Real-time (WebSocket/SSE)
 *                                                             → Alerts (if threshold exceeded)
 *
 * Existing sensor routes:
 *   GET  /api/iot/occupancy/sensors          — List sensors
 *   GET  /api/iot/occupancy/sensors/[id]     — Single sensor
 *   GET  /api/iot/occupancy/sensors/[id]/readings — Historical readings
 *   GET  /api/iot/occupancy/room-status       — Per-room occupancy summary
 */

// Sensor type constants
export const SensorType = {
  OCCUPANCY: 'occupancy',
  MOTION: 'motion',
  DOOR_WINDOW: 'door_window',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  ENERGY: 'energy',
  WATER_LEAK: 'water_leak',
  SMOKE: 'smoke',
  CO: 'co',
  LIGHT_LEVEL: 'light_level',
} as const;

// TODO(L-27): Add SensorAdapter class extending BaseIoTAdapter
// TODO(L-27): Add threshold evaluation helpers (compare reading against configured limits)
// TODO(L-27): Add createSensorAdapter factory function for adapter registry
