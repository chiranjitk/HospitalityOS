import { describe, it, expect, afterAll } from 'vitest';
import { GET as getCasinoTables, POST as postCasinoTable } from '@/app/api/resort/casino/tables/route';
import { GET as getCasinoTransactions, POST as postCasinoTransaction } from '@/app/api/resort/casino/transactions/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let tableId: string;
let transactionId: string;

describe('Casino API', () => {
  // ─── POST /api/resort/casino/tables ───
  describe('POST /api/resort/casino/tables', () => {
    it('should create a new casino table', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/resort/casino/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Royal Poker Table ${suffix.slice(-4)}`,
          gameType: 'poker',
          tableNumber: 99,
          minBet: 500,
          maxBet: 50000,
          status: 'open',
          dealerName: `Dealer ${suffix.slice(-4)}`,
        },
      });
      const res = await postCasinoTable(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Royal Poker Table');
      expect(data.data.gameType).toBe('poker');
      expect(data.data.tableNumber).toBe(99);
      expect(data.data.minBet).toBe(500);
      expect(data.data.maxBet).toBe(50000);
      expect(data.data.status).toBe('open');
      expect(data.data.isActive).toBe(true);
      tableId = data.data.id;
    });

    it('should create a blackjack table', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/resort/casino/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `VIP Blackjack ${suffix.slice(-4)}`,
          gameType: 'blackjack',
          tableNumber: 88,
          minBet: 1000,
          maxBet: 100000,
          status: 'open',
        },
      });
      const res = await postCasinoTable(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.gameType).toBe('blackjack');
      // Clean up this extra table too
      await db.casinoTransaction.deleteMany({ where: { tableId: data.data.id } });
      await db.casinoTable.deleteMany({ where: { id: data.data.id } });
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/resort/casino/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Incomplete Table' },
      });
      const res = await postCasinoTable(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  // ─── GET /api/resort/casino/tables ───
  describe('GET /api/resort/casino/tables', () => {
    it('should return list of casino tables with stats and pagination', async () => {
      const url = buildUrl('/api/resort/casino/tables');
      const req = await createAuthRequest(url);
      const res = await getCasinoTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.openTables).toBe('number');
      expect(typeof data.stats.totalTables).toBe('number');
      expect(typeof data.stats.todayRevenue).toBe('number');
      expect(data.stats.gameTypeBreakdown).toBeDefined();
      expect(Array.isArray(data.stats.gameTypeBreakdown)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
    });

    it('should filter tables by gameType', async () => {
      const url = buildUrl('/api/resort/casino/tables', { gameType: 'poker' });
      const req = await createAuthRequest(url);
      const res = await getCasinoTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter tables by propertyId', async () => {
      const url = buildUrl('/api/resort/casino/tables', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getCasinoTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter tables by status', async () => {
      const url = buildUrl('/api/resort/casino/tables', { status: 'open' });
      const req = await createAuthRequest(url);
      const res = await getCasinoTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ─── POST /api/resort/casino/transactions ───
  describe('POST /api/resort/casino/transactions', () => {
    it('should create a chip buy transaction', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tableId,
          transactionType: 'chip_buy',
          amount: 10000,
          currency: 'INR',
          chipColor: 'black',
        },
      });
      const res = await postCasinoTransaction(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.tableId).toBe(tableId);
      expect(data.data.transactionType).toBe('chip_buy');
      expect(data.data.amount).toBe(10000);
      expect(data.data.chipColor).toBe('black');
      expect(data.data.table).toBeDefined();
      expect(data.data.table.name).toBeDefined();
      expect(data.data.table.gameType).toBeDefined();
      transactionId = data.data.id;
    });

    it('should create a win/payout transaction', async () => {
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tableId,
          transactionType: 'win',
          amount: 5000,
          currency: 'INR',
        },
      });
      const res = await postCasinoTransaction(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.transactionType).toBe('win');
      expect(data.data.amount).toBe(5000);
    });

    it('should create a bet transaction', async () => {
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tableId,
          transactionType: 'bet',
          amount: 2000,
          currency: 'INR',
        },
      });
      const res = await postCasinoTransaction(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.transactionType).toBe('bet');
      expect(data.data.amount).toBe(2000);
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { amount: 5000 },
      });
      const res = await postCasinoTransaction(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should return 404 when table does not belong to tenant', async () => {
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tableId: '00000000-0000-0000-0000-000000000000',
          transactionType: 'chip_buy',
          amount: 5000,
        },
      });
      const res = await postCasinoTransaction(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  // ─── GET /api/resort/casino/transactions ───
  describe('GET /api/resort/casino/transactions', () => {
    it('should return list of casino transactions with stats and pagination', async () => {
      const url = buildUrl('/api/resort/casino/transactions');
      const req = await createAuthRequest(url);
      const res = await getCasinoTransactions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.todayChipBuy).toBe('number');
      expect(typeof data.stats.todayChipCash).toBe('number');
      expect(typeof data.stats.todayPayouts).toBe('number');
      expect(typeof data.stats.todayTotalBets).toBe('number');
      expect(typeof data.stats.todayComps).toBe('number');
      expect(typeof data.stats.todayTransactionCount).toBe('number');
      expect(typeof data.stats.todayNetRevenue).toBe('number');
      expect(data.stats.typeBreakdown).toBeDefined();
      expect(Array.isArray(data.stats.typeBreakdown)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
    });

    it('should filter transactions by tableId', async () => {
      const url = buildUrl('/api/resort/casino/transactions', { tableId });
      const req = await createAuthRequest(url);
      const res = await getCasinoTransactions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      if (data.data.length > 0) {
        expect(data.data[0].tableId).toBe(tableId);
      }
    });

    it('should filter transactions by transactionType', async () => {
      const url = buildUrl('/api/resort/casino/transactions', { transactionType: 'chip_buy' });
      const req = await createAuthRequest(url);
      const res = await getCasinoTransactions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        data.data.forEach((t: any) => {
          expect(t.transactionType).toBe('chip_buy');
        });
      }
    });

    it('should include table details in transactions', async () => {
      const url = buildUrl('/api/resort/casino/transactions', { tableId });
      const req = await createAuthRequest(url);
      const res = await getCasinoTransactions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0].table).toBeDefined();
        expect(data.data[0].table.id).toBeDefined();
        expect(data.data[0].table.name).toBeDefined();
        expect(data.data[0].table.gameType).toBeDefined();
      }
    });
  });

  afterAll(async () => {
    if (tableId) {
      await db.casinoTransaction.deleteMany({ where: { tableId } });
      await db.casinoTable.deleteMany({ where: { id: tableId } });
    }
  });
});
