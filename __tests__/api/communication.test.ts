import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT } from '@/app/api/communication/conversations/route';
import { GET as getTemplates, POST as createTemplate, PUT as updateTemplate, DELETE as deleteTemplate } from '@/app/api/communication/templates/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdConversationId: string;
let createdTemplateId: string;

describe('Communication — Conversations List', () => {
  describe('GET /api/communication/conversations', () => {
    it('should return list of conversations with stats', async () => {
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('open');
      expect(data.stats).toHaveProperty('pending');
      expect(data.stats).toHaveProperty('resolved');
      expect(data.stats).toHaveProperty('totalUnread');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/communication/conversations', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by guestId', async () => {
      const url = buildUrl('/api/communication/conversations', { guestId: GUEST_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/communication/conversations', { status: 'open' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should filter by channel', async () => {
      const url = buildUrl('/api/communication/conversations', { channel: 'sms' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/communication/conversations', { limit: '5', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.limit).toBe(5);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/communication/conversations');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Communication — Conversations Create', () => {
  describe('POST /api/communication/conversations', () => {
    it('should create a new conversation', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestId: GUEST_ID,
          channel: 'app',
          subject: `Test Conversation ${suffix.slice(-4)}`,
          priority: 'normal',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('open');
      expect(data.data.subject).toContain('Test Conversation');
      expect(data.data.priority).toBe('normal');
      expect(data.data.tags).toBe('[]');
      createdConversationId = data.data.id;
    });

    it('should require propertyId', async () => {
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { guestId: GUEST_ID },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Property ID');
    });

    it('should reject invalid propertyId', async () => {
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          guestId: GUEST_ID,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/communication/conversations');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: PROPERTY_ID }),
      }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Communication — Conversations Update', () => {
  describe('PUT /api/communication/conversations', () => {
    it('should update conversation status', async () => {
      if (!createdConversationId) return;
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdConversationId,
          status: 'resolved',
          priority: 'high',
          tags: ['test', 'automated'],
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('resolved');
      expect(data.data.priority).toBe('high');
    });

    it('should require conversation id', async () => {
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'closed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent conversation', async () => {
      const url = buildUrl('/api/communication/conversations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'closed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });
});

describe('Communication — Templates', () => {
  describe('GET /api/communication/templates', () => {
    it('should return list of message templates with stats', async () => {
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url);
      const res = await getTemplates(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('byChannel');
      expect(data.stats).toHaveProperty('byCategory');
      expect(data.stats).toHaveProperty('quickReplies');
    });

    it('should filter by channel', async () => {
      const url = buildUrl('/api/communication/templates', { channel: 'email' });
      const req = await createAuthRequest(url);
      const res = await getTemplates(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/communication/templates', { category: 'welcome' });
      const req = await createAuthRequest(url);
      const res = await getTemplates(req);
      expect(res.status).toBe(200);
    });

    it('should filter by isQuickReply', async () => {
      const url = buildUrl('/api/communication/templates', { isQuickReply: 'true' });
      const req = await createAuthRequest(url);
      const res = await getTemplates(req);
      expect(res.status).toBe(200);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/communication/templates');
      const res = await getTemplates(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/communication/templates', () => {
    it('should create a message template', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Template ${suffix.slice(-4)}`,
          category: 'test',
          channel: 'email',
          subject: `Test Subject ${suffix.slice(-4)}`,
          body: `Hello {{guestName}}, this is a test template ${suffix.slice(-4)}.`,
          variables: ['guestName', 'propertyName'],
          isQuickReply: false,
        },
      });
      const res = await createTemplate(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Template');
      expect(data.data.channel).toBe('email');
      expect(data.data.category).toBe('test');
      expect(data.data.isActive).toBe(true);
      expect(Array.isArray(data.data.variables)).toBe(true);
      expect(data.data.variables).toContain('guestName');
      createdTemplateId = data.data.id;
    });

    it('should require name, category, channel, and body', async () => {
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Incomplete Template' },
      });
      const res = await createTemplate(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('required');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/communication/templates');
      const res = await createTemplate(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 't', category: 't', channel: 'email', body: 'b' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/communication/templates', () => {
    it('should update a template', async () => {
      if (!createdTemplateId) return;
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdTemplateId,
          name: 'Updated Test Template',
          isActive: true,
        },
      });
      const res = await updateTemplate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Test Template');
    });

    it('should require template id', async () => {
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Missing ID' },
      });
      const res = await updateTemplate(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent template', async () => {
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await updateTemplate(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/communication/templates', () => {
    it('should delete a template', async () => {
      if (!createdTemplateId) return;
      const url = buildUrl('/api/communication/templates', { id: createdTemplateId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteTemplate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should require template id', async () => {
      const url = buildUrl('/api/communication/templates');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteTemplate(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent template', async () => {
      const url = buildUrl('/api/communication/templates', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteTemplate(req);
      expect(res.status).toBe(404);
    });
  });
});

afterAll(async () => {
  if (createdConversationId) {
    await db.chatConversation.delete({ where: { id: createdConversationId } }).catch(() => {});
  }
  if (createdTemplateId) {
    await db.messageTemplate.delete({ where: { id: createdTemplateId } }).catch(() => {});
  }
  // Clean up any test templates
  await db.messageTemplate.deleteMany({
    where: { name: { contains: 'Test Template' } },
  }).catch(() => {});
});
