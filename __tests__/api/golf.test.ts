import { describe, it, expect, afterAll } from 'vitest';
import { GET as getCourses, POST as postCourse } from '@/app/api/experience/golf/courses/route';
import { GET as getTeeTimes, POST as postTeeTime } from '@/app/api/experience/golf/tee-times/route';
import { GET as getMemberships, POST as postMembership } from '@/app/api/experience/golf/memberships/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let courseId: string;
let teeTimeId: string;
let membershipId: string;

describe('Golf API', () => {
  // ─── POST /api/experience/golf/courses ───
  describe('POST /api/experience/golf/courses', () => {
    it('should create a new golf course', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experience/golf/courses');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Championship Course ${suffix}`,
          description: 'A test golf course for integration testing',
          holes: 18,
          par: 72,
          yardage: 7200,
          difficulty: 'advanced',
          propertyId: PROPERTY_ID,
          facilities: ['clubhouse', 'driving_range', 'pro_shop'],
        },
      });
      const res = await postCourse(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Championship Course');
      expect(data.data.par).toBe(72);
      expect(data.data.holes).toBe(18);
      expect(data.data.difficulty).toBe('advanced');
      courseId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/experience/golf/courses');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Incomplete Course' },
      });
      const res = await postCourse(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });
  });

  // ─── GET /api/experience/golf/courses ───
  describe('GET /api/experience/golf/courses', () => {
    it('should return list of golf courses', async () => {
      const url = buildUrl('/api/experience/golf/courses');
      const req = await createAuthRequest(url);
      const res = await getCourses(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter courses by propertyId', async () => {
      const url = buildUrl('/api/experience/golf/courses', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getCourses(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ─── POST /api/experience/golf/tee-times ───
  describe('POST /api/experience/golf/tee-times', () => {
    it('should create a new tee time', async () => {
      const suffix = uniqueSuffix();
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
      const endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 20, 0);

      const url = buildUrl('/api/experience/golf/tee-times');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          courseId,
          date: date.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          players: 2,
          maxPlayers: 4,
          holes: 18,
          greenFee: 5000,
          cartFee: 1000,
          totalAmount: 6000,
          status: 'booked',
          guestName: `Test Golfer ${suffix}`,
          notes: 'Test tee time booking',
        },
      });
      const res = await postTeeTime(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('booked');
      expect(data.data.players).toBe(2);
      expect(data.data.golfCourse).toBeDefined();
      teeTimeId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/experience/golf/tee-times');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { players: 2 },
      });
      const res = await postTeeTime(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });
  });

  // ─── GET /api/experience/golf/tee-times ───
  describe('GET /api/experience/golf/tee-times', () => {
    it('should return list of tee times', async () => {
      const url = buildUrl('/api/experience/golf/tee-times');
      const req = await createAuthRequest(url);
      const res = await getTeeTimes(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter tee times by courseId', async () => {
      const url = buildUrl('/api/experience/golf/tee-times', { courseId });
      const req = await createAuthRequest(url);
      const res = await getTeeTimes(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      if (data.data.length > 0) {
        expect(data.data[0].courseId).toBe(courseId);
      }
    });
  });

  // ─── POST /api/experience/golf/memberships ───
  describe('POST /api/experience/golf/memberships', () => {
    it('should create a new golf membership', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experience/golf/memberships');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Gold Membership ${suffix}`,
          membershipType: 'annual',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          monthlyFee: 5000,
          joiningFee: 25000,
          totalPaid: 50000,
          status: 'active',
          autoRenew: true,
          benefits: ['unlimited_rounds', 'driving_range', 'locker'],
          propertyId: PROPERTY_ID,
        },
      });
      const res = await postMembership(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Gold Membership');
      expect(data.data.membershipType).toBe('annual');
      expect(data.data.status).toBe('active');
      membershipId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/experience/golf/memberships');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Incomplete Membership' },
      });
      const res = await postMembership(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });
  });

  // ─── GET /api/experience/golf/memberships ───
  describe('GET /api/experience/golf/memberships', () => {
    it('should return list of golf memberships', async () => {
      const url = buildUrl('/api/experience/golf/memberships');
      const req = await createAuthRequest(url);
      const res = await getMemberships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter memberships by status', async () => {
      const url = buildUrl('/api/experience/golf/memberships', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await getMemberships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data[0].status).toBe('active');
      }
    });
  });

  afterAll(async () => {
    if (membershipId) {
      await db.golfMembership.deleteMany({ where: { id: membershipId } });
    }
    if (teeTimeId) {
      await db.golfTeeTime.deleteMany({ where: { id: teeTimeId } });
    }
    if (courseId) {
      await db.golfCourse.deleteMany({ where: { id: courseId } });
    }
  });
});
