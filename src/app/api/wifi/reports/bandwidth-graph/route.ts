import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { fetchRRD, userRRDPath, interfaceRRDPath } from '@/lib/rrd';
import { db } from '@/lib/db';
// Node.js-only module — loaded via require() to avoid Turbopack Edge Runtime analysis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = /*turbopackIgnore: true*/ require('fs');

export const runtime = 'nodejs';

// GET /api/wifi/reports/bandwidth-graph - Unified graph data from RRD
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'aggregate';
    const name = searchParams.get('name') || '';
    const range = searchParams.get('range') || '24h';
    const resolution = searchParams.get('resolution');

    // Handle live source — real-time snapshot from radacct
    if (source === 'live') {
      return NextResponse.json(await getLiveSnapshot());
    }

    // Calculate start/end from range
    const now = Math.floor(Date.now() / 1000);
    const rangeSeconds: Record<string, number> = {
      '1h': 3600,
      '6h': 21600,
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000,
      '90d': 7776000,
      '1y': 31536000,
    };
    const seconds = rangeSeconds[range] || 86400;
    const start = now - seconds;

    // Auto-select resolution from range
    let res = resolution ? parseInt(resolution, 10) : undefined;
    if (!res) {
      if (seconds <= 3600) res = 60;       // 1min for 1h
      else if (seconds <= 86400) res = 300; // 5min for 24h
      else if (seconds <= 604800) res = 3600; // 1hr for 7d
      else res = 86400;                      // 1day for 30d+
    }

    // Determine RRD file path based on source
    let rrdPath: string | null = null;
    let cf = 'AVERAGE';

    switch (source) {
      case 'user':
        if (!name) {
          return NextResponse.json(
            { success: false, error: 'Missing "name" parameter for user source' },
            { status: 400 }
          );
        }
        rrdPath = userRRDPath(name);
        break;

      case 'interface':
        if (!name) {
          return NextResponse.json(
            { success: false, error: 'Missing "name" parameter for interface source' },
            { status: 400 }
          );
        }
        rrdPath = interfaceRRDPath(name);
        break;

      case 'aggregate': {
        // Aggregate all active users' RRDs
        return NextResponse.json(await getAggregateData(start, now, res || 300));
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown source: ${source}` },
          { status: 400 }
        );
    }

    // Fetch from RRD
    if (!rrdPath || !fs.existsSync(/*turbopackIgnore: true*/ rrdPath)) {
      return NextResponse.json({
        success: true,
        timestamps: [],
        data: { in: [], out: [] },
        meta: { step: res || 300, range, source, name },
      });
    }

    const result = await fetchRRD(rrdPath, cf, start, now, res);

    return NextResponse.json({
      success: true,
      timestamps: result.timestamps,
      data: result.data,
      meta: {
        step: result.meta.step,
        range,
        source,
        name,
        cf,
      },
    });
  } catch (error) {
    console.error('Error fetching bandwidth graph:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth graph data' } },
      { status: 500 }
    );
  }
}

/**
 * Get aggregate data across all active users
 */
async function getAggregateData(start: number, end: number, resolution: number) {
  try {
    // Get all usernames with active sessions
    const rows: Array<{ username: string }> = await db.$queryRawUnsafe(`
      SELECT DISTINCT username FROM radacct WHERE acctstoptime IS NULL
    `);

    const usernames = rows.map(r => r.username);
    if (usernames.length === 0) {
      return {
        success: true,
        timestamps: [],
        data: { in: [], out: [] },
        meta: { step: resolution, range: '', source: 'aggregate' },
      };
    }

    // Fetch and merge all user RRDs
    const merged: Map<number, { in: number; out: number }> = new Map();

    for (const username of usernames) {
      const rrdPath = userRRDPath(username);
      if (!fs.existsSync(/*turbopackIgnore: true*/ rrdPath)) continue;

      try {
        const result = await fetchRRD(rrdPath, 'AVERAGE', start, end, resolution);

        for (let i = 0; i < result.timestamps.length; i++) {
          const ts = result.timestamps[i];
          const inVal = result.data.in?.[i] || 0;
          const outVal = result.data.out?.[i] || 0;

          if (merged.has(ts)) {
            const existing = merged.get(ts)!;
            existing.in += inVal;
            existing.out += outVal;
          } else {
            merged.set(ts, { in: inVal, out: outVal });
          }
        }
      } catch {
        // Skip failed user RRDs
      }
    }

    // Sort by timestamp
    const sorted = [...merged.entries()].sort((a, b) => a[0] - b[0]);
    const timestamps = sorted.map(([ts]) => ts);
    const data = {
      in: sorted.map(([, v]) => Math.round(v.in)),
      out: sorted.map(([, v]) => Math.round(v.out)),
    };

    return {
      success: true,
      timestamps,
      data,
      meta: { step: resolution, range: '', source: 'aggregate', userCount: usernames.length },
    };
  } catch (error) {
    console.error('Error getting aggregate data:', error);
    return {
      success: true,
      timestamps: [],
      data: { in: [], out: [] },
      meta: { step: resolution, range: '', source: 'aggregate' },
    };
  }
}

/**
 * Get live snapshot from radacct for real-time data
 */
async function getLiveSnapshot() {
  try {
    const rows: Array<{
      username: string;
      acctinputoctets: bigint | number;
      acctoutputoctets: bigint | number;
      framedipaddress: string | null;
      callingstationid: string | null;
      acctstarttime: Date;
      acctsessiontime: bigint | number;
    }> = await db.$queryRawUnsafe(`
      SELECT
        username,
        acctinputoctets,
        acctoutputoctets,
        framedipaddress,
        callingstationid,
        acctstarttime,
        acctsessiontime
      FROM radacct
      WHERE acctstoptime IS NULL
      ORDER BY acctinputoctets + acctoutputoctets DESC
    `);

    const totalIn = rows.reduce((s, r) => s + Number(r.acctinputoctets || 0), 0);
    const totalOut = rows.reduce((s, r) => s + Number(r.acctoutputoctets || 0), 0);

    return {
      success: true,
      live: true,
      data: {
        activeSessions: rows.length,
        totalDownload: totalOut,
        totalUpload: totalIn,
        users: rows.map(r => ({
          username: r.username,
          download: Number(r.acctoutputoctets || 0),
          upload: Number(r.acctinputoctets || 0),
          ip: r.framedipaddress,
          mac: r.callingstationid,
          startTime: r.acctstarttime,
          sessionTime: Number(r.acctsessiontime || 0),
        })),
      },
      meta: { source: 'live', timestamp: Date.now() },
    };
  } catch (error) {
    console.error('Error getting live snapshot:', error);
    return {
      success: true,
      live: true,
      data: { activeSessions: 0, totalDownload: 0, totalUpload: 0, users: [] },
      meta: { source: 'live', timestamp: Date.now() },
    };
  }
}
