/**
 * StaySuite Room VLAN Script Runner
 *
 * Calls room-vlan-apply.sh to manage per-room VLAN isolation via:
 *   - nftables chains (inet room_vlan_isolation, hook forward, priority 0)
 *   - VLAN sub-interfaces (ip link add ... type vlan id)
 *   - IP address assignment (ip addr add)
 *   - TC/HTB bandwidth shaping per VLAN
 *
 * All firewall rule operations go through shell scripts — no direct nft
 * commands from application code. This keeps nftables logic auditable,
 * testable, and replaceable without code changes.
 *
 * Production:
 *   Script:  /usr/local/scripts/nftables/room-vlan-apply.sh
 *   Log:     /usr/local/staysuite/logs/room-vlan.log
 *
 * Dev/sandbox:
 *   Script:  <project>/scripts/nftables/room-vlan-apply.sh
 *   Log:     <project>/.staysuite/logs/room-vlan.log
 */

// Node.js-only module — loaded via require() to avoid Turbopack Edge Runtime analysis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = /*turbopackIgnore: true*/ require('child_process');

import path from 'path';

// ─── Script Path ──────────────────────────────────────────────────

const PROJECT_ROOT = /*turbopackIgnore: true*/ process.cwd();
const ROOM_VLAN_SCRIPT = process.env.ROOM_VLAN_SCRIPT_PATH ||
  (process.env.NODE_ENV === 'production'
    ? '/usr/local/scripts/nftables/room-vlan-apply.sh'
    : path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'scripts', 'nftables', 'room-vlan-apply.sh'));

// ─── Types ────────────────────────────────────────────────────────

export interface RoomVlanRule {
  vlanId: number;
  subnet: string;
  gateway: string;
  roomType: string;
  action: 'create' | 'delete';
  bandwidthDown?: number;
  bandwidthUp?: number;
}

export interface RoomVlanScriptResult {
  success: boolean;
  output: string;
  exitCode: number;
  appliedCount?: number;
  deletedCount?: number;
  errors?: number;
  durationMs: number;
  parsed?: Record<string, unknown>;
}

// ─── Default Bandwidth by Room Type (bytes/sec) ───────────────────

export const ROOM_TYPE_BANDWIDTH: Record<string, { down: number; up: number }> = {
  standard: { down: 10485760, up: 5242880 },     // 10 Mbps / 5 Mbps
  suite: { down: 20971520, up: 10485760 },       // 20 Mbps / 10 Mbps
  conference: { down: 20971520, up: 10485760 },  // 20 Mbps / 10 Mbps
  vip: { down: 52428800, up: 26214400 },         // 50 Mbps / 25 Mbps
};

// ─── Script Executor ─────────────────────────────────────────────

function runRoomVlanScript(subcommand: string, stdinData?: string, timeoutMs = 30000): RoomVlanScriptResult {
  const startTime = Date.now();

  // Build environment: inherit process env
  const scriptEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) scriptEnv[k] = v;
  }

  // Dev override for log directory (when not running as root)
  if (/*turbopackIgnore: true*/ process['getuid']?.() !== 0) {
    const projectRoot = /*turbopackIgnore: true*/ process['cwd']();
    scriptEnv.STAYSUITE_DIR = scriptEnv.STAYSUITE_DIR || `${projectRoot}/.staysuite`;
  }

  const cmd = `'${ROOM_VLAN_SCRIPT}' ${subcommand}`;
  console.log(`[RoomVlanRunner] >>> ${subcommand}${stdinData ? ' (stdin provided)' : ''}`);

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: scriptEnv,
      input: stdinData || '',
    });
    const durationMs = Date.now() - startTime;

    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      /* not JSON — ignore */
    }

    console.log(`[RoomVlanRunner] OK exit=0 ${durationMs}ms`);
    return {
      success: true,
      output: stdout.trim(),
      exitCode: 0,
      appliedCount: (parsed?.appliedCount as number) ?? 0,
      deletedCount: (parsed?.deletedCount as number) ?? 0,
      errors: (parsed?.errors as number) ?? 0,
      durationMs,
      parsed,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const error = err as { status?: number; stdout?: string; stderr?: string; message?: string };

    // Script executed but returned non-zero exit code
    if (error.status !== undefined) {
      const stderr = (error.stderr || '').trim();
      const rawStdout = (error.stdout || '').trim();

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(rawStdout);
      } catch {
        /* not JSON */
      }

      console.error(`[RoomVlanRunner] FAIL exit=${error.status} stderr="${stderr}" ${durationMs}ms`);
      return {
        success: false,
        output: stderr || rawStdout || 'Script execution failed',
        exitCode: error.status,
        appliedCount: (parsed?.appliedCount as number) ?? 0,
        deletedCount: (parsed?.deletedCount as number) ?? 0,
        errors: (parsed?.errors as number) ?? 1,
        durationMs,
        parsed,
      };
    }

    // Script couldn't be found, timed out, or permission denied
    console.error(`[RoomVlanRunner] ERROR msg="${error.message || 'Unknown error'}" ${durationMs}ms`);
    return {
      success: false,
      output: error.message || 'Unknown error',
      exitCode: 2,
      durationMs,
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Apply room VLAN rules by passing JSON to room-vlan-apply.sh via stdin.
 *
 * @param rules  Array of room VLAN rules with vlanId, subnet, gateway, etc.
 * @param flush  If true, flush all existing rules before applying new ones
 * @returns Script result with success status, applied count, and output
 */
export function applyRoomVlanRules(rules: RoomVlanRule[], flush: boolean = false): RoomVlanScriptResult {
  const json = JSON.stringify({ rules, flush });
  return runRoomVlanScript('apply', json, 30000);
}

/**
 * Flush all room VLAN nftables rules and remove VLAN sub-interfaces.
 */
export function flushRoomVlanRules(): RoomVlanScriptResult {
  return runRoomVlanScript('flush', undefined, 15000);
}

/**
 * Get status of room VLAN chains and interfaces.
 * Returns JSON with chain info, rule count, and list of active VLAN interfaces.
 */
export function getRoomVlanStatus(): RoomVlanScriptResult {
  return runRoomVlanScript('status', undefined, 10000);
}
