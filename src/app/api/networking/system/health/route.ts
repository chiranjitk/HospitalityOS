import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getSystemMetrics } from '@/lib/system-metrics';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

/**
 * GET /api/networking/system/health
 *
 * Returns real system health metrics from /proc filesystem.
 * Falls back to live system calls when no DB record exists.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    // Check if we have stored health data in the database (only if propertyId provided)
    if (propertyId) {
      const health = await db.systemNetworkHealth.findUnique({
        where: { propertyId },
      });

      if (health) {
        return NextResponse.json({
          hostname: health.hostname,
          kernel: health.kernelVersion,
          uptime: health.uptime,
          cpuUsage: health.cpuUsage,
          ramTotal: health.ramTotal,
          ramUsed: health.ramUsed,
          diskTotal: health.diskTotal,
          diskUsed: health.diskUsed,
          cpuTemperature: health.cpuTemperature,
          services: JSON.parse(health.services),
          lastUpdated: health.lastUpdated,
        });
      }
    }

    // No DB record — fetch LIVE metrics from the system (no mock/dummy data)
    const snapshot = await getSystemMetrics();
    const hostname = os.hostname();
    const uptime = Math.floor(os.uptime());

    // Read kernel version from /proc/version
    let kernel = 'unknown';
    try {
      const procVersion = fs.readFileSync('/proc/version', 'utf-8');
      const km = procVersion.match(/Linux version (\S+)/);
      if (km) kernel = km[1];
    } catch { /* ignore */ }

    // Read CPU temperature from thermal zone (Rocky Linux / standard Linux)
    let cpuTemperature: number | null = null;
    try {
      const thermalPaths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/hwmon/hwmon0/temp1_input',
      ];
      for (const tp of thermalPaths) {
        if (fs.existsSync(tp)) {
          const raw = parseInt(fs.readFileSync(tp, 'utf-8').trim(), 10);
          if (!isNaN(raw)) {
            cpuTemperature = raw >= 1000 ? raw / 1000 : raw; // Some report in millidegrees
            break;
          }
        }
      }
    } catch { /* ignore */ }

    // Check service status via systemd or process checking
    const services = await getServiceStatus();

    return NextResponse.json({
      hostname,
      kernel,
      uptime,
      cpuUsage: snapshot.cpu.usage,
      ramTotal: Math.round(snapshot.memory.total / (1024 * 1024)), // MB
      ramUsed: Math.round(snapshot.memory.used / (1024 * 1024)),   // MB
      diskTotal: Math.round(snapshot.disk.total / (1024 * 1024)),   // MB
      diskUsed: Math.round(snapshot.disk.used / (1024 * 1024)),     // MB
      cpuTemperature,
      services,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch system health' }, { status: 500 });
  }
}

/**
 * Check real service status using systemctl or process table.
 */
async function getServiceStatus(): Promise<Record<string, { running: boolean; pid?: number }>> {
  const serviceNames = ['freeradius', 'kea-dhcp4', 'dnsmasq', 'nginx', 'cron'];
  const result: Record<string, { running: boolean; pid?: number }> = {};

  for (const svc of serviceNames) {
    try {
      // Try systemctl is-active first
      const { stdout } = await execFileAsync('systemctl', ['is-active', svc], { timeout: 3000 });
      const status = stdout.trim();
      result[svc] = { running: status === 'active' };

      // Get PID if running
      if (status === 'active') {
        try {
          const { stdout: pidOut } = await execFileAsync('systemctl', ['show', svc, '--property=MainPID'], { timeout: 3000 });
          const pidMatch = pidOut.match(/MainPID=(\d+)/);
          if (pidMatch && parseInt(pidMatch[1], 10) > 0) {
            result[svc].pid = parseInt(pidMatch[1], 10);
          }
        } catch { /* ignore pid fetch */ }
      }
    } catch {
      // systemctl not available or service not found — check via pgrep
      try {
        const { stdout } = await execFileAsync('pgrep', ['-x', svc], { timeout: 2000 });
        const pids = stdout.trim().split('\n').filter(Boolean);
        result[svc] = { running: pids.length > 0, pid: pids.length > 0 ? parseInt(pids[0], 10) : undefined };
      } catch {
        result[svc] = { running: false };
      }
    }
  }

  // Check nftables (kernel module, not a systemd service)
  try {
    await execFileAsync('nft', ['list', 'ruleset'], { timeout: 3000 });
    result['nftables'] = { running: true };
  } catch {
    result['nftables'] = { running: false };
  }

  return result;
}
