/**
 * Node.js Dynamic Filesystem Operations
 *
 * Centralises every fs operation whose PATH is determined at RUNTIME
 * (user input, env vars, DB lookups, etc.) so that route handlers can
 * dynamically-import this module.  The dynamic import prevents Turbopack's
 * static file-tracing analysis from flagging "Overly broad file pattern"
 * warnings for these genuinely dynamic paths.
 *
 * ALL functions in this file run exclusively in Node.js runtime.
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Restricted-network helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a file exists.  Used for restricted-network.txt /etc paths.
 */
export function nodeFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Remove a file if it exists.
 */
export function nodeUnlinkFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

/**
 * Ensure a directory exists, creating it recursively if necessary.
 */
export function nodeEnsureDir(dir: string): void {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

/**
 * Write a string to a file (atomic — caller must handle temp-file logic).
 */
export function nodeWriteFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// RRD helpers (used by bandwidth-graph and wifi/health routes)
// ---------------------------------------------------------------------------

/**
 * Check if an RRD file exists at the given path.
 */
export function nodeRrdExists(rrdPath: string): boolean {
  try {
    return fs.existsSync(rrdPath);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Speedtest helper
// ---------------------------------------------------------------------------

/**
 * Spawn a speedtest process.  Returns the ChildProcess so the caller can
 * stream stderr progress events.
 */
export { spawn } from 'child_process';
