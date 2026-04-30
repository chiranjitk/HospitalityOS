import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import net from 'net';

// Helper to check if a port is open
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function GET(request: NextRequest) {
  // Basic authentication check — any authenticated user can view system health
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }
  const services = [
    { name: 'PostgreSQL', port: 5432, type: 'database' },
    { name: 'FreeRADIUS', port: 1812, type: 'auth' },
    { name: 'Next.js', port: 3000, type: 'web' },
    { name: 'Realtime', port: 3003, type: 'websocket' },
  ];

  const results = await Promise.all(
    services.map(async (service) => {
      const isUp = await checkPort('localhost', service.port);
      return {
        ...service,
        status: isUp ? 'healthy' : 'down',
        responseTime: isUp ? '<100ms' : 'N/A',
      };
    })
  );

  // Check PostgreSQL more deeply with Prisma
  try {
    const start = Date.now();
    await db.$queryRawUnsafe('SELECT 1');
    const latency = Date.now() - start;
    const pgResult = results.find((r) => r.name === 'PostgreSQL');
    if (pgResult) {
      pgResult.responseTime = `${latency}ms`;
      pgResult.status = latency < 500 ? 'healthy' : 'degraded';
    }
  } catch {
    const pgResult = results.find((r) => r.name === 'PostgreSQL');
    if (pgResult) {
      pgResult.status = 'error';
      pgResult.responseTime = 'timeout';
    }
  }

  return NextResponse.json({
    services: results,
    timestamp: new Date().toISOString(),
  });
}
