import { describe, it, expect, afterAll } from 'vitest';
import { GET as getRules, POST as createRule, PUT as updateRule, DELETE as deleteRule } from '@/app/api/automation/rules/route';
import { GET as getExecutionLogs, POST as createExecutionLog } from '@/app/api/automation/execution-logs/route';
import { createAuthRequest, buildUrl, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdRuleId: string;
let createdLogId: string;

describe('Automation Rules API', () => {
  describe('GET /api/automation/rules', () => {
    it('should return list of automation rules with stats', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url);
      const res = await getRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.rules).toBeDefined();
      expect(Array.isArray(data.data.rules)).toBe(true);
      expect(data.data.total).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('totalRules');
      expect(data.data.stats).toHaveProperty('activeRules');
      expect(data.data.stats).toHaveProperty('totalExecutions');
      expect(data.data.stats).toHaveProperty('successRate');
      expect(data.data.stats).toHaveProperty('executionsToday');
    });

    it('should include trigger events catalog', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url);
      const res = await getRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.triggerEvents).toBeDefined();
      expect(Array.isArray(data.data.triggerEvents)).toBe(true);
      expect(data.data.triggerEvents.length).toBeGreaterThan(0);
      // Each trigger event should have value, label, description
      const trigger = data.data.triggerEvents[0];
      expect(trigger).toHaveProperty('value');
      expect(trigger).toHaveProperty('label');
      expect(trigger).toHaveProperty('description');
    });

    it('should filter by isActive', async () => {
      const url = buildUrl('/api/automation/rules', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await getRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.rules).toBeDefined();
    });

    it('should filter by triggerEvent', async () => {
      const url = buildUrl('/api/automation/rules', { triggerEvent: 'booking.created' });
      const req = await createAuthRequest(url);
      const res = await getRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support search', async () => {
      const url = buildUrl('/api/automation/rules', { search: 'test' });
      const req = await createAuthRequest(url);
      const res = await getRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/automation/rules');
      const res = await getRules(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/automation/rules', () => {
    it('should create a new automation rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Rule ${suffix}`,
          description: 'A test automation rule',
          triggerEvent: 'booking.created',
          triggerConditions: JSON.stringify({ propertyType: 'hotel' }),
          actions: [
            { type: 'send_notification', config: { channel: 'in_app', template: 'booking_confirmed' } },
            { type: 'update_room', config: { status: 'occupied' } },
          ],
          isActive: true,
        },
      });
      const res = await createRule(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Rule');
      expect(data.data.triggerEvent).toBe('booking.created');
      expect(data.data.isActive).toBe(true);
      createdRuleId = data.data.id;
    });

    it('should require name, triggerEvent, and actions', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Fields' },
      });
      const res = await createRule(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should validate name length', async () => {
      const url = buildUrl('/api/automation/rules');
      const longName = 'A'.repeat(201);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: longName,
          triggerEvent: 'booking.created',
          actions: [],
        },
      });
      const res = await createRule(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should validate actions is an array', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Bad Actions',
          triggerEvent: 'booking.created',
          actions: 'not-an-array',
        },
      });
      const res = await createRule(req);
      expect(res.status).toBe(400);
    });

    it('should accept stringified actions array', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `String Actions ${suffix}`,
          triggerEvent: 'guest.check_in',
          actions: JSON.stringify([{ type: 'send_notification' }]),
        },
      });
      const res = await createRule(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Clean up
      if (data.data?.id) {
        await db.automationRule.delete({ where: { id: data.data.id } }).catch(() => {});
      }
    });
  });

  describe('PUT /api/automation/rules', () => {
    it('should update an automation rule', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdRuleId,
          name: `Updated Rule ${suffix}`,
          isActive: false,
        },
      });
      const res = await updateRule(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toContain('Updated Rule');
      expect(data.data.isActive).toBe(false);
    });

    it('should require rule id', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await updateRule(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent rule', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: fakeId, name: 'Ghost Rule' },
      });
      const res = await updateRule(req);
      expect(res.status).toBe(404);
    });

    it('should validate actions format when updating', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdRuleId,
          actions: 'still-not-array',
        },
      });
      const res = await updateRule(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/automation/rules', () => {
    it('should delete an automation rule', async () => {
      // Create a rule to delete
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/automation/rules');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          name: `Delete Me ${suffix}`,
          triggerEvent: 'guest.check_out',
          actions: [{ type: 'log' }],
        },
      });
      const createRes = await createRule(createReq);
      const createData = await createRes.json();
      const tempId = createData.data.id;

      const deleteUrl = buildUrl('/api/automation/rules', { id: tempId });
      const deleteReq = await createAuthRequest(deleteUrl, { method: 'DELETE' });
      const deleteRes = await deleteRule(deleteReq);
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);
    });

    it('should require rule id', async () => {
      const url = buildUrl('/api/automation/rules');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRule(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent rule', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/automation/rules', { id: fakeId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRule(req);
      expect(res.status).toBe(404);
    });
  });
});

describe('Automation Execution Logs API', () => {
  describe('GET /api/automation/execution-logs', () => {
    it('should return execution logs with stats', async () => {
      const url = buildUrl('/api/automation/execution-logs');
      const req = await createAuthRequest(url);
      const res = await getExecutionLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.logs).toBeDefined();
      expect(data.data.total).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('totalExecutions');
      expect(data.data.stats).toHaveProperty('successful');
      expect(data.data.stats).toHaveProperty('failed');
      expect(data.data.stats).toHaveProperty('successRate');
      expect(data.data.stats).toHaveProperty('executionsToday');
    });

    it('should filter by ruleId', async () => {
      const url = buildUrl('/api/automation/execution-logs', { ruleId: createdRuleId });
      const req = await createAuthRequest(url);
      const res = await getExecutionLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/automation/execution-logs', { status: 'success' });
      const req = await createAuthRequest(url);
      const res = await getExecutionLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include rule name in logs', async () => {
      const url = buildUrl('/api/automation/execution-logs', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await getExecutionLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.logs.length > 0) {
        const log = data.data.logs[0];
        expect(log).toHaveProperty('ruleName');
      }
    });
  });

  describe('POST /api/automation/execution-logs', () => {
    it('should create an execution log', async () => {
      const url = buildUrl('/api/automation/execution-logs');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          ruleId: createdRuleId,
          triggerData: { bookingId: 'test-booking-123' },
          status: 'success',
          errorMessage: null,
          actionsResult: { notifications: 1, roomUpdated: true },
        },
      });
      const res = await createExecutionLog(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('success');
      createdLogId = data.data.id;
    });

    it('should require ruleId and status', async () => {
      const url = buildUrl('/api/automation/execution-logs');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { status: 'success' },
      });
      const res = await createExecutionLog(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent rule', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/automation/execution-logs');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { ruleId: fakeId, status: 'failed' },
      });
      const res = await createExecutionLog(req);
      expect(res.status).toBe(404);
    });

    it('should create a failed execution log with error message', async () => {
      const url = buildUrl('/api/automation/execution-logs');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          ruleId: createdRuleId,
          status: 'failed',
          errorMessage: 'Connection timeout to external service',
          triggerData: { retryCount: 1 },
        },
      });
      const res = await createExecutionLog(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('failed');
      // Clean up
      if (data.data.id) {
        await db.automationExecutionLog.delete({ where: { id: data.data.id } }).catch(() => {});
      }
    });
  });
});

afterAll(async () => {
  // Clean up the rule created in tests
  if (createdRuleId) {
    await db.automationExecutionLog.deleteMany({ where: { ruleId: createdRuleId } }).catch(() => {});
    await db.automationRule.delete({ where: { id: createdRuleId } }).catch(() => {});
  }
  if (createdLogId) {
    await db.automationExecutionLog.delete({ where: { id: createdLogId } }).catch(() => {});
  }
});
