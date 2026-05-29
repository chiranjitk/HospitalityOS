/**
 * L-27: IoT HAL — Thermostat Adapter Interface
 *
 * TODO(L-27): Implement concrete thermostat adapter classes.
 *
 * This module defines the contract for smart thermostat IoT adapters.
 * Common hospitality vendors: Ecobee, Honeywell, Nest, Daikin, Mitsubishi.
 *
 * To integrate a new thermostat vendor:
 *
 * 1. Create a class extending BaseIoTAdapter (from ./index.ts)
 * 2. Implement getInfo() returning { category: 'thermostat', providerId: '<vendor>' }
 * 3. Implement connect() with vendor OAuth or API key authentication
 * 4. Implement executeCommand() mapping:
 *    - set_temperature: Set target temperature (params: { temperatureC: number })
 *    - set_mode:        Set HVAC mode (params: { mode: 'heat'|'cool'|'auto'|'off' })
 *    - set_fan:         Set fan speed (params: { fan: 'auto'|'low'|'medium'|'high' })
 *    - eco_mode:        Toggle eco/energy-saving mode
 *    - schedule:        Apply temperature schedule (params: { schedule: object })
 * 5. Implement getDeviceState() returning { currentTemp, targetTemp, humidity, mode, fanSpeed }
 * 6. Implement discoverDevices() to enumerate thermostats on the vendor network
 * 7. Implement batch control for room blocks (set temperature for all rooms on a floor)
 *
 * Protocol options:
 *   - REST API (Ecobee, Nest Cloud API)
 *   - MQTT (local Zigbee/Z-Wave thermostat bridges)
 *   - BACnet/IP (commercial HVAC systems — requires BACnet library)
 */

// Thermostat-specific state constants
export const ThermostatMode = {
  HEAT: 'heat',
  COOL: 'cool',
  AUTO: 'auto',
  OFF: 'off',
  ECO: 'eco',
} as const;

export const FanSpeed = {
  AUTO: 'auto',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

// TODO(L-27): Add ThermostatAdapter class extending BaseIoTAdapter
// TODO(L-27): Add temperature unit conversion helpers (C/F)
// TODO(L-27): Add createThermostatAdapter factory function for adapter registry
