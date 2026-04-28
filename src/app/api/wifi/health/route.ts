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
import { fetchSystemGraph } from '@/lib/rrd/system-rrd';
import fs from 'fs';

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
  const { snapshot, history } = await getMetricsHistory();

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
      history: {
        timestamps: history.map(p => p.timestamp),
        cpu: history.map(p => p.cpu),
        memory: history.map(p => p.memory),
        disk: history.map(p => p.disk),
        interfaces: ifaceHistory,
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

  const validTypes = ['cpu', 'memory', 'disk', 'interface'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { success: false, error: `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  const validRanges = ['1h', '6h', '24h', '7d', '30d', '1y'];
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
 */
async function handleActiveUsers() {
  try {
    const rows: Array<{
      username: string;
      nasipaddress: string | null;
      framedipaddress: string | null;
      callingstationid: string | null;
      acctstarttime: Date | null;
      acctsessiontime: number | bigint | null;
      acctinputoctets: number | bigint | null;
      acctoutputoctets: number | bigint | null;
    }> = await db.$queryRawUnsafe(`
      SELECT
        username,
        nasipaddress,
        framedipaddress,
        callingstationid,
        acctstarttime,
        acctsessiontime,
        acctinputoctets,
        acctoutputoctets
      FROM radacct
      WHERE acctstoptime IS NULL
      ORDER BY acctstarttime DESC
    `);

    const stripCidr = (v: string | null) => (v || '').replace(/\/\d+$/, '');

    const users = rows.map(r => ({
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
  } catch (error) {
    console.error('[Health API] Active users query error:', error);
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
