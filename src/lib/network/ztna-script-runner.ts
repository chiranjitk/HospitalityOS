/**
 * StaySuite ZTNA Script Runner
 *
 * Calls ztna-apply.sh to manage dedicated ZTNA nftables chains
 * (inet mangle: ztna_prerouting + ztna_quarantine).
 *
 * All firewall rule operations go through shell scripts — no direct nft
 * commands from application code. This keeps nftables logic auditable,
 * testable, and replaceable without code changes.
 *
 * Production paths:
 *   Script:  /usr/local/scripts/nftables/ztna-apply.sh
 *   Log:     /usr/local/staysuite/logs/ztna.log
 *
 * Dev/sandbox:
 *   Script:  <project>/scripts/nftables/ztna-apply.sh
 *   Log:     <project>/.staysuite/logs/ztna.log
 */

// Node.js-only module — loaded via require() to avoid Turbopack Edge Runtime analysis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = /*turbopackIgnore: true*/ require('child_process');

import path from 'path';

// ─── Script Path ──────────────────────────────────────────────────
// ZTNA scripts live in scripts/nftables/ (project root level),
// NOT in scripts/staysuite_core/ like the login/logout scripts.
// Production:  /usr/local/scripts/nftables/ztna-apply.sh
// Sandbox:    <project>/scripts/nftables/ztna-apply.sh

const PROJECT_ROOT = /*turbopackIgnore: true*/ process.cwd();
const ZTNA_SCRIPT = process.env.ZTNA_SCRIPT_PATH ||
  (process.env.NODE_ENV === 'production'
    ? '/usr/local/scripts/nftables/ztna-apply.sh'
    : path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'scripts', 'nftables', 'ztna-apply.sh'));

// ─── Types ────────────────────────────────────────────────────────

export interface ZtnaApplyInput {
  assignments: Array<{
    macAddress: string;
    trustLevel: string;
    classId: number;
    isActive: boolean;
  }>;
}

export interface ZtnaScriptResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  parsed?: Record<string, unknown>;
}

// ─── Trust Level → Class ID Mapping ───────────────────────────────

export const TRUST_CLASS_IDS: Record<string, number> = {
  trusted: 10,
  standard: 20,
  restricted: 30,
  quarantine: 0,
};

// ─── Script Executor ─────────────────────────────────────────────

function runZtnaScript(subcommand: string, stdinData?: string, timeoutMs = 10000): ZtnaScriptResult {
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

  const cmd = `'${ZTNA_SCRIPT}' ${subcommand}`;
  console.log(`[ZtnaScriptRunner] >>> ${subcommand}${stdinData ? ' (stdin provided)' : ''}`);

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

    console.log(`[ZtnaScriptRunner] OK exit=0 ${durationMs}ms`);
    return {
      success: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: '',
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

      console.error(`[ZtnaScriptRunner] FAIL exit=${error.status} stderr="${stderr}" ${durationMs}ms`);
      return {
        success: false,
        exitCode: error.status,
        stdout: rawStdout,
        stderr,
        durationMs,
        parsed,
      };
    }

    // Script couldn't be found, timed out, or permission denied
    console.error(`[ZtnaScriptRunner] ERROR msg="${error.message || 'Unknown error'}" ${durationMs}ms`);
    return {
      success: false,
      exitCode: null,
      stdout: '',
      stderr: error.message || 'Unknown error',
      durationMs,
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Apply ZTNA rules from an array of assignments.
 * Passes JSON to ztna-apply.sh apply via stdin.
 */
export function applyZtnaRules(assignments: ZtnaApplyInput['assignments']): ZtnaScriptResult {
  const json = JSON.stringify({ assignments });
  return runZtnaScript('apply', json, 15000);
}

/**
 * Flush all ZTNA rules from both chains.
 */
export function flushZtnaRules(): ZtnaScriptResult {
  return runZtnaScript('flush', undefined, 10000);
}

/**
 * Get status of ZTNA chains (rule counts, existence).
 */
export function getZtnaStatus(): ZtnaScriptResult {
  return runZtnaScript('status', undefined, 5000);
}
