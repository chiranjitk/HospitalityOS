export const runtime = 'nodejs';

/**
 * System Health API
 *
 * Unified health endpoint for the redesigned System Health page.
 * Provides real-time metrics, interface data, RRD graph data,
 * active RADIUS users, and an in-memory alert system.
 *
 * All endpoints require `reports.view` permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';
import { getSystemMetrics, getMetricsHistory } from '@/lib/system-metrics';
import { fetchSystemGraph, fetchPoolGraph } from '@/lib/rrd/system-rrd';
import { fetchRRD, userRRDPath, getRRDBasePath } from '@/lib/rrd';
// Node.js-only modules — loaded via require() to avoid Turbopack Edge Runtime analysis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = /*turbopackIgnore: true*/ require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = /*turbopackIgnore: true*/ require('path');

// ─── Alert System (in-memory) ────────────────────────────────────────────────

interface AlertRule {
  id: string;
  metric: 'cpu' | 'memory' | 'disk';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  enabled: boolean;
  label: string;
}

interface AlertEvent {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  triggeredAt: number;
  acknowledged: boolean;
  resolvedAt: number | null;
}

const DEFAULT_RULES: AlertRule[] = [
  { id: 'rule_cpu_85', metric: 'cpu', operator: '>', threshold: 85, enabled: true, label: 'CPU usage above 85%' },
  { id: 'rule_ram_90', metric: 'memory', operator: '>', threshold: 90, enabled: true, label: 'RAM usage above 90%' },
  { id: 'rule_disk_90', metric: 'disk', operator: '>', threshold: 90, enabled: true, label: 'Disk usage above 90%' },
];

let alertRules: AlertRule[] = [...DEFAULT_RULES];
let activeAlerts: AlertEvent[] = [];
let alertHistory: AlertEvent[] = [];
let alertIdCounter = 0;

const MAX_HISTORY = 100;

function checkAlerts(snapshot: {
  cpu: { usage: number };
  memory: { percent: number };
  disk: { percent: number };
}): void {
  const metricValues: Record<string, number> = {
    cpu: snapshot.cpu.usage,
    memory: snapshot.memory.percent,
    disk: snapshot.disk.percent,
  };

  for (const rule of alertRules) {
    if (!rule.enabled) continue;

    const value = metricValues[rule.metric];
    if (value === undefined) continue;

    let triggered = false;
    switch (rule.operator) {
      case '>': triggered = value > rule.threshold; break;
      case '<': triggered = value < rule.threshold; break;
      case '>=': triggered = value >= rule.threshold; break;
      case '<=': triggered = value <= rule.threshold; break;
    }

    const existingIndex = activeAlerts.findIndex(
      a => a.ruleId === rule.id && !a.acknowledged
    );

    if (triggered && existingIndex === -1) {
      // New alert
      alertIdCounter++;
      const alert: AlertEvent = {
        id: `alert_${alertIdCounter}`,
        ruleId: rule.id,
        metric: rule.metric,
        value: Math.round(value * 10) / 10,
        threshold: rule.threshold,
        triggeredAt: Date.now(),
        acknowledged: false,
        resolvedAt: null,
      };
      activeAlerts.push(alert);
    } else if (!triggered && existingIndex !== -1) {
      // Resolve the alert
      const alert = activeAlerts[existingIndex];
      alert.resolvedAt = Date.now();

      // Move to history
      activeAlerts.splice(existingIndex, 1);
      alertHistory.unshift(alert);
      if (alertHistory.length > MAX_HISTORY) {
        alertHistory = alertHistory.slice(0, MAX_HISTORY);
      }
    }
  }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'metrics':
        return handleMetrics();
      case 'interfaces':
        return handleInterfaces();
      case 'rrd-graph':
        return handleRRDGraph(searchParams);
      case 'active-users':
        return handleActiveUsers();
      case 'user-graph':
        return handleUserGraph(searchParams);
      case 'list-user-rrds':
        return handleListUserRRDs();
      case 'pool-graph':
        return handlePoolGraph(searchParams);
      case 'list-pools':
        return handleListPools();
      case 'alerts':
        return handleAlerts();
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Health API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'set-alert-rules':
        return handleSetAlertRules(request);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Health API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

/**
 * action=metrics — Real-time system metrics + history
 */
async function handleMetrics() {
  let snapshot: Awaited<ReturnType<typeof getMetricsHistory>>['snapshot'];
  let history: Awaited<ReturnType<typeof getMetricsHistory>>['history'];

  try {
    const result = await getMetricsHistory();
    snapshot = result.snapshot;
    history = result.history;
  } catch (err) {
    console.error('[Health API] getMetricsHistory failed:', err);
    // Fallback: read live system metrics directly (no history/cached values)
    try {
      const live = await getSystemMetrics();
      return NextResponse.json({
        success: true,
        data: {
          timestamp: live.timestamp,
          cpu: { usage: live.cpu.usage, cores: live.cpu.cores, loadAvg: live.cpu.loadAvg },
          memory: { total: live.memory.total, used: live.memory.used, percent: live.memory.percent },
          disk: { total: live.disk.total, used: live.disk.used, percent: live.disk.percent },
          interfaces: live.interfaces.map(i => ({
            name: i.name, rxBytes: i.rxBytes, txBytes: i.txBytes,
            rxSpeed: i.rxSpeed, txSpeed: i.txSpeed,
          })),
          cpuPerCore: live.cpuPerCore,
          load: live.load,
          swap: live.swap,
          diskIO: live.diskIO,
          thermal: live.thermal,
          netErrors: live.netErrors,
          tcpConn: live.tcpConn,
          activeSessions: live.activeSessions,
          authStats: live.authStats,
          history: { timestamps: [], cpu: [], memory: [], disk: [], interfaces: {}, load1: [], swap: [], established: [], activeSessions: [] },
        },
      });
    } catch (fallbackErr) {
      console.error('[Health API] Fallback getSystemMetrics also failed:', fallbackErr);
      // Absolute last resort: return zeros
      return NextResponse.json({
        success: true,
        data: {
          timestamp: Date.now(),
          cpu: { usage: 0, cores: 0, loadAvg: [0, 0, 0] },
          memory: { total: 0, used: 0, percent: 0 },
          disk: { total: 0, used: 0, percent: 0 },
          interfaces: [],
          cpuPerCore: [],
          load: { avg1: 0, avg5: 0, avg15: 0 },
          swap: { total: 0, used: 0, percent: 0 },
          diskIO: { reads: 0, writes: 0, readBytes: 0, writeBytes: 0 },
          thermal: null,
          netErrors: { rxErr: 0, txErr: 0, rxDrop: 0, txDrop: 0, rxPkt: 0, txPkt: 0 },
          tcpConn: { established: 0, timeWait: 0, closeWait: 0, synRecv: 0 },
          activeSessions: 0,
          authStats: { accept: 0, reject: 0 },
          history: { timestamps: [], cpu: [], memory: [], disk: [], interfaces: {}, load1: [], swap: [], established: [], activeSessions: [] },
        },
      });
    }
  }

  // Check alert rules against current values
  checkAlerts(snapshot);

  // Build interfaces history from the history points
  const ifaceHistory: Record<string, { rxSpeed: number[]; txSpeed: number[] }> = {};
  const ifaceSet = new Set<string>();

  // Pre-populate interface keys from all history points
  for (const point of history) {
    for (const name of Object.keys(point.interfaces)) {
      ifaceSet.add(name);
    }
  }

  for (const name of ifaceSet) {
    ifaceHistory[name] = { rxSpeed: [], txSpeed: [] };
  }

  for (const point of history) {
    for (const name of ifaceSet) {
      const ifaceData = point.interfaces[name];
      ifaceHistory[name].rxSpeed.push(ifaceData?.rxSpeed ?? 0);
      ifaceHistory[name].txSpeed.push(ifaceData?.txSpeed ?? 0);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      timestamp: snapshot.timestamp,
      cpu: {
        usage: snapshot.cpu.usage,
        cores: snapshot.cpu.cores,
        loadAvg: snapshot.cpu.loadAvg,
      },
      memory: {
        total: snapshot.memory.total,
        used: snapshot.memory.used,
        percent: snapshot.memory.percent,
      },
      disk: {
        total: snapshot.disk.total,
        used: snapshot.disk.used,
        percent: snapshot.disk.percent,
      },
      interfaces: snapshot.interfaces.map(i => ({
        name: i.name,
        rxBytes: i.rxBytes,
        txBytes: i.txBytes,
        rxSpeed: i.rxSpeed,
        txSpeed: i.txSpeed,
      })),
      cpuPerCore: snapshot.cpuPerCore,
      load: snapshot.load,
      swap: snapshot.swap,
      diskIO: snapshot.diskIO,
      thermal: snapshot.thermal,
      netErrors: snapshot.netErrors,
      tcpConn: snapshot.tcpConn,
      activeSessions: snapshot.activeSessions,
      authStats: snapshot.authStats,
      history: {
        timestamps: history.map(p => p.timestamp),
        cpu: history.map(p => p.cpu),
        memory: history.map(p => p.memory),
        disk: history.map(p => p.disk),
        interfaces: ifaceHistory,
        load1: history.map(p => p.load1),
        swap: history.map(p => p.swap),
        established: history.map(p => p.established),
        activeSessions: history.map(p => p.activeSessions),
      },
    },
  });
}

/**
 * action=interfaces — List network interfaces
 */
async function handleInterfaces() {
  const procNetDev = '/proc/net/dev';
  if (!fs.existsSync(procNetDev)) {
    return NextResponse.json({ success: true, data: [] });
  }

  const snapshot = await getSystemMetrics();

  // Read /proc/net/dev for interface names
  const content = fs.readFileSync(procNetDev, 'utf-8');
  const lines = content.trim().split('\n');
  const interfaces: Array<{
    name: string;
    rxBytes: number;
    txBytes: number;
    rxSpeed: number;
    txSpeed: number;
    isUp: boolean;
  }> = [];

  // Build a map of known interfaces from the latest snapshot
  const ifaceMap = new Map<string, typeof snapshot.interfaces[0]>();
  for (const i of snapshot.interfaces) {
    ifaceMap.set(i.name, i);
  }

  for (const line of lines) {
    const match = line.match(/^\s*(\w+):/);
    if (!match) continue;
    const name = match[1];
    if (name === 'lo') continue;

    const known = ifaceMap.get(name);
    const isUp = known !== undefined;

    interfaces.push({
      name,
      rxBytes: known?.rxBytes ?? 0,
      txBytes: known?.txBytes ?? 0,
      rxSpeed: known?.rxSpeed ?? 0,
      txSpeed: known?.txSpeed ?? 0,
      isUp,
    });
  }

  return NextResponse.json({ success: true, data: interfaces });
}

/**
 * action=rrd-graph — Historical RRD graph data
 */
async function handleRRDGraph(searchParams: URLSearchParams) {
  const type = searchParams.get('type') || 'cpu';
  const name = searchParams.get('name') || '';
  const range = searchParams.get('range') || '24h';

  const validTypes = [
    'cpu', 'memory', 'disk', 'interface',
    'cpu-percore', 'load', 'swap', 'disk-io', 'thermal',
    'network-errors', 'tcp', 'active-sessions', 'auth-stats',
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { success: false, error: `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  const validRanges = ['1h', '6h', '24h', '7d', '30d', '90d', '1y'];
  if (!validRanges.includes(range)) {
    return NextResponse.json(
      { success: false, error: `Invalid range: ${range}. Must be one of: ${validRanges.join(', ')}` },
      { status: 400 }
    );
  }

  if (type === 'interface' && !name) {
    return NextResponse.json(
      { success: false, error: 'Missing "name" parameter for interface type' },
      { status: 400 }
    );
  }

  const result = await fetchSystemGraph(type, name, range);

  return NextResponse.json({ success: true, data: result });
}

/**
 * action=active-users — Active FreeRADIUS users
 * Uses v_active_sessions view (same source as WiFi Access > Active Users tab)
 */
async function handleActiveUsers() {
  try {
    const rows: Array<{
      acctuniqueid: string;
      username: string;
      nasipaddress: string | null;
      framedipaddress: string | null;
      callingstationid: string | null;
      acctstarttime: string | null;
      acctsessiontime: number | null;
      acctinputoctets: number | null;
      acctoutputoctets: number | null;
      calledstationid: string | null;
      plan_name: string | null;
      room_number: string | null;
    }> = await db.$queryRawUnsafe(`
      SELECT DISTINCT ON (acctuniqueid)
             acctuniqueid, username, nasipaddress, framedipaddress,
             callingstationid, acctstarttime, acctsessiontime,
             acctinputoctets, acctoutputoctets,
             calledstationid, plan_name, room_number
      FROM v_active_sessions
      WHERE session_status = 'active'
      ORDER BY acctuniqueid, acctstarttime DESC
    `);

    const stripCidr = (v: string | null) => (v || '').replace(/\/\d+$/, '');

    const users = rows.map(r => ({
      id: `ls_${r.acctuniqueid}`,
      username: r.username || '',
      nasIpAddress: stripCidr(r.nasipaddress),
      nasIdentifier: r.calledstationid || '',
      framedIpAddress: stripCidr(r.framedipaddress),
      macAddress: r.callingstationid || '',
      sessionStart: r.acctstarttime ? new Date(r.acctstarttime).toISOString() : null,
      sessionTime: Number(r.acctsessiontime || 0),
      inputBytes: Number(r.acctinputoctets || 0),
      outputBytes: Number(r.acctoutputoctets || 0),
      planName: r.plan_name || '',
      roomId: r.room_number || '',
    }));

    // Also return RRD usernames (users with bandwidth history, including offline)
    let rrdUsernames: string[] = [];
    try {
      // Try multiple possible RRD data paths (dev, production, sandbox)
      const candidates = [
        getRRDBasePath(),
        /*turbopackIgnore: true*/ process.cwd() + '/data/rrd',
      ];
      for (const base of candidates) {
        const dir = base + '/users';
        if (/*turbopackIgnore: true*/ fs.existsSync(dir)) {
          const files = /*turbopackIgnore: true*/ fs.readdirSync(dir).filter(f => f.endsWith('.rrd'));
          if (files.length > 0) {
            rrdUsernames = files.map(f => f.replace(/\.rrd$/, ''));
            console.log(`[Health API] active-users: found ${rrdUsernames.length} RRD users from ${dir}`);
            break;
          }
        }
      }
      // Debug: write path resolution to temp file
      try {
        console.log(`[Health API] active-users debug: cwd=${process.cwd()} getRRDBase=${getRRDBasePath()} candidates=${candidates.join(',')} rrdUsers=${rrdUsernames.length}`);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('[Health API] RRD scan error:', err);
    }

    return NextResponse.json({ success: true, data: users, rrdUsernames });
  } catch (error) {
    console.error('[Health API] Active users query error:', error);
    // Fallback to direct radacct query if view doesn't exist
    try {
      const fallbackRows: Array<{
        username: string;
        nasipaddress: string | null;
        framedipaddress: string | null;
        callingstationid: string | null;
        acctstarttime: Date | null;
        acctsessiontime: number | bigint | null;
        acctinputoctets: number | bigint | null;
        acctoutputoctets: number | bigint | null;
      }> = await db.$queryRawUnsafe(`
        SELECT username, nasipaddress, framedipaddress, callingstationid,
               acctstarttime, acctsessiontime, acctinputoctets, acctoutputoctets
        FROM radacct WHERE acctstoptime IS NULL ORDER BY acctstarttime DESC
      `);
      const stripCidr = (v: string | null) => (v || '').replace(/\/\d+$/, '');
      const users = fallbackRows.map(r => ({
        username: r.username,
        nasIpAddress: stripCidr(r.nasipaddress),
        framedIpAddress: stripCidr(r.framedipaddress),
        macAddress: r.callingstationid || '',
        sessionStart: r.acctstarttime ? new Date(r.acctstarttime).toISOString() : null,
        sessionTime: Number(r.acctsessiontime || 0),
        inputBytes: Number(r.acctinputoctets || 0),
        outputBytes: Number(r.acctoutputoctets || 0),
      }));
      return NextResponse.json({ success: true, data: users });
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }
  }
}

/**
 * action=user-graph — Per-user bandwidth history from RRD
 * Uses the same RRD infrastructure as system graphs.
 *
 * Params: username (required), range (1h/6h/24h/7d/30d/1y)
 */
async function handleUserGraph(searchParams: URLSearchParams) {
  const username = searchParams.get('username');
  const range = searchParams.get('range') || '24h';

  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Missing "username" parameter' },
      { status: 400 }
    );
  }

  const validRanges = ['1h', '6h', '24h', '7d', '30d', '90d', '1y'];
  if (!validRanges.includes(range)) {
    return NextResponse.json(
      { success: false, error: `Invalid range: ${range}. Must be one of: ${validRanges.join(', ')}` },
      { status: 400 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds: Record<string, number> = {
    '1h': 3600, '6h': 21600, '24h': 86400,
    '7d': 604800, '30d': 2592000, '90d': 7776000, '1y': 31536000,
  };
  const rangeResolutions: Record<string, number> = {
    '1h': 60, '6h': 300, '24h': 300, '7d': 3600, '30d': 3600, '90d': 86400, '1y': 86400,
  };

  const seconds = rangeSeconds[range];
  const resolution = rangeResolutions[range];

  // Try multiple candidate paths to find the RRD file
  const candidates = [
    userRRDPath(username),
    /*turbopackIgnore: true*/ process.cwd() + '/data/rrd/users/' + username + '.rrd',
  ];

  let rrdFile = '';
  for (const candidate of candidates) {
    if (/*turbopackIgnore: true*/ fs.existsSync(candidate)) {
      rrdFile = candidate;
      break;
    }
  }

  if (!rrdFile) {
    console.log(`[Health API] user-graph: no RRD file found for ${username} (tried ${candidates.length} paths)`);
    return NextResponse.json({
      success: true,
      data: {
        timestamps: [],
        data: { download: [], upload: [] },
        meta: { step: resolution, start: now - seconds, end: now, cf: 'AVERAGE', dsNames: ['download', 'upload'], type: 'user', username, range },
      },
    });
  }

  try {
    const result = await fetchRRD(rrdFile, 'AVERAGE', now - seconds, now, resolution);

    // Convert ds_in/download and ds_out/upload from bytes/sec to bits/sec
    // DERIVE DS type already stores values as bytes/sec (delta_bytes / delta_time)
    const downloadBps = (result.data['in'] || []).map(v => Math.round(v * 8));
    const uploadBps = (result.data['out'] || []).map(v => Math.round(v * 8));

    return NextResponse.json({
      success: true,
      data: {
        timestamps: result.timestamps,
        data: { download: downloadBps, upload: uploadBps },
        meta: {
          step: result.meta.step,
          start: now - seconds,
          end: now,
          cf: 'AVERAGE',
          dsNames: ['download', 'upload'],
          type: 'user',
          username,
          range,
        },
      },
    });
  } catch (err) {
    console.error(`[Health API] Failed to fetch user graph for ${username}:`, err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user bandwidth graph' },
      { status: 500 }
    );
  }
}

/**
 * action=list-user-rrds — List available user RRD files
 * Returns usernames that have bandwidth history data.
 */
function handleListUserRRDs() {
  // Try multiple candidate paths (same logic as handleActiveUsers)
  const candidates = [
    getRRDBasePath(),
    /*turbopackIgnore: true*/ process.cwd() + '/data/rrd',
  ];

  for (const base of candidates) {
    const usersDir = base + '/users';
    if (/*turbopackIgnore: true*/ fs.existsSync(usersDir)) {
      try {
        const files = /*turbopackIgnore: true*/ fs.readdirSync(usersDir).filter(f => f.endsWith('.rrd'));
        if (files.length > 0) {
          const usernames = files.map(f => f.replace(/\.rrd$/, ''));
          console.log(`[Health API] list-user-rrds: found ${usernames.length} users from ${usersDir}`);
          return NextResponse.json({ success: true, data: usernames });
        }
      } catch (err) {
        console.error('[Health API] Failed to list user RRDs:', err);
      }
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

/**
 * action=pool-graph — Per-pool bandwidth history from RRD
 *
 * Params: poolId (required), range (1h/6h/24h/7d/30d/90d/1y)
 */
async function handlePoolGraph(searchParams: URLSearchParams) {
  const poolId = searchParams.get('poolId');
  const range = searchParams.get('range') || '24h';

  if (!poolId) {
    return NextResponse.json(
      { success: false, error: 'Missing "poolId" parameter' },
      { status: 400 }
    );
  }

  const validRanges = ['1h', '6h', '24h', '7d', '30d', '90d', '1y'];
  if (!validRanges.includes(range)) {
    return NextResponse.json(
      { success: false, error: `Invalid range: ${range}. Must be one of: ${validRanges.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPoolGraph(poolId, range);

    // Convert download/upload from bytes/sec to bits/sec for display
    const downloadBps = (result.data?.download || []).map(v => Math.round(Number(v) * 8));
    const uploadBps = (result.data?.upload || []).map(v => Math.round(Number(v) * 8));

    return NextResponse.json({
      success: true,
      data: {
        timestamps: result.timestamps,
        data: { download: downloadBps, upload: uploadBps },
        meta: {
          step: result.meta.step,
          start: result.meta.start,
          end: result.meta.end,
          cf: 'AVERAGE',
          dsNames: ['download', 'upload'],
          type: 'pool',
          poolId,
          range,
        },
      },
    });
  } catch (err) {
    console.error(`[Health API] Failed to fetch pool graph for ${poolId}:`, err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pool bandwidth graph' },
      { status: 500 }
    );
  }
}

/**
 * action=list-pools — List all enabled BandwidthPools
 * Returns pool list for the UI dropdown selector.
 */
async function handleListPools() {
  try {
    const pools = await db.bandwidthPool.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        subnet: true,
        totalDownloadKbps: true,
        totalUploadKbps: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: pools });
  } catch (error) {
    console.error('[Health API] list-pools error:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}

/**
 * action=alerts — Alert system status
 */
function handleAlerts() {
  return NextResponse.json({
    success: true,
    data: {
      rules: alertRules,
      active: activeAlerts,
      history: alertHistory,
    },
  });
}

/**
 * action=set-alert-rules (POST) — Configure alert rules
 */
async function handleSetAlertRules(request: NextRequest) {
  try {
    const body = await request.json();
    const { rules } = body as { rules?: Array<{
      metric?: string;
      operator?: string;
      threshold?: number;
      enabled?: boolean;
      label?: string;
    }> };

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: 'Request body must contain a "rules" array' },
        { status: 400 }
      );
    }

    // Validate and build new rules
    const validMetrics = ['cpu', 'memory', 'disk'];
    const validOperators = ['>', '<', '>=', '<='];

    const newRules: AlertRule[] = rules.map((rule, index) => {
      const metric = validMetrics.includes(rule.metric || '') ? (rule.metric as AlertRule['metric']) : 'cpu';
      const operator = validOperators.includes(rule.operator || '') ? (rule.operator as AlertRule['operator']) : '>';
      const threshold = typeof rule.threshold === 'number' ? rule.threshold : 80;
      const enabled = rule.enabled !== false;

      return {
        id: `rule_custom_${index + 1}`,
        metric,
        operator,
        threshold: Math.max(0, Math.min(100, threshold)),
        enabled,
        label: rule.label || `${metric.toUpperCase()} ${operator} ${threshold}%`,
      };
    });

    // Replace rules and clear active alerts that no longer match
    alertRules = newRules;

    // Resolve all existing active alerts since rules changed
    const now = Date.now();
    for (const alert of activeAlerts) {
      alert.resolvedAt = now;
      alertHistory.unshift(alert);
    }
    activeAlerts = [];
    if (alertHistory.length > MAX_HISTORY) {
      alertHistory = alertHistory.slice(0, MAX_HISTORY);
    }

    return NextResponse.json({ success: true, data: { rules: alertRules } });
  } catch (error) {
    console.error('[Health API] Set alert rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
