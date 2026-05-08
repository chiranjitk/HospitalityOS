import { describe, it, expect, afterAll } from 'vitest';
import { GET as getDevices, POST as createDevice } from '@/app/api/iot/devices/route';
import { GET as getDevice, PUT as updateDevice, DELETE as deleteDevice } from '@/app/api/iot/devices/[id]/route';
import { GET as getCommands, POST as sendCommand } from '@/app/api/iot/devices/[id]/command/route';
import { GET as getRealtimeDevices } from '@/app/api/iot/devices/realtime/route';
import { GET as getEnergy, POST as createEnergyMetric } from '@/app/api/iot/energy/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdDeviceId: string;
let createdEnergyMetricId: string;

describe('IoT Devices API', () => {
  describe('GET /api/iot/devices', () => {
    it('should return list of IoT devices with stats', async () => {
      const url = buildUrl('/api/iot/devices');
      const req = await createAuthRequest(url);
      const res = await getDevices(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.devices).toBeDefined();
      expect(Array.isArray(data.devices)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('byStatus');
      expect(data.stats).toHaveProperty('byType');
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('online');
      expect(data.stats).toHaveProperty('offline');
    });

    it('should filter devices by propertyId', async () => {
      const url = buildUrl('/api/iot/devices', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getDevices(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.devices).toBeDefined();
      expect(Array.isArray(data.devices)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/iot/devices');
      const res = await getDevices(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/iot/devices', () => {
    it('should create a new IoT device', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/iot/devices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Thermostat ${suffix}`,
          type: 'thermostat',
          manufacturer: 'TestMfg',
          model: 'TM-100',
          serialNumber: `SN-${suffix.slice(-8)}`,
          protocol: 'wifi',
          ipAddress: '192.168.1.100',
          macAddress: `AA:BB:CC:DD:EE:${suffix.slice(-2)}`,
          config: { pollingInterval: 30 },
        },
      });
      const res = await createDevice(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Thermostat');
      expect(data.data.type).toBe('thermostat');
      expect(data.data.status).toBe('offline');
      createdDeviceId = data.data.id;
    });

    it('should require propertyId, name, and type', async () => {
      const url = buildUrl('/api/iot/devices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Fields' },
      });
      const res = await createDevice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject invalid propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/iot/devices');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          name: `Bad Property ${suffix}`,
          type: 'sensor',
        },
      });
      const res = await createDevice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/iot/devices/[id]', () => {
    it('should return a single IoT device by id', async () => {
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}`);
      const req = await createAuthRequest(url);
      const res = await getDevice(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(createdDeviceId);
      expect(data.name).toBeDefined();
      expect(data.type).toBeDefined();
      expect(data.readings).toBeDefined();
      expect(data.commands).toBeDefined();
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/iot/devices/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getDevice(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/iot/devices/[id]', () => {
    it('should update a device name', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: `Updated Device ${suffix}` },
      });
      const res = await updateDevice(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toContain('Updated Device');
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/iot/devices/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Wont Work' },
      });
      const res = await updateDevice(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/iot/devices/[id]/command', () => {
    it('should send a valid command to a device', async () => {
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}/command`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { command: 'turn_on', source: 'manual' },
      });
      const res = await sendCommand(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.command).toBe('turn_on');
    });

    it('should reject invalid command', async () => {
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}/command`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { command: 'explode', source: 'manual' },
      });
      const res = await sendCommand(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(400);
    });

    it('should validate set_temperature parameters', async () => {
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}/command`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { command: 'set_temperature', parameters: { temperature: 5 } },
      });
      const res = await sendCommand(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('between 10 and 35');
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/iot/devices/${fakeId}/command`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { command: 'turn_on' },
      });
      const res = await sendCommand(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/iot/devices/[id]/command', () => {
    it('should return command history for a device', async () => {
      const url = buildUrl(`/api/iot/devices/${createdDeviceId}/command`);
      const req = await createAuthRequest(url);
      const res = await getCommands(req, { params: Promise.resolve({ id: createdDeviceId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.summary).toBeDefined();
    });
  });

  describe('GET /api/iot/devices/realtime', () => {
    it('should return realtime device states', async () => {
      const url = buildUrl('/api/iot/devices/realtime');
      const req = await createAuthRequest(url);
      const res = await getRealtimeDevices(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.devices).toBeDefined();
      expect(Array.isArray(data.devices)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('online');
      expect(data.stats).toHaveProperty('offline');
      expect(data.stats).toHaveProperty('lowBattery');
      expect(data.lastUpdated).toBeDefined();
    });

    it('should filter realtime devices by type', async () => {
      const url = buildUrl('/api/iot/devices/realtime', { type: 'thermostat' });
      const req = await createAuthRequest(url);
      const res = await getRealtimeDevices(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.devices)).toBe(true);
    });
  });

  describe('DELETE /api/iot/devices/[id]', () => {
    it('should delete an IoT device', async () => {
      // Create a temporary device to delete
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/iot/devices');
      const createReq = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Delete Me ${suffix}`,
          type: 'sensor',
        },
      });
      const createRes = await createDevice(createReq);
      const createData = await createRes.json();
      const tempId = createData.data.id;

      const deleteUrl = buildUrl(`/api/iot/devices/${tempId}`);
      const deleteReq = await createAuthRequest(deleteUrl, { method: 'DELETE' });
      const deleteRes = await deleteDevice(deleteReq, { params: Promise.resolve({ id: tempId }) } as any);
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/iot/devices/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteDevice(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });
});

describe('IoT Energy API', () => {
  describe('GET /api/iot/energy', () => {
    it('should return energy metrics with analytics', async () => {
      const url = buildUrl('/api/iot/energy');
      const req = await createAuthRequest(url);
      const res = await getEnergy(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.metrics).toBeDefined();
      expect(data.dailyMetrics).toBeDefined();
      expect(data.totals).toBeDefined();
      expect(data.totals).toHaveProperty('electricityKwh');
      expect(data.totals).toHaveProperty('gasM3');
      expect(data.totals).toHaveProperty('waterM3');
      expect(data.totals).toHaveProperty('totalCost');
      expect(data.dailyAvg).toBeDefined();
      expect(data.propertyBreakdown).toBeDefined();
      expect(data.savings).toBeDefined();
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/iot/energy', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getEnergy(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.metrics).toBeDefined();
    });
  });

  describe('POST /api/iot/energy', () => {
    it('should create an energy metric record', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/iot/energy');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          date: new Date().toISOString().split('T')[0],
          electricityKwh: 450.5,
          gasM3: 120.0,
          waterM3: 85.3,
          electricityCost: 3375.0,
          gasCost: 960.0,
          waterCost: 426.5,
          carbonFootprint: 225.0,
        },
      });
      const res = await createEnergyMetric(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.electricityKwh).toBe(450.5);
      expect(data.data.carbonFootprint).toBe(225.0);
      createdEnergyMetricId = data.data.id;
    });

    it('should require propertyId and date', async () => {
      const url = buildUrl('/api/iot/energy');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { electricityKwh: 100 },
      });
      const res = await createEnergyMetric(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject negative energy values', async () => {
      const url = buildUrl('/api/iot/energy');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          date: '2099-01-01',
          electricityKwh: -50,
        },
      });
      const res = await createEnergyMetric(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('non-negative');
    });
  });

  afterAll(async () => {
    if (createdDeviceId) {
      await db.ioTCommand.deleteMany({ where: { deviceId: createdDeviceId } });
      await db.ioTReading.deleteMany({ where: { deviceId: createdDeviceId } });
      await db.ioTDevice.delete({ where: { id: createdDeviceId } }).catch(() => {});
    }
    if (createdEnergyMetricId) {
      await db.energyMetric.delete({ where: { id: createdEnergyMetricId } }).catch(() => {});
    }
  });
});
