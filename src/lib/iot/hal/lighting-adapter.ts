/**
 * L-27: IoT HAL — Lighting Adapter Interface
 *
 * TODO(L-27): Implement concrete lighting adapter classes.
 *
 * This module defines the contract for smart lighting IoT adapters.
 * Common hospitality vendors: Philips Hue, Lutron, Crestron, DMX controllers.
 *
 * To integrate a new lighting vendor:
 *
 * 1. Create a class extending BaseIoTAdapter (from ./index.ts)
 * 2. Implement getInfo() returning { category: 'lighting', providerId: '<vendor>' }
 * 3. Implement connect() — Hue uses bridge discovery + API key, Lutron uses telnet/JSON
 * 4. Implement executeCommand() mapping:
 *    - set_state:    Turn on/off (params: { on: boolean })
 *    - set_brightness: Set brightness 0-100% (params: { brightness: number })
 *    - set_color:    Set RGB color (params: { r, g, b } or { hue, saturation })
 *    - set_scene:    Activate a preconfigured scene (params: { sceneId: string })
 *    - set_warmth:   Set color temperature in Kelvin (params: { colorTempK: number })
 * 5. Implement getDeviceState() returning { on, brightness, color, scene, colorTemp }
 * 6. Implement discoverDevices() to enumerate lights/zones from the bridge
 * 7. Support grouping/zones for room-level and floor-level control
 *
 * Protocol options:
 *   - REST API (Philips Hue Bridge API, Lutron Caseta)
 *   - Zigbee (Hue lights via Zigbee2MQTT)
 *   - DMX512 (stage/event lighting — requires serial/USB-DMX adapter)
 */

// Lighting-specific state constants
export const LightColorMode = {
  HS: 'hs',       // Hue + Saturation
  RGB: 'rgb',     // Red + Green + Blue
  CT: 'ct',       // Color Temperature (white spectrum)
  XY: 'xy',       // CIE xy color space (Philips Hue native)
} as const;

// TODO(L-27): Add LightingAdapter class extending BaseIoTAdapter
// TODO(L-27): Add scene management helpers (create, activate, schedule scenes)
// TODO(L-27): Add createLightingAdapter factory function for adapter registry
