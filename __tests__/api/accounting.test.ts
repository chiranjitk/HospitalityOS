import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/accounting/bank-accounts/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdBankAccountId: string;

describe('Accounting Bank Accounts API', () => {
  describe('GET /api/accounting/bank-accounts', () => {
    it('should return list of bank accounts', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.accounts).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.stats).toBeDefined();
    });

    it('should include stats with balance information', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toHaveProperty('totalAccounts');
      expect(data.stats).toHaveProperty('activeAccounts');
      expect(data.stats).toHaveProperty('totalBalance');
      expect(typeof data.stats.totalBalance).toBe('number');
    });

    it('should support pagination parameters', async () => {
      const url = buildUrl('/api/accounting/bank-accounts', { page: '1', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/accounting/bank-accounts', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.accounts.length > 0) {
        expect(data.accounts.every((acc: any) => acc.status === 'active')).toBe(true);
      }
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/accounting/bank-accounts', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.accounts).toBeInstanceOf(Array);
    });

    it('should include transaction and reconciliation counts', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.accounts.length > 0) {
        expect(data.accounts[0]).toHaveProperty('_count');
        expect(data.accounts[0]._count).toHaveProperty('transactions');
        expect(data.accounts[0]._count).toHaveProperty('reconciliations');
      }
    });
  });

  describe('POST /api/accounting/bank-accounts', () => {
    it('should create a bank account with valid data', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          accountName: `Test Account ${suffix.slice(-6)}`,
          accountNumber: `12345678${suffix.slice(-4)}`,
          bankName: 'Test Bank',
          bankCode: 'TSTB001',
          accountType: 'checking',
          currency: 'INR',
          openingBalance: 50000,
          isDefault: false,
          notes: 'Created by API test',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.accountName).toContain('Test Account');
      expect(data.bankName).toBe('Test Bank');
      expect(data.accountType).toBe('checking');
      expect(data.currency).toBe('INR');
      expect(data.openingBalance).toBe(50000);
      expect(data.currentBalance).toBe(50000);
      expect(data.status).toBe('active');
      // Account number should be masked
      expect(data.accountNumber).toContain('****');
      createdBankAccountId = data.id;
    });

    it('should mask account number showing last 4 digits', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          accountName: `Mask Test ${suffix.slice(-6)}`,
          accountNumber: '9876543210',
          bankName: 'Mask Bank',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.accountNumber).toBe('****3210');
      // Clean up
      await db.bankAccount.delete({ where: { id: data.id } });
    });

    it('should reject creation with missing required fields', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          accountName: 'Missing fields test',
          // missing accountNumber and bankName
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject creation with short account number', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          accountName: 'Short Number',
          accountNumber: '123',
          bankName: 'Test Bank',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should set currency default to USD', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          accountName: `Default Currency ${suffix.slice(-6)}`,
          accountNumber: '1111222233334444',
          bankName: 'Default Bank',
          // no currency specified
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.currency).toBe('USD');
      // Clean up
      await db.bankAccount.delete({ where: { id: data.id } });
    });
  });

  describe('PUT /api/accounting/bank-accounts', () => {
    it('should update an existing bank account', async () => {
      // First create one
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/accounting/bank-accounts');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          accountName: `Update Test ${suffix.slice(-6)}`,
          accountNumber: '5555666677778888',
          bankName: 'Update Bank',
        },
      });
      const createRes = await POST(createReq);
      const created = await createRes.json();
      expect(createRes.status).toBe(201);

      // Now update it
      const updateUrl = buildUrl('/api/accounting/bank-accounts');
      const updateReq = await createAuthRequest(updateUrl, {
        method: 'PUT',
        body: {
          id: created.id,
          accountName: `Updated ${suffix.slice(-6)}`,
          notes: 'Updated by test',
        },
      });
      const updateRes = await PUT(updateReq);
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.accountName).toContain('Updated');
      expect(updated.notes).toBe('Updated by test');

      // Clean up
      await db.bankAccount.delete({ where: { id: created.id } });
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          accountName: 'No ID update',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent account', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: fakeId,
          accountName: 'Ghost account',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/accounting/bank-accounts', () => {
    it('should soft delete a bank account', async () => {
      // Create a test account
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/accounting/bank-accounts');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          accountName: `Delete Test ${suffix.slice(-6)}`,
          accountNumber: '9999888877776666',
          bankName: 'Delete Bank',
        },
      });
      const createRes = await POST(createReq);
      const created = await createRes.json();
      expect(createRes.status).toBe(201);

      // Delete it
      const deleteUrl = buildUrl('/api/accounting/bank-accounts', { id: created.id });
      const deleteReq = await createAuthRequest(deleteUrl, {
        method: 'DELETE',
      });
      const deleteRes = await DELETE(deleteReq);
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);

      // Verify it's soft-deleted
      const account = await db.bankAccount.findUnique({ where: { id: created.id } });
      expect(account).not.toBeNull();
      expect(account?.deletedAt).not.toBeNull();
      expect(account?.status).toBe('closed');
    });

    it('should reject delete without id parameter', async () => {
      const url = buildUrl('/api/accounting/bank-accounts');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent account', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/accounting/bank-accounts', { id: fakeId });
      const req = await createAuthRequest(url, {
        method: 'DELETE',
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (createdBankAccountId) {
      try {
        await db.bankAccount.delete({ where: { id: createdBankAccountId } });
      } catch (e) {
        // May already be soft-deleted, try hard delete
        try {
          await db.bankAccount.deleteMany({ where: { id: createdBankAccountId } });
        } catch (e2) {
          console.error('Cleanup failed for bank account:', e2);
        }
      }
    }
  });
});
