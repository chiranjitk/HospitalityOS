import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logWifi } from '@/lib/audit';
import { wifiUserService } from '@/lib/wifi/services/wifi-user-service';
import { requirePermission } from '@/lib/auth/tenant-context';
import { z } from 'zod';
import crypto from 'crypto';

// ──────────────────────────────────────────────
// M-48: Zod validation schemas
// ──────────────────────────────────────────────

const createVoucherSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
  guestId: z.string().optional(),
  bookingId: z.string().optional(),
  quantity: z.number().int().min(1).max(100).optional().default(1),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  validityDays: z.number().int().min(1).max(365).optional(),
  notes: z.string().max(500).optional(),
});

const updateVoucherSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional(),
  action: z.enum(['use', 'issue']).optional(),
  guestId: z.string().optional(),
  bookingId: z.string().optional(),
  status: z.string().optional(),
  propertyId: z.string().optional(),
  issuedTo: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
}).refine(d => d.id || d.code, {
  message: 'Either id or code is required',
});

// M-49: In-memory rate limiter for voucher creation (max 20 per user per 15 minutes)
const voucherRateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of voucherRateLimitMap.entries()) {
    if (now > val.resetAt) voucherRateLimitMap.delete(key);
  }
}, 60_000).unref();

function checkVoucherRateLimit(userId: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = voucherRateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    voucherRateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

function formatPlanDuration(plan: { validityMinutes?: number | null; validityDays?: number | null }): string {
  const minutes = plan.validityMinutes || (plan.validityDays || 1) * 1440;
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} day${minutes / 1440 > 1 ? 's' : ''}`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr${minutes / 60 > 1 ? 's' : ''}`;
  return `${minutes} min`;
}

// Helper function to generate voucher code using cryptographically secure random bytes
function generateVoucherCode(): string {
  const bytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${bytes.slice(0, 5)}-${bytes.slice(5, 10)}`;
}

// GET /api/wifi/vouchers - List all WiFi vouchers with filtering and pagination
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const planId = searchParams.get('planId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const isUsed = searchParams.get('isUsed');
    const validFrom = searchParams.get('validFrom');
    const validUntil = searchParams.get('validUntil');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (planId) {
      where.planId = planId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (status) {
      where.status = status;
    }

    if (isUsed !== null && isUsed !== undefined) {
      where.isUsed = isUsed === 'true';
    }

    if (validFrom || validUntil) {
      where.validFrom = {};
      if (validFrom) {
        (where.validFrom as Record<string, unknown>).gte = new Date(validFrom);
      }
      if (validUntil) {
        (where.validUntil as Record<string, unknown>).lte = new Date(validUntil);
      }
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { guestName: { contains: search } },
        { roomNumber: { contains: search } },
      ];
    }

    const vouchers = await db.wiFiVoucher.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            dataLimit: true,
            sessionLimit: true,
            validityDays: true,
            validityMinutes: true,
            price: true,
            currency: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.wiFiVoucher.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.wiFiVoucher.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const usageStats = await db.wiFiVoucher.aggregate({
      where,
      _count: {
        isUsed: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: vouchers,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        totalUsed: usageStats._count.isUsed,
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi vouchers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi vouchers' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/vouchers - Create new WiFi vouchers
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    // M-49: Rate limit check (max 20 voucher creations per user per 15 minutes)
    if (!checkVoucherRateLimit(user.userId, 20, 15 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many voucher creation requests. Please try again later.' } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const tenantId = user.tenantId;

    // M-48: Zod validation
    const parsed = createVoucherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } },
        { status: 400 }
      );
    }
    const {
      planId,
      guestId,
      bookingId,
      quantity = 1,
      validFrom,
      validUntil,
      validityDays,
      notes,
    } = parsed.data;

    // Verify plan exists
    const plan = await db.wiFiPlan.findFirst({
      where: { id: planId, tenantId },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PLAN', message: 'WiFi plan not found' } },
        { status: 400 }
      );
    }

    // Calculate validity dates
    const voucherValidFrom = validFrom ? new Date(validFrom) : new Date();
    const voucherValidityMinutes = validityDays
      ? validityDays * 1440
      : (plan.validityMinutes || plan.validityDays * 1440);
    const voucherValidUntil = validUntil
      ? new Date(validUntil)
      : new Date(voucherValidFrom.getTime() + voucherValidityMinutes * 60 * 1000);

    // Generate unique voucher codes with retry on unique constraint violation
    const vouchers: any[] = [];
    const MAX_RETRIES = 3;

    // Create vouchers with retry logic for unique constraint (P2002)
    let codesGenerated = 0;
    while (codesGenerated < quantity) {
      let currentCode = generateVoucherCode();
      let retries = 0;
       
      let voucher: any = null;

      while (retries < MAX_RETRIES) {
        try {
          voucher = await db.wiFiVoucher.create({
            data: {
              tenantId,
              planId,
              guestId,
              bookingId,
              code: currentCode,
              validFrom: voucherValidFrom,
              validUntil: voucherValidUntil,
              status: 'active',
              notes: notes || null,
            },
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  downloadSpeed: true,
                  uploadSpeed: true,
                  validityDays: true,
                  validityMinutes: true,
                },
              },
            },
          });
          break; // Success, exit retry loop
        } catch (createError: unknown) {
          const prismaError = createError as { code?: string };
          if (prismaError.code === 'P2002') {
            // Unique constraint violation - generate new code and retry
            retries++;
            currentCode = generateVoucherCode();
          } else {
            throw createError; // Re-throw non-constraint errors
          }
        }
      }

      if (!voucher) {
        throw new Error(`Failed to create voucher after ${MAX_RETRIES} retries due to unique constraint conflicts`);
      }

      // ── Create RADIUS radcheck entry so FreeRADIUS can authenticate voucher code ──
      // The voucher code serves as BOTH username and password for RADIUS auth.
      // This is the industry-standard approach for captive portal voucher systems.
      // Uses Prisma ORM (db.radCheck.create) instead of raw SQL — consistent with wifi-user-service.
      try {
        // 1. Cleartext-Password: voucher code is both username AND password
        await db.radCheck.create({
          data: {
            username: currentCode,
            attribute: 'Cleartext-Password',
            op: ':=',
            value: currentCode,
          },
        });

        // 2. Expiration attribute for FreeRADIUS
        await db.radCheck.create({
          data: {
            username: currentCode,
            attribute: 'Expiration',
            op: ':=',
            value: voucherValidUntil.toISOString().split('T')[0], // FreeRADIUS format: YYYY-MM-DD
          },
        });

        // 3. Insert radreply entries for plan enforcement (bandwidth + session timeout)
        if (plan.downloadSpeed) {
          await db.radReply.create({
            data: {
              username: currentCode,
              attribute: 'WISPr-Bandwidth-Max-Down',
              op: '=',
              value: String(plan.downloadSpeed * 1000000), // Mbps to bps
            },
          });
        }
        if (plan.uploadSpeed) {
          await db.radReply.create({
            data: {
              username: currentCode,
              attribute: 'WISPr-Bandwidth-Max-Up',
              op: '=',
              value: String(plan.uploadSpeed * 1000000),
            },
          });
        }
        // Session timeout: explicit plan limit or computed from validity days
        const sessionTimeoutSec = plan.sessionLimit
          ? plan.sessionLimit
          : (plan.validityMinutes || (plan.validityDays || 1) * 1440) * 60;
        await db.radReply.create({
          data: {
            username: currentCode,
            attribute: 'Session-Timeout',
            op: '=',
            value: String(sessionTimeoutSec),
          },
        });

        console.log(`[Voucher] Created RADIUS credentials for voucher ${currentCode}`);
      } catch (radiusError) {
        console.error(`[Voucher] FAILED to create RADIUS credentials for voucher ${currentCode}:`, radiusError);
        // Non-fatal: voucher is created but RADIUS auth won't work until manually synced
      }

      vouchers.push(voucher);
      codesGenerated++;
      
      // Log voucher creation to audit log
      try {
        await logWifi(request, 'voucher_create', 'voucher', voucher.id, {
          code: voucher.code,
          planName: voucher.plan?.name,
          validFrom: voucher.validFrom,
          validUntil: voucher.validUntil,
          guestId,
          bookingId,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }
    }

    return NextResponse.json({
      success: true,
      data: vouchers,
      message: `Created ${vouchers.length} voucher(s) successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi vouchers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi vouchers' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/vouchers - Update or use a voucher
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    // M-48: Zod validation
    const parsed = updateVoucherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } },
        { status: 400 }
      );
    }
    const { id, code, action, guestId, bookingId, status, propertyId } = parsed.data;

    // Find voucher by ID or code (Zod ensures at least one is present)
    let voucher;
    if (id) {
      voucher = await db.wiFiVoucher.findFirst({
        where: { id, tenantId },
        include: { plan: true },
      });
    } else if (code) {
      voucher = await db.wiFiVoucher.findFirst({
        where: { code, tenantId },
        include: { plan: true },
      });
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either id or code is required' } },
        { status: 400 }
      );
    }

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Handle voucher issuance (tracking when a physical voucher is given to someone)
    if (action === 'issue') {
      if (voucher.status !== 'active') {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_INVALID', message: `Cannot issue a ${voucher.status} voucher` } },
          { status: 400 }
        );
      }

      const { issuedTo: issueRecipient, notes: issueNotes } = parsed.data;

      if (!issueRecipient || !issueRecipient.trim()) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Recipient name is required to issue a voucher' } },
          { status: 400 }
        );
      }

      const updatedVoucher = await db.wiFiVoucher.update({
        where: { id: voucher.id },
        data: {
          issuedTo: issueRecipient.trim(),
          issuedAt: new Date(),
          notes: issueNotes ? (voucher.notes ? `${voucher.notes}\n[${new Date().toISOString()}] ${issueNotes}` : issueNotes) : voucher.notes,
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              downloadSpeed: true,
              uploadSpeed: true,
              dataLimit: true,
              sessionLimit: true,
              validityDays: true,
              validityMinutes: true,
              price: true,
              currency: true,
            },
          },
        },
      });

      // Log issuance to audit log
      try {
        await logWifi(request, 'voucher_issue', 'voucher', updatedVoucher.id, {
          code: updatedVoucher.code,
          planName: updatedVoucher.plan?.name,
          issuedTo: issueRecipient.trim(),
          notes: issueNotes || undefined,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }

      return NextResponse.json({
        success: true,
        data: updatedVoucher,
        message: `Voucher issued to ${issueRecipient.trim()}`,
      });
    }

    // Handle voucher usage
    if (action === 'use') {
      // Get the plan details for provisioning (plan is immutable, safe outside transaction)
      const plan = voucher.plan;
      if (!plan) {
        return NextResponse.json(
          { success: false, error: { code: 'PLAN_NOT_FOUND', message: 'WiFi plan not found for voucher' } },
          { status: 400 }
        );
      }

      // Determine property ID from booking or get from plan (immutable lookups, safe outside transaction)
      let targetPropertyId = propertyId;
      if (!targetPropertyId) {
        // Try to get property from booking
        if (voucher.bookingId) {
          const booking = await db.booking.findUnique({
            where: { id: voucher.bookingId },
            select: { propertyId: true },
          });
          if (booking) {
            targetPropertyId = booking.propertyId;
          }
        }
      }

      if (!targetPropertyId) {
        // Get first property of tenant as fallback
        const property = await db.property.findFirst({
          where: { tenantId: voucher.tenantId },
          select: { id: true },
        });
        if (property) {
          targetPropertyId = property.id;
        }
      }

      if (!targetPropertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'PROPERTY_NOT_FOUND', message: 'No property found for WiFi provisioning' } },
          { status: 400 }
        );
      }

      const now = new Date();

      // H-11 Fix: Wrap validation + mark-as-used in a serializable DB transaction
      // to prevent the race condition where two concurrent requests both pass
      // validation and both provision WiFi users before either reaches the CAS.
      // Serializable isolation ensures only one transaction can commit past the
      // validation checks; the other will fail with a serialization error.
      let updatedVoucher: Awaited<ReturnType<typeof db.wiFiVoucher.findFirst>> | null = null;
      try {
        updatedVoucher = await db.$transaction(async (tx) => {
          // Re-read voucher with fresh state inside the transaction
          const freshVoucher = await tx.wiFiVoucher.findFirst({
            where: { id: voucher.id },
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  downloadSpeed: true,
                  uploadSpeed: true,
                  dataLimit: true,
                  sessionLimit: true,
                },
              },
            },
          });

          if (!freshVoucher) {
            throw new Error('VOUCHER_NOT_FOUND');
          }

          // Validate voucher is usable (with fresh state inside transaction)
          if (freshVoucher.status !== 'active') {
            throw new Error(`VOUCHER_INVALID:${freshVoucher.status}`);
          }

          if (freshVoucher.isUsed) {
            throw new Error('VOUCHER_USED');
          }

          if (now < freshVoucher.validFrom || now > freshVoucher.validUntil) {
            throw new Error('VOUCHER_EXPIRED');
          }

          // Enforce max device/session limit inside transaction
          const maxDevices = (freshVoucher.plan as any)?.maxDevices || freshVoucher.plan?.sessionLimit || 1;
          if (maxDevices > 0) {
            const wifiUserCount = await tx.wiFiUser.count({
              where: {
                tenantId: freshVoucher.tenantId,
                guestId: guestId || freshVoucher.guestId,
                bookingId: bookingId || freshVoucher.bookingId,
                status: 'active',
              },
            });
            if (wifiUserCount >= maxDevices) {
              throw new Error(`MAX_DEVICES_REACHED:${maxDevices}`);
            }
          }

          // Atomically mark as used (CAS pattern - final safety net)
          const updateResult = await tx.wiFiVoucher.updateMany({
            where: { id: freshVoucher.id, isUsed: false },
            data: {
              isUsed: true,
              usedAt: new Date(),
              status: 'used',
              guestId: guestId || freshVoucher.guestId,
              bookingId: bookingId || freshVoucher.bookingId,
            },
          });
          if (updateResult.count === 0) {
            throw new Error('VOUCHER_USED_CONCURRENT');
          }

          // Re-read updated voucher for the response
          const result = await tx.wiFiVoucher.findFirst({
            where: { id: freshVoucher.id },
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  downloadSpeed: true,
                  uploadSpeed: true,
                  dataLimit: true,
                  sessionLimit: true,
                },
              },
            },
          });
          return result;
        }, { isolationLevel: 'Serializable' });
      } catch (txError: any) {
        // Map transaction errors to appropriate HTTP responses
        const msg = txError?.message || '';
        if (msg === 'VOUCHER_NOT_FOUND') {
          return NextResponse.json(
            { success: false, error: { code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found' } },
            { status: 404 }
          );
        }
        if (msg === 'VOUCHER_USED' || msg === 'VOUCHER_USED_CONCURRENT') {
          return NextResponse.json(
            { success: false, error: { code: 'VOUCHER_USED', message: 'Voucher has already been used by another request' } },
            { status: 409 }
          );
        }
        if (msg.startsWith('VOUCHER_INVALID:')) {
          const voucherStatus = msg.split(':')[1];
          return NextResponse.json(
            { success: false, error: { code: 'VOUCHER_INVALID', message: `Voucher is ${voucherStatus}` } },
            { status: 400 }
          );
        }
        if (msg === 'VOUCHER_EXPIRED') {
          return NextResponse.json(
            { success: false, error: { code: 'VOUCHER_EXPIRED', message: 'Voucher is not valid at this time' } },
            { status: 400 }
          );
        }
        if (msg.startsWith('MAX_DEVICES_REACHED:')) {
          const maxDevices = msg.split(':')[1];
          return NextResponse.json(
            { success: false, error: { code: 'MAX_DEVICES_REACHED', message: `Maximum device limit (${maxDevices}) reached for this guest` } },
            { status: 400 }
          );
        }
        // Prisma serialization error or unexpected error
        console.error('Unexpected transaction error in voucher use:', txError);
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_CONFLICT', message: 'Voucher use failed due to a concurrent request. Please retry.' } },
          { status: 409 }
        );
      }

      if (!updatedVoucher) {
        return NextResponse.json(
          { success: false, error: { code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found after transaction' } },
          { status: 404 }
        );
      }

      // Transaction succeeded - voucher is atomically marked as used.
      // Now provision WiFi user externally (outside the DB transaction since it's
      // an external API call that cannot be rolled back).
      const wifiValidFrom = now;
      const wifiValidUntil = new Date(now.getTime() + (plan.validityMinutes || plan.validityDays * 1440) * 60 * 1000);

      let wifiCredentials: {
        username: string;
        password: string;
        validFrom: Date;
        validUntil: Date;
      } | null = null;

      let wifiUser: any = null;

      try {
        const provisionResult = await wifiUserService.provisionUser({
          tenantId: voucher.tenantId,
          propertyId: targetPropertyId,
          guestId: guestId || voucher.guestId || undefined,
          bookingId: bookingId || voucher.bookingId || undefined,
          planId: plan.id,
          validFrom: wifiValidFrom,
          validUntil: wifiValidUntil,
          userType: 'guest',
          downloadSpeed: plan.downloadSpeed ? plan.downloadSpeed * 1000000 : undefined, // Convert Mbps to bps
          uploadSpeed: plan.uploadSpeed ? plan.uploadSpeed * 1000000 : undefined,
          dataLimit: plan.dataLimit || undefined,
          sessionLimit: (plan as any).maxDevices || plan.sessionLimit || undefined,
        });

        wifiCredentials = provisionResult.credentials;
        wifiUser = provisionResult.wifiUser;
      } catch (provisionError) {
        // Voucher is already marked as used (committed in the transaction above).
        // Admin can handle the failed provisioning manually.
        console.error('Error provisioning WiFi user after voucher marked as used (non-fatal):', provisionError);
      }

      // Log voucher usage to audit log
      try {
        await logWifi(request, 'voucher_use', 'voucher', updatedVoucher.id, {
          code: updatedVoucher.code,
          planName: updatedVoucher.plan?.name,
          guestId: guestId || voucher.guestId,
          bookingId: bookingId || voucher.bookingId,
          wifiUsername: wifiCredentials?.username,
        }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
      }

      // Post charge to folio if voucher is linked to a booking and plan has a price
      try {
        if (updatedVoucher.bookingId && plan.price > 0) {
          let folio = await db.folio.findFirst({
            where: { bookingId: updatedVoucher.bookingId },
          });

          if (!folio) {
            // Get property and guest from the booking to create a folio
            const bookingForFolio = await db.booking.findUnique({
              where: { id: updatedVoucher.bookingId },
              select: { propertyId: true, primaryGuestId: true },
            });

            if (bookingForFolio) {
              const folioNumber = `FOL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
              folio = await db.folio.create({
                data: {
                  tenantId: updatedVoucher.tenantId,
                  propertyId: bookingForFolio.propertyId,
                  bookingId: updatedVoucher.bookingId,
                  guestId: bookingForFolio.primaryGuestId,
                  folioNumber,
                  status: 'open',
                },
              });
            }
          }

          if (folio) {
            // Include property tax (12%) on WiFi charges
            const taxRate = 0.12;
            const unitPrice = Math.round(plan.price * 100) / 100;
            const taxAmount = Math.round(unitPrice * taxRate * 100) / 100;
            const totalAmount = Math.round((unitPrice + taxAmount) * 100) / 100;

            await db.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: `WiFi - ${plan.name} (${formatPlanDuration(plan)})`,
                category: 'wifi',
                unitPrice,
                quantity: 1,
                taxAmount,
                totalAmount,
              },
            });

            // Update folio total with proper rounding (billing gap fix)
            const existingLineItems = await db.folioLineItem.findMany({
              where: { folioId: folio.id },
            });
            const newSubtotal = Math.round(existingLineItems.reduce((sum, li) => sum + li.totalAmount, 0) * 100) / 100;
            const newTaxes = Math.round(existingLineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0) * 100) / 100;
            const newTotal = Math.round((newSubtotal + newTaxes - (folio.discount || 0)) * 100) / 100;
            const balance = Math.round((newTotal - (folio.paidAmount || 0)) * 100) / 100;

            await db.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance,
              },
            });
          }
        }
      } catch (folioError) {
        console.error('Error posting WiFi charge to folio (non-fatal):', folioError);
      }

      return NextResponse.json({
        success: true,
        data: {
          voucher: updatedVoucher,
          wifiCredentials: wifiCredentials ? {
            username: wifiCredentials.username,
            password: wifiCredentials.password,
            validFrom: wifiCredentials.validFrom,
            validUntil: wifiCredentials.validUntil,
            ssid: 'StaySuite-Guest', // Default SSID
          } : null,
          wifiUser: wifiUser ? {
            id: wifiUser.id,
            username: wifiUser.username,
            status: wifiUser.status,
          } : null,
        },
        message: 'Voucher redeemed successfully',
      });
    }

    // Handle status update
    if (status) {
      const updatedVoucher = await db.wiFiVoucher.update({
        where: { id: voucher.id },
        data: { status },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, data: updatedVoucher });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NO_ACTION', message: 'No action specified' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating WiFi voucher:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi voucher' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/vouchers - Revoke a voucher
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingVoucher = await db.wiFiVoucher.findUnique({
      where: { id },
    });

    if (!existingVoucher) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify voucher belongs to user's tenant
    if (existingVoucher.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi voucher not found' } },
        { status: 404 }
      );
    }

    // Can only revoke active vouchers
    if (existingVoucher.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_REVOKE', message: 'Can only revoke active vouchers' } },
        { status: 400 }
      );
    }

    // Revoke the voucher
    const voucher = await db.wiFiVoucher.update({
      where: { id },
      data: { status: 'revoked' },
    });

    // Remove RADIUS credentials so the code can no longer authenticate
    try {
      // Delete all radcheck + radreply entries for this voucher code
      await db.radCheck.deleteMany({ where: { username: voucher.code } });
      await db.radReply.deleteMany({ where: { username: voucher.code } });
      console.log(`[Voucher] Removed RADIUS credentials for revoked voucher ${voucher.code}`);
    } catch (radiusError) {
      console.error(`[Voucher] Failed to remove RADIUS credentials for ${voucher.code}:`, radiusError);
    }

    // Log voucher revocation to audit log
    try {
      await logWifi(request, 'delete', 'voucher', id, {
        code: voucher.code,
        reason: 'revoked',
      }, { tenantId: user.tenantId, userId: user.userId });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: voucher,
      message: 'Voucher revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking WiFi voucher:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke WiFi voucher' } },
      { status: 500 }
    );
  }
}
