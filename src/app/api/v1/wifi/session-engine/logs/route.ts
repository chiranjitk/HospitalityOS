import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import fs from 'fs';
import path from 'path';

// ────────────────────────────────────────────────────────────────
// GET /api/v1/wifi/session-engine/logs
//
// Returns the session engine log file contents.
// Query params:
//   ?lines=100    — last N lines (default: 100, max: 500)
//   ?download=1   — return as text/plain for easy saving
//
// Requires wifi.manage permission.
// ────────────────────────────────────────────────────────────────

const LOG_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'logs');
const LOG_FILE = path.join(/*turbopackIgnore: true*/ LOG_DIR, 'session-engine.log');
const MAX_LINES = 500;

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'wifi.manage');
  if (auth instanceof NextResponse) return auth;

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const linesParam = parseInt(searchParams.get('lines') || '100', 10);
    const download = searchParams.get('download') === '1';
    const lines = Math.min(Math.max(linesParam, 1), MAX_LINES);

    // Read log file
    if (!fs.existsSync(LOG_FILE)) {
      return NextResponse.json({
        success: true,
        data: {
          logFilePath: LOG_FILE,
          lines: [],
          totalLines: 0,
          fileSize: 0,
          message: 'Log file does not exist yet. The session engine will create it on first run.',
        },
      });
    }

    const stat = fs.statSync(LOG_FILE);
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.split('\n').filter(Boolean);
    const recentLines = allLines.slice(-lines);

    if (download) {
      // Return raw text for browser download
      return new NextResponse(allLines.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="session-engine.log"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        logFilePath: LOG_FILE,
        lines: recentLines,
        totalLines: allLines.length,
        fileSize: stat.size,
        showingLastN: recentLines.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to read log file' },
      { status: 500 }
    );
  }
}
