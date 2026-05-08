import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/exchange-rates/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Exchange Rates API', () => {
  describe('GET /api/exchange-rates', () => {
    it('should return exchange rates with default USD base', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.base).toBe('USD');
      expect(data.data.rates).toBeDefined();
      expect(data.data.rates).toBeInstanceOf(Object);
      expect(data.data.rates.USD).toBe(1); // base rate
      expect(data.data.supportedCurrencies).toBeInstanceOf(Array);
      expect(data.data.timestamp).toBeDefined();
      expect(data.data.isRealTime).toBeDefined();
      expect(data.data.lastUpdated).toBeDefined();
    });

    it('should return supported currencies with metadata', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const currencies = data.data.supportedCurrencies;
      expect(currencies.length).toBeGreaterThan(0);

      // Check structure of first currency
      const first = currencies[0];
      expect(first).toHaveProperty('code');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('symbol');
      expect(first).toHaveProperty('rate');
      expect(first).toHaveProperty('decimalPlaces');
    });

    it('should include major currencies', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const rates = data.data.rates;
      expect(rates.EUR).toBeDefined();
      expect(rates.GBP).toBeDefined();
      expect(rates.INR).toBeDefined();
      expect(rates.JPY).toBeDefined();
      expect(rates.AED).toBeDefined();
    });

    it('should support non-USD base currency', async () => {
      const url = buildUrl('/api/exchange-rates', { base: 'EUR' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.base).toBe('EUR');
      expect(data.data.rates.EUR).toBeCloseTo(1);
      expect(data.data.rates).toBeInstanceOf(Object);
    });

    it('should return specific conversion rate for target currency', async () => {
      const url = buildUrl('/api/exchange-rates', { base: 'USD', target: 'INR' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.from).toBe('USD');
      expect(data.data.to).toBe('INR');
      expect(typeof data.data.rate).toBe('number');
      expect(data.data.rate).toBeGreaterThan(0);
      expect(data.data.timestamp).toBeDefined();
    });

    it('should return conversion for EUR to GBP', async () => {
      const url = buildUrl('/api/exchange-rates', { base: 'EUR', target: 'GBP' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.from).toBe('EUR');
      expect(data.data.to).toBe('GBP');
      expect(data.data.rate).toBeGreaterThan(0);
    });

    it('should return same rate when base and target are the same', async () => {
      const url = buildUrl('/api/exchange-rates', { base: 'USD', target: 'USD' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.rate).toBe(1);
    });

    it('should sort supported currencies alphabetically', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const currencies = data.data.supportedCurrencies;
      const codes = currencies.map((c: any) => c.code);
      const sorted = [...codes].sort();
      expect(codes).toEqual(sorted);
    });
  });

  describe('POST /api/exchange-rates', () => {
    it('should convert currency amount', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 100,
          from: 'USD',
          to: 'INR',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.originalAmount).toBe(100);
      expect(data.data.originalCurrency).toBe('USD');
      expect(data.data.convertedAmount).toBeGreaterThan(0);
      expect(data.data.targetCurrency).toBe('INR');
      expect(data.data.exchangeRate).toBeGreaterThan(0);
      expect(data.data.timestamp).toBeDefined();
    });

    it('should convert INR to USD', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 8312,
          from: 'INR',
          to: 'USD',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.originalAmount).toBe(8312);
      expect(data.data.originalCurrency).toBe('INR');
      expect(data.data.targetCurrency).toBe('USD');
      expect(data.data.convertedAmount).toBeGreaterThan(0);
      // Should be roughly 100 USD
      expect(data.data.convertedAmount).toBeGreaterThan(50);
    });

    it('should convert EUR to GBP', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 100,
          from: 'EUR',
          to: 'GBP',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.exchangeRate).toBeGreaterThan(0);
    });

    it('should return same amount when converting to same currency', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 500,
          from: 'USD',
          to: 'USD',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.convertedAmount).toBe(500);
      expect(data.data.exchangeRate).toBe(1);
    });

    it('should handle zero amount', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 0,
          from: 'USD',
          to: 'EUR',
        },
      });
      const res = await POST(req);
      // Note: !0 is truthy in JS, so the validation catches this with VALIDATION_ERROR
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 100,
          // missing from and to
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative amount', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: -100,
          from: 'USD',
          to: 'EUR',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('positive');
    });

    it('should reject non-number amount', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 'one hundred',
          from: 'USD',
          to: 'EUR',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should handle large amounts', async () => {
      const url = buildUrl('/api/exchange-rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          amount: 1000000,
          from: 'USD',
          to: 'INR',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.convertedAmount).toBeGreaterThan(1000000);
    });
  });
});
