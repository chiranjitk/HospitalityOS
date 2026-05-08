import { describe, it, expect, afterAll } from 'vitest';
import { GET as getNotifications, POST as postNotification, PUT as putNotification, DELETE as deleteNotification } from '@/app/api/notifications/route';
import { GET as getNotificationsList } from '@/app/api/notifications/list/route';
import { POST as createNotification } from '@/app/api/notifications/create/route';
import { GET as getDeliveryLogs } from '@/app/api/notifications/delivery-logs/route';
import { GET as getTemplates, POST as createTemplate } from '@/app/api/notifications/templates/route';
import { GET as getSettings } from '@/app/api/notifications/settings/route';
import { GET as getNotificationDiagnostics } from '@/app/api/notifications/test/route';
import { createAuthRequest, buildUrl, USER_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdNotificationId: string;
let createdTemplateId: string;

describe('Notifications API', () => {
  describe('GET /api/notifications', () => {
    it('should return notifications for the authenticated user', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url);
      const res = await getNotifications(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.notifications).toBeDefined();
      expect(data.data.total).toBeDefined();
      expect(data.data.unreadCount).toBeDefined();
    });

    it('should support unreadOnly filter', async () => {
      const url = buildUrl('/api/notifications', { unreadOnly: 'true' });
      const req = await createAuthRequest(url);
      const res = await getNotifications(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.notifications).toBeDefined();
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/notifications');
      const res = await getNotifications(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications', () => {
    it('should create and send a notification', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          userId: USER_ID,
          type: 'system',
          category: 'info',
          title: `Test Notification ${suffix}`,
          message: `This is test notification body ${suffix}`,
          priority: 'normal',
          channels: ['in_app'],
        },
      });
      const res = await postNotification(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.notificationId).toBeDefined();
      createdNotificationId = data.data.notificationId;
    });

    it('should require title, message, and type', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { userId: USER_ID },
      });
      const res = await postNotification(req);
      expect(res.status).toBe(400);
    });

    it('should require userId or guestId', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'system',
          title: 'No Recipient',
          message: 'Missing recipient',
        },
      });
      const res = await postNotification(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/notifications', () => {
    it('should mark a notification as read', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          action: 'read',
          notificationId: createdNotificationId,
        },
      });
      const res = await putNotification(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('read');
    });

    it('should mark all notifications as read', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { markAllRead: true },
      });
      const res = await putNotification(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should dismiss a notification', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          action: 'dismiss',
          notificationId: createdNotificationId,
        },
      });
      const res = await putNotification(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('DELETE /api/notifications', () => {
    it('should require notification id', async () => {
      const url = buildUrl('/api/notifications');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteNotification(req);
      expect(res.status).toBe(400);
    });
  });
});

describe('Notifications List API', () => {
  describe('GET /api/notifications/list', () => {
    it('should return paginated notifications', async () => {
      const url = buildUrl('/api/notifications/list', { page: '1', limit: '10' });
      const req = await createAuthRequest(url);
      const res = await getNotificationsList(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.notifications).toBeDefined();
      expect(data.data.total).toBeDefined();
      expect(data.data.unreadCount).toBeDefined();
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination).toHaveProperty('page');
      expect(data.data.pagination).toHaveProperty('limit');
      expect(data.data.pagination).toHaveProperty('hasMore');
    });

    it('should filter unread notifications', async () => {
      const url = buildUrl('/api/notifications/list', { unread: 'true' });
      const req = await createAuthRequest(url);
      const res = await getNotificationsList(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // All returned notifications should be unread
      for (const n of data.data.notifications) {
        expect(n.read).toBe(false);
      }
    });

    it('should map notification fields correctly', async () => {
      const url = buildUrl('/api/notifications/list', { limit: '1' });
      const req = await createAuthRequest(url);
      const res = await getNotificationsList(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.notifications.length > 0) {
        const n = data.data.notifications[0];
        expect(n).toHaveProperty('id');
        expect(n).toHaveProperty('type');
        expect(n).toHaveProperty('title');
        expect(n).toHaveProperty('description');
        expect(n).toHaveProperty('timestamp');
        expect(n).toHaveProperty('read');
      }
    });
  });
});

describe('Notifications Create API', () => {
  describe('POST /api/notifications/create', () => {
    it('should create notification for a specific user', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/notifications/create');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          userId: USER_ID,
          type: 'system',
          title: `Direct Create ${suffix}`,
          message: `Body for direct create ${suffix}`,
          priority: 'high',
        },
      });
      const res = await createNotification(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.notification).toBeDefined();
      expect(data.data.notification.id).toBeDefined();
    });

    it('should require title and message', async () => {
      const url = buildUrl('/api/notifications/create');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { userId: USER_ID },
      });
      const res = await createNotification(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent target user', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/notifications/create');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          userId: '00000000-0000-0000-0000-000000000000',
          title: `Bad Target ${suffix}`,
          message: 'Target user does not exist',
        },
      });
      const res = await createNotification(req);
      expect(res.status).toBe(404);
    });
  });
});

describe('Notification Templates API', () => {
  describe('GET /api/notifications/templates', () => {
    it('should return list of notification templates with stats', async () => {
      const url = buildUrl('/api/notifications/templates');
      const req = await createAuthRequest(url);
      const res = await getTemplates(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.templates).toBeDefined();
      expect(Array.isArray(data.data.templates)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total');
      expect(data.data.stats).toHaveProperty('active');
      expect(data.data.stats).toHaveProperty('emailTemplates');
    });
  });

  describe('POST /api/notifications/templates', () => {
    it('should create a notification template', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/notifications/templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Template ${suffix}`,
          type: 'email',
          category: 'booking',
          subject: `Welcome {{guestName}} ${suffix}`,
          body: `Dear {{guestName}}, your booking {{bookingCode}} is confirmed.`,
          variables: ['guestName', 'bookingCode'],
          status: 'active',
        },
      });
      const res = await createTemplate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Template');
      expect(data.data.type).toBe('email');
      expect(data.data.status).toBe('active');
      createdTemplateId = data.data.id;
    });

    it('should require name, type, and body', async () => {
      const url = buildUrl('/api/notifications/templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Fields' },
      });
      const res = await createTemplate(req);
      expect(res.status).toBe(400);
    });

    it('should reject duplicate template name', async () => {
      const url = buildUrl('/api/notifications/templates');
      const dupName = `Dup Template ${uniqueSuffix().slice(-8)}`;
      const dupCategory = `dup_test_${uniqueSuffix().slice(-6)}`;
      // Create first
      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { name: dupName, type: 'email', category: dupCategory, body: 'First template' },
      });
      const res1 = await createTemplate(req1);
      expect(res1.status).toBe(200);
      // Try duplicate with same name but different type
      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { name: dupName, type: 'sms', category: `${dupCategory}_b`, body: 'Second template' },
      });
      const res2 = await createTemplate(req2);
      // Same name → route returns 400 before hitting the DB unique constraint
      expect(res2.status).toBe(400);
      // Clean up both templates
      const data1 = await res1.json();
      if (data1?.data?.id) {
        await db.notificationTemplate.delete({ where: { id: data1.data.id } }).catch(() => {});
      }
    });
  });
});

describe('Notification Settings API', () => {
  describe('GET /api/notifications/settings', () => {
    it('should return notification settings', async () => {
      const url = buildUrl('/api/notifications/settings');
      const req = await createAuthRequest(url);
      const res = await getSettings(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('email');
      expect(data.data).toHaveProperty('sms');
      expect(data.data).toHaveProperty('push');
      expect(data.data).toHaveProperty('inApp');
      expect(data.data).toHaveProperty('triggers');
      expect(data.data).toHaveProperty('quietHours');
    });

    it('should include email provider settings', async () => {
      const url = buildUrl('/api/notifications/settings');
      const req = await createAuthRequest(url);
      const res = await getSettings(req);
      const data = await res.json();
      expect(data.data.email).toHaveProperty('enabled');
      expect(data.data.email).toHaveProperty('provider');
      expect(data.data.email).toHaveProperty('fromAddress');
    });
  });
});

describe('Notification Delivery Logs API', () => {
  describe('GET /api/notifications/delivery-logs', () => {
    it('should return delivery logs with stats', async () => {
      const url = buildUrl('/api/notifications/delivery-logs');
      const req = await createAuthRequest(url);
      const res = await getDeliveryLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.logs).toBeDefined();
      expect(data.data.total).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total');
      expect(data.data.stats).toHaveProperty('delivered');
      expect(data.data.stats).toHaveProperty('failed');
      expect(data.data.stats).toHaveProperty('deliveryRate');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/notifications/delivery-logs', { status: 'delivered' });
      const req = await createAuthRequest(url);
      const res = await getDeliveryLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.logs).toBeDefined();
    });

    it('should filter by channel type', async () => {
      const url = buildUrl('/api/notifications/delivery-logs', { type: 'email' });
      const req = await createAuthRequest(url);
      const res = await getDeliveryLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

describe('Notification Test Diagnostics API', () => {
  describe('GET /api/notifications/test', () => {
    it('should return diagnostic info', async () => {
      const url = buildUrl('/api/notifications/test');
      const req = await createAuthRequest(url);
      const res = await getNotificationDiagnostics(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.user).toBeDefined();
      expect(data.data.user).toHaveProperty('id');
      expect(data.data.user).toHaveProperty('tenantId');
      expect(data.data.notifications).toBeDefined();
      expect(data.data.notifications).toHaveProperty('total');
      expect(data.data.notifications).toHaveProperty('unread');
      expect(data.data.pipeline).toBeDefined();
      expect(data.data.pipeline.steps).toBeDefined();
      expect(Array.isArray(data.data.pipeline.steps)).toBe(true);
    });
  });
});

afterAll(async () => {
  if (createdTemplateId) {
    await db.notificationTemplate.delete({ where: { id: createdTemplateId } }).catch(() => {});
  }
  // Clean up test notifications created in this test file
  if (createdNotificationId) {
    await db.notification.delete({ where: { id: createdNotificationId } }).catch(() => {});
  }
});
