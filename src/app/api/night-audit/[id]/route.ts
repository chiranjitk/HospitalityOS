import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const updateAuditSchema = z.object({
  status: z.enum(['completed', 'failed']).optional(),
  notes: z.string().optional(),
});

const completeStepSchema = z.object({
  stepId: z.string().uuid('Invalid step ID'),
  status: z.enum(['completed', 'skipped']),
  result: z.string().optional(),
  notes: z.string().optional(),
});

// ─── GET: Get single audit with steps and logs ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.view') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const audit = await db.nightAudit.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        startedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        completedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' }, take: 200 },
      },
    });

    if (!audit) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Night audit not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error('[NightAudit GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch night audit' } }, { status: 500 });
  }
}

// ─── PATCH: Update audit (complete step, complete audit) ───
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.edit') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Fetch existing audit
    const audit = await db.nightAudit.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!audit) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Night audit not found' } }, { status: 404 });
    }

    if (audit.status !== 'in_progress') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Audit is not in progress' } }, { status: 400 });
    }

    // ─── Case 1: Complete a step ───
    if (body.stepId) {
      const parsed = completeStepSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
      }

      const { stepId, status: stepStatus, result, notes: stepNotes } = parsed.data;
      const step = audit.steps.find((s) => s.id === stepId);
      if (!step) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Step not found in this audit' } }, { status: 404 });
      }

      const updatedStep = await db.nightAuditStep.update({
        where: { id: stepId },
        data: {
          status: stepStatus,
          completedAt: new Date(),
          performedBy: user.id,
          result,
          notes: stepNotes,
        },
      });

      // Log the step completion
      await db.nightAuditLog.create({
        data: {
          nightAuditId: id,
          action: `step_${stepStatus}`,
          entityType: 'NightAuditStep',
          entityId: stepId,
          newValue: `Step "${step.stepName}" ${stepStatus}${stepNotes ? ` - ${stepNotes}` : ''}`,
          performedBy: user.id,
        },
      });

      // Check if all steps are done
      const allSteps = await db.nightAuditStep.findMany({ where: { nightAuditId: id } });
      const allDone = allSteps.every((s) => s.status === 'completed' || s.status === 'skipped');

      return NextResponse.json({
        success: true,
        data: {
          step: updatedStep,
          allStepsComplete: allDone,
        },
      });
    }

    // ─── Case 2: Complete the entire audit ───
    const parsed = updateAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const { status: auditStatus } = parsed.data;

    // Validate all steps are done before completing
    if (auditStatus === 'completed') {
      const pendingSteps = audit.steps.filter((s) => s.status === 'pending' || s.status === 'in_progress');
      if (pendingSteps.length > 0) {
        return NextResponse.json({
          success: false,
          error: { code: 'STEPS_PENDING', message: `${pendingSteps.length} step(s) are still pending. Complete or skip all steps first.` },
        }, { status: 400 });
      }
    }

    const updatedAudit = await db.nightAudit.update({
      where: { id },
      data: {
        status: auditStatus || 'completed',
        completedBy: user.id,
        completedAt: new Date(),
        ...(body.notes ? { notes: body.notes } : {}),
      },
      include: {
        property: { select: { id: true, name: true } },
        startedByUser: { select: { id: true, firstName: true, lastName: true } },
        completedByUser: { select: { id: true, firstName: true, lastName: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    // Log audit completion
    await db.nightAuditLog.create({
      data: {
        nightAuditId: id,
        action: `audit_${auditStatus}`,
        entityType: 'NightAudit',
        entityId: id,
        newValue: `Night audit ${auditStatus} by ${user.firstName} ${user.lastName}`,
        performedBy: user.id,
      },
    });

    return NextResponse.json({ success: true, data: updatedAudit });
  } catch (error) {
    console.error('[NightAudit PATCH/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update night audit' } }, { status: 500 });
  }
}
