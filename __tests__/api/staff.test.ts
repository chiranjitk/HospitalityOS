import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { GET as getShifts, POST as createShift } from '@/app/api/staff/shifts/route';
import { GET as getAttendance, POST as clockAttendance } from '@/app/api/staff/attendance/route';
import { GET as getLeave, POST as createLeave, PUT as updateLeave, DELETE as deleteLeave } from '@/app/api/staff/leave/route';
import {
  createAuthRequest,
  buildUrl,
  USER_ID,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track IDs for cleanup
const createdShiftIds: string[] = [];
const createdAttendanceIds: string[] = [];
const createdLeaveIds: string[] = [];
let auxiliaryUserId: string;

// Helper: create a secondary user for shift/leave tests
async function createAuxUser() {
  const suffix = uniqueSuffix();
  const user = await db.user.create({
    data: {
      tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b', // TENANT_ID from test-helpers
      email: `staff-${suffix}@test.com`,
      firstName: `Staff${suffix.slice(-4)}`,
      lastName: 'Test',
      department: 'housekeeping',
      jobTitle: 'Room Attendant',
      status: 'active',
      passwordHash: 'not-a-real-hash',
    },
  });
  auxiliaryUserId = user.id;
  return user;
}

describe('Staff API', () => {
  beforeAll(async () => {
    // Create an auxiliary staff user for shift and leave tests
    await createAuxUser();
  });

  // ─── Shifts ──────────────────────────────────────────────────────

  describe('GET /api/staff/shifts', () => {
    it('should return list of shifts with stats', async () => {
      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url);
      const res = await getShifts(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.shifts)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.total).toBe('number');
      expect(typeof data.stats.scheduled).toBe('number');
      expect(typeof data.stats.completed).toBe('number');
    });

    it('should filter by staffId', async () => {
      const url = buildUrl('/api/staff/shifts', { staffId: USER_ID });
      const req = await createAuthRequest(url);
      const res = await getShifts(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by department', async () => {
      const url = buildUrl('/api/staff/shifts', { department: 'housekeeping' });
      const req = await createAuthRequest(url);
      const res = await getShifts(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/staff/shifts', { status: 'scheduled' });
      const req = await createAuthRequest(url);
      const res = await getShifts(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.shifts.forEach((s: any) => {
        expect(s.status).toBe('scheduled');
      });
    });

    it('should respect limit parameter', async () => {
      const url = buildUrl('/api/staff/shifts', { limit: '2' });
      const req = await createAuthRequest(url);
      const res = await getShifts(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.shifts.length).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/staff/shifts', () => {
    it('should create a new shift', async () => {
      // Use a future date to avoid collisions
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const dateStr = futureDate.toISOString().split('T')[0];

      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          staffId: auxiliaryUserId,
          date: dateStr,
          startTime: '09:00',
          endTime: '17:00',
          department: 'housekeeping',
          notes: 'Test shift for integration tests',
          propertyId: PROPERTY_ID,
        },
      });
      const res = await createShift(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.shift).toBeDefined();
      expect(data.shift.id).toBeDefined();
      expect(data.shift.staffId).toBe(auxiliaryUserId);
      expect(data.shift.startTime).toBe('09:00');
      expect(data.shift.endTime).toBe('17:00');
      expect(data.shift.status).toBe('scheduled');
      expect(data.shift.staff).toBeDefined();
      expect(data.shift.staff.id).toBe(auxiliaryUserId);
      createdShiftIds.push(data.shift.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { startTime: '09:00' }, // missing staffId, date, endTime
      });
      const res = await createShift(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid time format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 70);
      const dateStr = futureDate.toISOString().split('T')[0];

      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          staffId: auxiliaryUserId,
          date: dateStr,
          startTime: '9am', // invalid
          endTime: '17:00',
        },
      });
      const res = await createShift(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_TIME_FORMAT');
    });

    it('should reject start time after end time', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 80);
      const dateStr = futureDate.toISOString().split('T')[0];

      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          staffId: auxiliaryUserId,
          date: dateStr,
          startTime: '18:00',
          endTime: '09:00',
        },
      });
      const res = await createShift(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_TIME_RANGE');
    });

    it('should reject shift for non-existent staff user', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);
      const dateStr = futureDate.toISOString().split('T')[0];

      const url = buildUrl('/api/staff/shifts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          staffId: '00000000-0000-0000-0000-000000000000',
          date: dateStr,
          startTime: '08:00',
          endTime: '16:00',
        },
      });
      const res = await createShift(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_USER');
    });
  });

  // ─── Attendance ──────────────────────────────────────────────────

  describe('GET /api/staff/attendance', () => {
    it('should return attendance records with stats', async () => {
      const url = buildUrl('/api/staff/attendance');
      const req = await createAuthRequest(url);
      const res = await getAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.records)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalStaff).toBe('number');
      expect(typeof data.stats.presentToday).toBe('number');
      expect(typeof data.stats.absentToday).toBe('number');
      expect(typeof data.stats.lateToday).toBe('number');
      expect(typeof data.stats.avgAttendanceRate).toBe('number');
    });

    it('should filter by staffId', async () => {
      const url = buildUrl('/api/staff/attendance', { staffId: USER_ID });
      const req = await createAuthRequest(url);
      const res = await getAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by department', async () => {
      const url = buildUrl('/api/staff/attendance', { department: 'housekeeping' });
      const req = await createAuthRequest(url);
      const res = await getAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const url = buildUrl('/api/staff/attendance', { limit: '3' });
      const req = await createAuthRequest(url);
      const res = await getAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.records.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /api/staff/attendance', () => {
    it('should clock in the current user', async () => {
      const url = buildUrl('/api/staff/attendance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'clock_in',
          notes: 'Test clock in from integration tests',
        },
      });
      const res = await clockAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.record).toBeDefined();
      expect(data.record.id).toBeDefined();
      expect(data.record.status).toMatch(/present|late/);
      expect(data.record.checkIn).toBeDefined();
      createdAttendanceIds.push(data.record.id);
    });

    it('should clock out the current user', async () => {
      const url = buildUrl('/api/staff/attendance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'clock_out',
          notes: 'Test clock out',
        },
      });
      const res = await clockAttendance(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.record.checkOut).toBeDefined();
    });

    it('should reject invalid type', async () => {
      const url = buildUrl('/api/staff/attendance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { type: 'invalid_type' },
      });
      const res = await clockAttendance(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject clocking in for non-existent staff', async () => {
      const url = buildUrl('/api/staff/attendance');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          staffId: '00000000-0000-0000-0000-000000000000',
          type: 'clock_in',
        },
      });
      const res = await clockAttendance(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_USER');
    });
  });

  // ─── Leave ───────────────────────────────────────────────────────

  describe('GET /api/staff/leave', () => {
    it('should return list of leave requests with stats and pagination', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url);
      const res = await getLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.leaves)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
      expect(typeof data.pagination.totalPages).toBe('number');
      expect(typeof data.pagination.page).toBe('number');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/staff/leave', { status: 'pending' });
      const req = await createAuthRequest(url);
      const res = await getLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.leaves.forEach((l: any) => {
        expect(l.status).toBe('pending');
      });
    });

    it('should filter by userId', async () => {
      const url = buildUrl('/api/staff/leave', { userId: USER_ID });
      const req = await createAuthRequest(url);
      const res = await getLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by leaveType', async () => {
      const url = buildUrl('/api/staff/leave', { leaveType: 'vacation' });
      const req = await createAuthRequest(url);
      const res = await getLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      data.leaves.forEach((l: any) => {
        expect(l.leaveType).toBe('vacation');
      });
    });

    it('should respect pagination parameters', async () => {
      const url = buildUrl('/api/staff/leave', { page: '1', limit: '3' });
      const req = await createAuthRequest(url);
      const res = await getLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.leaves.length).toBeLessThanOrEqual(3);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(3);
    });
  });

  describe('POST /api/staff/leave', () => {
    it('should create a sick leave request', async () => {
      const suffix = uniqueSuffix();
      // Use future dates far out to avoid overlap with other tests
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 120);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          leaveType: 'sick',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: `Feeling unwell ${suffix}`,
          notes: 'Need to rest and recover.',
        },
      });
      const res = await createLeave(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leave).toBeDefined();
      expect(data.leave.id).toBeDefined();
      expect(data.leave.leaveType).toBe('sick');
      expect(data.leave.status).toBe('pending');
      expect(data.leave.totalDays).toBe(2);
      expect(data.leave.staff).toBeDefined();
      expect(typeof data.leave.balanceDeduction).toBe('number');
      expect(typeof data.leave.remainingBalance).toBe('number');
      createdLeaveIds.push(data.leave.id);
    });

    it('should create a vacation leave request', async () => {
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 150);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 4);

      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          leaveType: 'vacation',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: `Family trip ${suffix}`,
        },
      });
      const res = await createLeave(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leave.leaveType).toBe('vacation');
      expect(data.leave.totalDays).toBe(5);
      createdLeaveIds.push(data.leave.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { leaveType: 'sick' }, // missing startDate and endDate
      });
      const res = await createLeave(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid leave type', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          leaveType: 'unpaid',
          startDate: '2025-12-01',
          endDate: '2025-12-02',
        },
      });
      const res = await createLeave(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid leave type');
    });

    it('should reject start date after end date', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          leaveType: 'personal',
          startDate: '2025-12-10',
          endDate: '2025-12-05',
        },
      });
      const res = await createLeave(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Start date must be before end date');
    });
  });

  describe('PUT /api/staff/leave', () => {
    it('should approve a pending leave request', async () => {
      // Create a leave first
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 180);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const createUrl = buildUrl('/api/staff/leave');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          leaveType: 'personal',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: `Personal errands ${suffix}`,
        },
      });
      const createRes = await createLeave(createReq as any);
      const createData = await createRes.json();
      const leaveId = createData.leave.id;
      createdLeaveIds.push(leaveId);

      // Approve it
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          leaveId,
          action: 'approve',
        },
      });
      const res = await updateLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leave.status).toBe('approved');
      expect(data.leave.approvedAt).toBeDefined();
      expect(data.leave.approver).toBeDefined();
    });

    it('should reject a pending leave request', async () => {
      // Create a leave first
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 200);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const createUrl = buildUrl('/api/staff/leave');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          leaveType: 'vacation',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: `Reject test ${suffix}`,
        },
      });
      const createRes = await createLeave(createReq as any);
      const createData = await createRes.json();
      const leaveId = createData.leave.id;
      createdLeaveIds.push(leaveId);

      // Reject it
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          leaveId,
          action: 'reject',
          rejectionReason: 'Not enough notice given.',
        },
      });
      const res = await updateLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leave.status).toBe('rejected');
      expect(data.leave.rejectionReason).toBe('Not enough notice given.');
    });

    it('should return 400 for missing required fields', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { action: 'approve' }, // missing leaveId
      });
      const res = await updateLeave(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { leaveId: 'some-id', action: 'cancel' },
      });
      const res = await updateLeave(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent leave', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          leaveId: '00000000-0000-0000-0000-000000000000',
          action: 'approve',
        },
      });
      const res = await updateLeave(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/staff/leave', () => {
    it('should cancel a pending leave request', async () => {
      // Create a pending leave
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 220);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const createUrl = buildUrl('/api/staff/leave');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          leaveType: 'personal',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: `Cancel test ${suffix}`,
        },
      });
      const createRes = await createLeave(createReq as any);
      const createData = await createRes.json();
      const leaveId = createData.leave.id;

      // Cancel it
      const url = buildUrl('/api/staff/leave', { id: leaveId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteLeave(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('cancelled');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/staff/leave');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteLeave(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent leave', async () => {
      const url = buildUrl('/api/staff/leave', {
        id: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteLeave(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── Cleanup ─────────────────────────────────────────────────────

  afterAll(async () => {
    // Clean up shifts
    for (const id of createdShiftIds) {
      try {
        await db.staffSchedule.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
    // Clean up attendance records
    for (const id of createdAttendanceIds) {
      try {
        await db.staffAttendance.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
    // Clean up leave requests
    for (const id of createdLeaveIds) {
      try {
        await db.staffLeave.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
    // Clean up auxiliary user
    if (auxiliaryUserId) {
      try {
        await db.user.delete({ where: { id: auxiliaryUserId } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
