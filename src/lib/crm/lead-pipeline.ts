/**
 * Lead-to-Booking CRM Pipeline Service
 * Manages sales leads, scoring, conversion funnel, and pipeline stages.
 * AioSell-style lead management for banquet inquiries, corporate requests,
 * travel agent queries, and group bookings.
 */

import { db } from '@/lib/db';

export interface Lead {
  id: string;
  tenantId: string;
  propertyId: string;
  source: 'website' | 'phone' | 'email' | 'walk_in' | 'referral' | 'google_ads' | 'meta_ads' | 'ota' | 'travel_agent' | 'corporate' | 'event' | 'whatsapp';
  type: 'group_booking' | 'corporate' | 'wedding' | 'event' | 'banquet' | 'long_stay' | 'general';
  status: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'confirmed' | 'lost' | 'converted';
  priority: 'cold' | 'warm' | 'hot' | 'urgent';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCompany?: string;
  estimatedArrival?: Date;
  estimatedDeparture?: Date;
  roomCount?: number;
  guestCount?: number;
  estimatedRevenue?: number;
  assignedTo?: string;
  notes: string;
  followUpDate?: Date;
  lossReason?: string;
  convertedBookingId?: string;
  tags: string[];
  pipeline: 'inquiry' | 'qualification' | 'proposal' | 'negotiation' | 'closing';
  score: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'email' | 'meeting' | 'proposal' | 'follow_up' | 'note' | 'status_change' | 'assignment';
  content: string;
  createdBy: string;
  createdAt: Date;
}

// ─── Scoring weights (per spec) ────────────────────────────────────

const SOURCE_WEIGHTS: Record<string, number> = {
  corporate: 20,
  referral: 15,
  google_ads: 10,
  website: 8,
  phone: 5,
  walk_in: 5,
  email: 5,
  meta_ads: 10,
  ota: 5,
  travel_agent: 15,
  event: 10,
  whatsapp: 5,
};

const TYPE_WEIGHTS: Record<string, number> = {
  wedding: 15,
  event: 15,
  corporate: 10,
  group_booking: 10,
  long_stay: 8,
  banquet: 8,
  general: 3,
};

const REVENUE_WEIGHTS: Record<string, { min: number; points: number }[]> = {
  default: [
    { min: 5000, points: 15 },
    { min: 2000, points: 10 },
    { min: 500, points: 5 },
  ],
};

// Pipeline stage mapping: status → pipeline column
const STATUS_PIPELINE_MAP: Record<string, string> = {
  new: 'inquiry',
  contacted: 'inquiry',
  qualified: 'qualification',
  proposal_sent: 'proposal',
  negotiation: 'negotiation',
  confirmed: 'closing',
  converted: 'closing',
  lost: 'inquiry',
};

// Valid status transitions for validation
const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['qualified', 'proposal_sent', 'lost'],
  qualified: ['proposal_sent', 'negotiation', 'lost'],
  proposal_sent: ['negotiation', 'confirmed', 'lost'],
  negotiation: ['confirmed', 'proposal_sent', 'lost'],
  confirmed: ['converted', 'lost'],
  lost: [],
  converted: [],
};

// ─── Core functions ────────────────────────────────────────────────

export async function createLead(
  tenantId: string,
  propertyId: string,
  data: Partial<Omit<Lead, 'id' | 'tenantId' | 'propertyId' | 'score' | 'createdAt' | 'updatedAt'>>
) {
  const lead = await db.lead.create({
    data: {
      tenantId,
      propertyId,
      source: data.source || 'website',
      type: data.type || 'general',
      status: data.status || 'new',
      priority: data.priority || 'warm',
      contactName: data.contactName || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
      contactCompany: data.contactCompany,
      estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
      estimatedDeparture: data.estimatedDeparture ? new Date(data.estimatedDeparture) : undefined,
      roomCount: data.roomCount,
      guestCount: data.guestCount,
      estimatedRevenue: data.estimatedRevenue,
      assignedTo: data.assignedTo,
      notes: data.notes || '',
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      tags: JSON.stringify(data.tags || []),
      pipeline: data.pipeline || STATUS_PIPELINE_MAP[data.status || 'new'] || 'inquiry',
      score: 0,
    },
  });

  // Auto-score the lead
  const scored = await scoreLead(lead.id);

  // Log creation activity
  await addLeadActivity(
    lead.id,
    'status_change',
    `Lead created via ${data.source || 'website'} with priority ${data.priority || 'warm'}`,
    data.assignedTo || 'system'
  );

  return scored;
}

export async function updateLeadStatus(
  leadId: string,
  newStatus: Lead['status'],
  userId: string,
  lossReason?: string
) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[lead.status] || [];
  if (!allowedTransitions.includes(newStatus) && lead.status !== newStatus) {
    throw new Error(
      `Invalid transition from '${lead.status}' to '${newStatus}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`
    );
  }

  const newPipeline = STATUS_PIPELINE_MAP[newStatus] || lead.pipeline;

  const updated = await db.lead.update({
    where: { id: leadId },
    data: {
      status: newStatus,
      pipeline: newPipeline,
      ...(newStatus === 'lost' && lossReason ? { lossReason } : {}),
      ...(newStatus === 'lost' && !lossReason && !lead.lossReason ? { lossReason: 'No response' } : {}),
    },
  });

  await addLeadActivity(
    leadId,
    'status_change',
    `Status changed from ${lead.status} to ${newStatus}${lossReason ? ` — Reason: ${lossReason}` : ''}`,
    userId
  );

  return parseLead(updated);
}

/**
 * Auto-score a lead based on source, type, revenue, and engagement activity.
 *
 * Scoring breakdown (max 100):
 * - Source weight: up to 20
 * - Type weight: up to 15
 * - Revenue weight: up to 15
 * - Engagement: up to 20 (each activity adds +3, capped at 20)
 * - Room count: up to 10
 * - Guest count: up to 10
 * - Has follow-up date: +3
 * - Assigned to someone: +2
 * - Priority boost: up to 5
 */
export async function scoreLead(leadId: string): Promise<Lead> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  let score = 0;

  // 1. Source weight (max 20)
  score += SOURCE_WEIGHTS[lead.source] || 5;

  // 2. Type weight (max 15)
  score += TYPE_WEIGHTS[lead.type] || 3;

  // 3. Revenue weight (max 15)
  if (lead.estimatedRevenue) {
    const rev = lead.estimatedRevenue;
    if (rev >= 5000) score += 15;
    else if (rev >= 2000) score += 10;
    else if (rev >= 500) score += 5;
  }

  // 4. Engagement score: each activity adds +3 (max 20)
  const activityCount = await db.leadActivity.count({ where: { leadId } });
  score += Math.min(20, activityCount * 3);

  // 5. Room count (max 10)
  if (lead.roomCount) {
    score += Math.min(10, lead.roomCount * 2);
  }

  // 6. Guest count (max 10)
  if (lead.guestCount) {
    score += Math.min(10, Math.floor(lead.guestCount / 5) * 2);
  }

  // 7. Has follow-up date (+3)
  if (lead.followUpDate) score += 3;

  // 8. Assigned (+2)
  if (lead.assignedTo) score += 2;

  // 9. Priority boost (max 5)
  const priorityBonus: Record<string, number> = { urgent: 5, hot: 3, warm: 1, cold: 0 };
  score += priorityBonus[lead.priority] || 0;

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  const updated = await db.lead.update({
    where: { id: leadId },
    data: { score },
  });

  return parseLead(updated);
}

export async function convertLeadToBooking(
  leadId: string,
  bookingData: {
    roomTypeId: string;
    ratePlanId?: string;
    checkIn: Date;
    checkOut: Date;
    guestId: string;
    specialRequests?: string;
  },
  userId: string
) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  if (lead.status === 'converted') {
    throw new Error('Lead is already converted to a booking');
  }

  const booking = await db.booking.create({
    data: {
      tenantId: lead.tenantId,
      propertyId: lead.propertyId,
      primaryGuestId: bookingData.guestId,
      roomTypeId: bookingData.roomTypeId,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      adults: lead.guestCount || 1,
      source: 'direct',
      status: 'confirmed',
      notes: `Converted from lead ${leadId}. ${lead.contactName} - ${lead.contactCompany || ''}${bookingData.specialRequests ? `. Special requests: ${bookingData.specialRequests}` : ''}`,
      confirmationCode: `LD-${Date.now().toString(36).toUpperCase()}`,
    },
  });

  await db.lead.update({
    where: { id: leadId },
    data: {
      status: 'converted',
      pipeline: 'closing',
      convertedBookingId: booking.id,
      score: 100,
    },
  });

  await addLeadActivity(
    leadId,
    'status_change',
    `Lead converted to booking ${booking.confirmationCode} (ID: ${booking.id})`,
    userId
  );

  return { leadId, bookingId: booking.id, confirmationCode: booking.confirmationCode };
}

export async function getLeadsByPipeline(tenantId: string, propertyId: string) {
  const leads = await db.lead.findMany({
    where: { tenantId, propertyId, deletedAt: null },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
  });

  const pipeline: Record<string, Lead[]> = {
    inquiry: [],
    qualification: [],
    proposal: [],
    negotiation: [],
    closing: [],
  };

  for (const lead of leads) {
    const parsed = parseLead(lead);
    if (pipeline[parsed.pipeline]) {
      pipeline[parsed.pipeline].push(parsed);
    }
  }

  return pipeline;
}

export async function scheduleFollowUp(leadId: string, date: Date, notes: string, userId: string) {
  const lead = await db.lead.update({
    where: { id: leadId },
    data: { followUpDate: date },
  });

  await addLeadActivity(
    leadId,
    'follow_up',
    `Follow-up scheduled for ${date.toISOString().split('T')[0]}: ${notes}`,
    userId
  );

  // Re-score after scheduling follow-up
  await scoreLead(leadId);

  return parseLead(lead);
}

export async function addLeadActivity(
  leadId: string,
  type: LeadActivity['type'],
  content: string,
  createdBy: string
) {
  const activity = await db.leadActivity.create({
    data: { leadId, type, content, createdBy },
  });
  return parseActivity(activity);
}

export async function getLeadActivities(leadId: string) {
  const activities = await db.leadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
  });
  return activities.map(parseActivity);
}

export async function getLeadActivityCount(leadId: string): Promise<number> {
  return db.leadActivity.count({ where: { leadId } });
}

/**
 * Comprehensive lead analytics with conversion funnel metrics.
 * Returns leads by source, type, status, conversion rate, average response time,
 * average deal size, pipeline value by stage, and win rate by source.
 */
export async function getLeadAnalytics(
  tenantId: string,
  propertyId: string,
  dateFrom?: Date,
  dateTo?: Date
) {
  const where: Record<string, unknown> = { tenantId, propertyId, deletedAt: null };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
    if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
  }

  const allLeads = await db.lead.findMany({ where });
  const allActivities = await db.leadActivity.findMany({
    where: {
      lead: { tenantId, propertyId, deletedAt: null },
    },
  });

  const total = allLeads.length;
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byPipeline: Record<string, number> = {};
  let totalEstimatedRevenue = 0;
  let convertedRevenue = 0;
  const pipelineValueByStage: Record<string, number> = {
    inquiry: 0,
    qualification: 0,
    proposal: 0,
    negotiation: 0,
    closing: 0,
  };

  // Win rate by source tracking
  const winsBySource: Record<string, number> = {};
  const totalBySource: Record<string, number> = {};

  for (const lead of allLeads) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    bySource[lead.source] = (bySource[lead.source] || 0) + 1;
    byType[lead.type] = (byType[lead.type] || 0) + 1;
    byPipeline[lead.pipeline] = (byPipeline[lead.pipeline] || 0) + 1;

    const rev = lead.estimatedRevenue || 0;
    totalEstimatedRevenue += rev;

    if (lead.status === 'converted') {
      convertedRevenue += rev;
      winsBySource[lead.source] = (winsBySource[lead.source] || 0) + 1;
    }

    // Pipeline value (sum of estimatedRevenue by stage, excluding converted/lost)
    if (!['converted', 'lost'].includes(lead.status) && pipelineValueByStage[lead.pipeline] !== undefined) {
      pipelineValueByStage[lead.pipeline] += rev;
    }

    totalBySource[lead.source] = (totalBySource[lead.source] || 0) + 1;
  }

  // Conversion rate
  const conversionRate = total > 0 ? ((byStatus['converted'] || 0) / total) * 100 : 0;

  // Average deal size (of converted leads)
  const convertedCount = byStatus['converted'] || 0;
  const avgDealSize = convertedCount > 0 ? convertedRevenue / convertedCount : 0;

  // Average score
  const avgScore = total > 0 ? Math.round(allLeads.reduce((sum, l) => sum + l.score, 0) / total) : 0;

  // Average response time: time from lead creation to first activity (in hours)
  let totalResponseTimeMs = 0;
  let responseTimeCount = 0;
  const activityByLead = new Map<string, typeof allActivities>();

  for (const activity of allActivities) {
    if (!activityByLead.has(activity.leadId)) {
      activityByLead.set(activity.leadId, []);
    }
    activityByLead.get(activity.leadId)!.push(activity);
  }

  for (const lead of allLeads) {
    const activities = activityByLead.get(lead.id);
    if (activities && activities.length > 0) {
      // Find first non-system activity
      const firstActivity = activities
        .filter(a => a.createdBy !== 'system')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      if (firstActivity) {
        const diff = new Date(firstActivity.createdAt).getTime() - new Date(lead.createdAt).getTime();
        if (diff >= 0) {
          totalResponseTimeMs += diff;
          responseTimeCount++;
        }
      }
    }
  }
  const avgResponseTimeHours = responseTimeCount > 0
    ? Math.round((totalResponseTimeMs / responseTimeCount) / (1000 * 60 * 60))
    : 0;

  // Win rate by source
  const winRateBySource: Record<string, number> = {};
  for (const source of Object.keys(totalBySource)) {
    winRateBySource[source] = totalBySource[source] > 0
      ? Math.round((winsBySource[source] || 0) / totalBySource[source] * 100)
      : 0;
  }

  // Overdue follow-ups
  const overdueFollowUps = allLeads.filter(
    l => l.followUpDate && l.followUpDate < new Date() && !['converted', 'lost'].includes(l.status)
  ).length;

  // Today's leads count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayLeads = allLeads.filter(l => l.createdAt >= todayStart).length;

  return {
    total,
    byStatus,
    bySource,
    byType,
    byPipeline,
    totalEstimatedRevenue,
    convertedRevenue,
    conversionRate: Math.round(conversionRate * 10) / 10,
    avgDealSize: Math.round(avgDealSize * 100) / 100,
    avgScore,
    avgResponseTimeHours,
    pipelineValueByStage,
    winRateBySource,
    overdueFollowUps,
    newLeads: byStatus['new'] || 0,
    activeLeads: total - (byStatus['converted'] || 0) - (byStatus['lost'] || 0),
    todayLeads,
  };
}

/**
 * Auto-expire stale leads: no activity > 30 days → status = 'lost', lossReason = 'no_response'
 * Checks for actual inactivity (no LeadActivity records) rather than just creation date.
 */
export async function autoExpireLeads(tenantId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find leads that are old but still active (not converted/lost)
  const staleLeads = await db.lead.findMany({
    where: {
      tenantId,
      status: { notIn: ['converted', 'lost'] },
      createdAt: { lt: thirtyDaysAgo },
      deletedAt: null,
    },
    include: {
      activities: {
        where: { createdAt: { gte: thirtyDaysAgo } },
        take: 1,
      },
    },
  });

  let expired = 0;

  for (const lead of staleLeads) {
    // Check if there's been ANY activity in the last 30 days
    const hasRecentActivity = lead.activities.length > 0;

    if (!hasRecentActivity) {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          status: 'lost',
          lossReason: 'no_response',
        },
      });

      await db.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'status_change',
          content: 'Lead auto-expired: no_response (no activity for 30+ days)',
          createdBy: 'system',
        },
      });

      expired++;
    }
  }

  return { expired, checked: staleLeads.length };
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseLead(raw: any): Lead {
  return {
    ...raw,
    tags: typeof raw.tags === 'string' ? JSON.parse(raw.tags) : (raw.tags || []),
    estimatedArrival: raw.estimatedArrival ? new Date(raw.estimatedArrival) : undefined,
    estimatedDeparture: raw.estimatedDeparture ? new Date(raw.estimatedDeparture) : undefined,
    followUpDate: raw.followUpDate ? new Date(raw.followUpDate) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function parseActivity(raw: any): LeadActivity {
  return {
    id: raw.id,
    leadId: raw.leadId,
    type: raw.type,
    content: raw.content,
    createdBy: raw.createdBy,
    createdAt: new Date(raw.createdAt),
  };
}
