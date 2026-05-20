/**
 * Scheduler Spawn Script — runs background cron jobs in a SEPARATE process.
 *
 * Forked from instrumentation.ts to isolate the heavy dependency graph
 * (node-cron, twilio, wifi/adapters) from Turbopack's module analysis.
 *
 * Uses `npx tsx` to run the TypeScript scheduler-runner.ts in a plain Node process.
 */
const path = require('path');
const { spawn } = require('child_process');

// Ensure DATABASE_URL is available (inherited from parent process)
if (!process.env.DATABASE_URL) {
  try {
    const fs = require('fs');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^DATABASE_URL=(.+)$/);
        if (match) {
          process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  } catch {}
}

if (!process.env.DATABASE_URL) {
  console.error('[Scheduler] ERROR: DATABASE_URL not set — scheduler cannot start');
  process.exit(1);
}

// Spawn tsx with the scheduler runner module
const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
const runnerPath = path.join(process.cwd(), 'scripts', 'scheduler-runner.ts');

const child = spawn(tsxBin, [runnerPath], {
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  env: { ...process.env },
  cwd: process.cwd(),
});

child.stdout?.on('data', (d) => process.stdout.write(d));
child.stderr?.on('data', (d) => process.stderr.write(d));
child.on('exit', (code) => {
  console.log(`[Scheduler] Runner exited with code ${code}`);
  process.exit(code || 0);
});

process.on('SIGTERM', () => { child.kill('SIGTERM'); });
process.on('SIGINT', () => { child.kill('SIGINT'); });
