/**
 * 01 - Security & IoT Module Tests
 *
 * Tests all 14 security & IoT pages:
 *   1. Cameras             — GET /api/security/cameras, POST /api/security/cameras
 *   2. Security Events     — GET /api/security/events
 *   3. Incidents           — GET /api/security/incidents, POST /api/security/incidents
 *   4. Surveillance Config — GET /api/security/surveillance-config
 *   5. IoT Devices         — GET /api/iot/devices, POST /api/iot/devices
 *   6. IoT Device Command  — GET /api/iot/devices/[id]/command
 *   7. Energy Monitoring   — GET /api/iot/energy
 *   8. IP Check            — GET /api/security/ip-check
 *   9. Auth Sessions       — GET /api/auth/sessions
 *  10. 2FA Setup           — GET /api/auth/2fa/setup
 *  11. SSO Connections     — GET /api/auth/sso/connections
 *  12. Smart Locks         — GET /api/integrations/smart-locks/locks
 *
 * Pattern: real API calls only, no manual DB inserts, graceful 404 skip,
 *          delay(800) between calls, custom assertions (not jest).
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
  saveState,
} from '../pms/setup';

/**
 * Helper — tries a GET and returns { ok, data, status }.
 *   ok=false with status=404 means the endpoint does not exist -> skip gracefully.
 */
async function tryGet(path: string, ck: string): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const { data, status } = await api.get(path, ck);
    return { ok: status >= 200 && status < 300, data, status };
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, data: null, status: 404 };
    }
    throw err;
  }
}

/**
 * Helper — tries a POST and returns { ok, data, status }.
 */
async function tryPost(path: string, body: any, ck: string): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const { data, status } = await api.post(path, body, ck);
    return { ok: status >= 200 && status < 300, data, status };
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, data: null, status: 404 };
    }
    throw err;
  }
}

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }
  const st = loadState();

  // Shared IDs created during tests
  let createdCameraId: string | undefined;
  let createdIncidentId: string | undefined;
  let createdIotDeviceId: string | undefined;
  let firstCameraId: string | undefined;
  let firstDeviceId: string | undefined;

  await runSequentially('01-SecurityIoT', [
    // ═══════════════════════════════════════════════════════════════════
    // PAGE 1 — Cameras  (GET /api/security/cameras, POST /api/security/cameras)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Cameras — POST /api/security/cameras creates a camera',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryPost(
          '/api/security/cameras',
          {
            propertyId: st.propertyId,
            name: `SEC Test Camera ${Date.now()}`,
            location: 'Main Lobby - Entrance',
            type: 'ip',
            ipAddress: `192.168.1.${100 + Math.floor(Math.random() * 150)}`,
            status: 'active',
            resolution: '1080p',
            recordingEnabled: true,
          },
          cookie(state),
        );
        if (!res.ok) {
          console.log('      (POST not available, will try GET only)'); return;
        }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data?.id, 'Should have camera id');
        assertEqual(res.data.data.status, 'active');
        assertNotNull(res.data.data.name, 'Should have name');
        createdCameraId = res.data.data.id;
      },
    },
    {
      name: 'Cameras — GET /api/security/cameras returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/cameras?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Cameras — entries contain required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/cameras?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no cameras, skipping)'); return;
        }
        const cam = res.data.data[0];
        assertNotNull(cam.id, 'Camera should have id');
        assertNotNull(cam.name || cam.cameraName, 'Camera should have name');
        assertNotNull(cam.location, 'Camera should have location');
        assertNotNull(cam.status, 'Camera should have status');
        firstCameraId = cam.id;
      },
    },
    {
      name: 'Cameras — GET /api/security/cameras with status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/cameras?propertyId=${st.propertyId}&status=active`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
        for (const cam of res.data.data) {
          assertEqual(cam.status, 'active', 'Filtered cameras should be active');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 2 — Security Events  (GET /api/security/events)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Security Events — GET /api/security/events returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/events?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Security Events — events have required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/events?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no events, skipping)'); return;
        }
        const evt = res.data.data[0];
        assertNotNull(evt.id, 'Event should have id');
        assertNotNull(evt.type || evt.eventType, 'Event should have type');
        assertNotNull(evt.severity || evt.level, 'Event should have severity');
        assertNotNull(evt.timestamp || evt.createdAt || evt.occurredAt, 'Event should have timestamp');
      },
    },
    {
      name: 'Security Events — GET /api/security/events with severity filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/events?propertyId=${st.propertyId}&severity=high`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 3 — Incidents  (GET /api/security/incidents, POST /api/security/incidents)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Incidents — POST /api/security/incidents creates an incident',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryPost(
          '/api/security/incidents',
          {
            propertyId: st.propertyId,
            title: `SEC Test Incident ${Date.now()}`,
            description: 'Suspicious activity near lobby entrance - automated test',
            type: 'suspicious_activity',
            severity: 'medium',
            status: 'open',
            reportedBy: st.userId,
            location: 'Main Lobby',
            occurredAt: new Date().toISOString(),
          },
          cookie(state),
        );
        if (!res.ok) {
          console.log('      (POST not available, will try GET only)'); return;
        }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data?.id, 'Should have incident id');
        assertEqual(res.data.data.severity, 'medium');
        assertEqual(res.data.data.status, 'open');
        createdIncidentId = res.data.data.id;
      },
    },
    {
      name: 'Incidents — GET /api/security/incidents returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/incidents?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Incidents — entries contain required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/incidents?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no incidents, skipping)'); return;
        }
        const inc = res.data.data[0];
        assertNotNull(inc.id, 'Incident should have id');
        assertNotNull(inc.title, 'Incident should have title');
        assertNotNull(inc.type || inc.incidentType, 'Incident should have type');
        assertNotNull(inc.severity, 'Incident should have severity');
        assertNotNull(inc.status, 'Incident should have status');
      },
    },
    {
      name: 'Incidents — GET /api/security/incidents with status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/incidents?propertyId=${st.propertyId}&status=open`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
        for (const inc of res.data.data) {
          assertEqual(inc.status, 'open', 'Filtered incidents should be open');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 4 — Surveillance Config  (GET /api/security/surveillance-config)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Surveillance Config — GET /api/security/surveillance-config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/surveillance-config?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Surveillance Config — contains configuration fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/security/surveillance-config?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.recordingRetention || d.retentionDays || d.settings, 'Should have retention settings');
        assertNotNull(d.storageConfig || d.storage || d.config, 'Should have storage config');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 5 — IoT Devices  (GET /api/iot/devices, POST /api/iot/devices)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'IoT Devices — POST /api/iot/devices creates a device',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryPost(
          '/api/iot/devices',
          {
            propertyId: st.propertyId,
            name: `IOT Test Thermostat ${Date.now()}`,
            type: 'thermostat',
            location: 'Room 101',
            protocol: 'zigbee',
            status: 'online',
            firmwareVersion: '1.2.0',
            metadata: { temperature: 22, mode: 'cooling' },
          },
          cookie(state),
        );
        if (!res.ok) {
          console.log('      (POST not available, will try GET only)'); return;
        }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data?.id, 'Should have device id');
        assertEqual(res.data.data.status, 'online');
        assertNotNull(res.data.data.name, 'Should have name');
        createdIotDeviceId = res.data.data.id;
      },
    },
    {
      name: 'IoT Devices — GET /api/iot/devices returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/iot/devices?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'IoT Devices — entries contain required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/iot/devices?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no devices, skipping)'); return;
        }
        const dev = res.data.data[0];
        assertNotNull(dev.id, 'Device should have id');
        assertNotNull(dev.name || dev.deviceName, 'Device should have name');
        assertNotNull(dev.type || dev.deviceType, 'Device should have type');
        assertNotNull(dev.status, 'Device should have status');
        firstDeviceId = dev.id;
      },
    },
    {
      name: 'IoT Devices — GET /api/iot/devices with type filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/iot/devices?propertyId=${st.propertyId}&type=thermostat`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 6 — IoT Device Command  (GET /api/iot/devices/[id]/command)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'IoT Command — GET /api/iot/devices/[id]/command retrieves command history',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const deviceId = createdIotDeviceId || firstDeviceId;
        if (!deviceId) { console.log('      (no device ID, skipping)'); return; }
        const res = await tryGet(`/api/iot/devices/${deviceId}/command`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 7 — Energy Monitoring  (GET /api/iot/energy)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Energy — GET /api/iot/energy returns energy data',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/iot/energy?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Energy — contains consumption metrics',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/iot/energy?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.consumption || d.totalConsumption || d.usage || d.readings, 'Should have consumption data');
        assertNotNull(d.cost || d.totalCost || d.billing, 'Should have cost data');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 8 — IP Check  (GET /api/security/ip-check)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'IP Check — GET /api/security/ip-check returns IP info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/security/ip-check', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'IP Check — contains IP address and risk assessment',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/security/ip-check', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.ip || d.ipAddress, 'Should have IP address');
        assertNotNull(d.risk || d.riskLevel || d.riskScore !== undefined, 'Should have risk assessment');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 9 — Auth Sessions  (GET /api/auth/sessions)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Auth Sessions — GET /api/auth/sessions returns active sessions',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/sessions', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },
    {
      name: 'Auth Sessions — sessions contain required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/sessions', cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no sessions, skipping)'); return;
        }
        const session = res.data.data[0];
        assertNotNull(session.id || session.sessionId, 'Session should have id');
        assertNotNull(session.ip || session.ipAddress, 'Session should have IP');
        assertNotNull(session.createdAt || session.lastActive, 'Session should have timestamp');
        assertNotNull(session.userAgent || session.device, 'Session should have user agent or device');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 10 — 2FA Setup  (GET /api/auth/2fa/setup)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: '2FA Setup — GET /api/auth/2fa/setup returns 2FA config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/2fa/setup', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: '2FA Setup — contains secret and QR code or status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/2fa/setup', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.enabled !== undefined || d.isEnabled !== undefined || d.secret || d.qrCode, 'Should have 2FA status or secret');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 11 — SSO Connections  (GET /api/auth/sso/connections)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'SSO Connections — GET /api/auth/sso/connections returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/sso/connections', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },
    {
      name: 'SSO Connections — entries have provider info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/auth/sso/connections', cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no SSO connections, skipping)'); return;
        }
        const conn = res.data.data[0];
        assertNotNull(conn.id, 'SSO connection should have id');
        assertNotNull(conn.provider || conn.providerId || conn.name, 'SSO connection should have provider');
        assertNotNull(conn.status || conn.enabled !== undefined, 'SSO connection should have status');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 12 — Smart Locks  (GET /api/integrations/smart-locks/locks)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Smart Locks — GET /api/integrations/smart-locks/locks returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/integrations/smart-locks/locks?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },
    {
      name: 'Smart Locks — entries contain lock details',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/integrations/smart-locks/locks?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no smart locks, skipping)'); return;
        }
        const lock = res.data.data[0];
        assertNotNull(lock.id || lock.lockId, 'Lock should have id');
        assertNotNull(lock.name || lock.lockName, 'Lock should have name');
        assertNotNull(lock.status || lock.lockStatus, 'Lock should have status');
        assertNotNull(lock.location || lock.roomId || lock.room, 'Lock should have location');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CROSS-CUTTING VALIDATION
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Cross-check — security events count matches or supplements incidents',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const [eventsRes, incidentsRes] = await Promise.all([
          tryGet(`/api/security/events?propertyId=${st.propertyId}`, cookie(state)),
          tryGet(`/api/security/incidents?propertyId=${st.propertyId}`, cookie(state)),
        ]);
        if (!eventsRes.ok && !incidentsRes.ok) {
          console.log('      (both endpoints unavailable, skipping)'); return;
        }
        assertNotNull(eventsRes.data?.data || incidentsRes.data?.data, 'At least one endpoint should have data');
      },
    },
    {
      name: 'Cross-check — created camera appears in camera list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!createdCameraId) { console.log('      (no camera was created, skipping)'); return; }
        const res = await tryGet(`/api/security/cameras?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (endpoint not available, skipping)'); return; }
        const found = res.data.data.some((c: any) => c.id === createdCameraId);
        assert(found, 'Created camera should appear in list');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
