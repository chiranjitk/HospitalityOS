import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { getSystemMetrics } from '@/lib/system-metrics';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// GET /api/wifi/reports/health - System health metrics (100% real from /proc)
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    // Try to get from database if propertyId is provided
    if (propertyId) {
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId },
      });

      if (property) {
        const health = await db.systemNetworkHealth.findUnique({
          where: { propertyId },
        });

        if (health) {
          const ramUsagePercent = health.ramTotal > 0 ? Math.round((health.ramUsed / health.ramTotal) * 100) : 0;
          const diskUsagePercent = health.diskTotal > 0 ? Math.round((health.diskUsed / health.diskTotal) * 100) : 0;

          let services: Record<string, { running?: boolean; pid?: number; uptime?: number; version?: string }> = {};
          if (health.services) {
            try {
              services = JSON.parse(health.services) as typeof services;
            } catch { /* ignore */ }
          }

          const systemInfo = {
            hostname: health.hostname || os.hostname(),
            kernel: health.kernelVersion || getKernelVersion(),
            uptime: health.uptime || Math.floor(os.uptime()),
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            totalRam: health.ramTotal || Math.round(os.totalmem() / (1024 * 1024)),
            cpuCores: os.cpus().length,
          };

          const resources = {
            cpu: Math.round(health.cpuUsage || 0),
            ram: ramUsagePercent,
            disk: diskUsagePercent,
          };

          const serviceList = Object.entries(services).map(([name, info]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            status: info.running ? 'running' : 'stopped',
            pid: info.pid,
            uptime: info.uptime,
            version: info.version,
          }));

          return NextResponse.json({
            success: true,
            data: {
              systemInfo,
              resources,
              services: serviceList,
              interfaceTraffic: [], // Populated from real-time API
              alerts: [],
            },
          });
        }
      }
    }

    // Fallback: Use REAL system metrics from /proc (no simulated data)
    const snapshot = await getSystemMetrics();

    const systemInfo = {
      hostname: os.hostname(),
      kernel: getKernelVersion(),
      uptime: Math.floor(os.uptime()),
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      totalRam: Math.round(os.totalmem() / (1024 * 1024)),
      cpuCores: os.cpus().length,
    };

    const resources = {
      cpu: Math.round(snapshot.cpu.usage),
      ram: Math.round(snapshot.memory.percent),
      disk: Math.round(snapshot.disk.percent),
    };

    // Build interface traffic from real snapshot
    const interfaceTraffic = snapshot.interfaces.map(iface => ({
      name: iface.name,
      rx: iface.rxBytes,
      tx: iface.txBytes,
      rxSpeed: iface.rxSpeed,  // bytes/sec
      txSpeed: iface.txSpeed,  // bytes/sec
    }));

    return NextResponse.json({
      success: true,
      data: {
        systemInfo,
        resources,
        services: [],
        interfaceTraffic,
        alerts: [],
      },
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch system health' } },
      { status: 500 }
    );
  }
}

/**
 * Read kernel version from /proc/version
 */
function getKernelVersion(): string {
  try {
    const content = fs.readFileSync('/proc/version', 'utf-8');
    const match = content.match(/Linux version (\S+)/);
    return match ? `Linux ${match[1]}` : 'Linux';
  } catch {
    return 'Linux';
  }
}
