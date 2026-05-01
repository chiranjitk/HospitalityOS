/**
 * create-wifi-views.ts
 *
 * Creates / recreates the StaySuite reporting views in PostgreSQL.
 * The view definitions are the single source of truth in:
 *   pgsql-production/02-staysuite-views.sql
 *
 * Usage:
 *   bun run create-wifi-views.ts
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Read the PostgreSQL views SQL file
    const sqlPath = join(__dirname, 'pgsql-production', '02-staysuite-views.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('Executing pgsql-production/02-staysuite-views.sql ...');

    // The SQL file contains a transaction (BEGIN … COMMIT), so we can run it as-is.
    // However, pg Pool does not support multi-statement queries by default,
    // so we strip the outer BEGIN/COMMIT and execute the statements sequentially.
    const stripped = sql
      .replace(/^\s*BEGIN\s*;?\s*$/im, '')
      .replace(/^\s*COMMIT\s*;?\s*$/im, '');

    // Split on statement boundaries (simple approach: split by ';' and filter empty)
    // Skip the DO $$ blocks — we need to handle those as single statements.
    const statements = splitSqlStatements(stripped);

    for (const stmt of statements) {
      if (stmt.trim()) {
        await pool.query(stmt);
      }
    }

    console.log('✅ All reporting views created successfully!');
  } catch (err: any) {
    console.error('❌ Error creating views:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Naive SQL statement splitter that respects DO $$ ... $$ blocks.
 * Splits on top-level semicolons only (not inside $$ blocks).
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;

  for (let i = 0; i < sql.length; i++) {
    // Check for DO $$ or $$
    if (!inDollarBlock && sql.slice(i, i + 5) === '$$') {
      inDollarBlock = true;
      current += sql.slice(i, i + 2);
      i += 1; // skip second $
      continue;
    }
    if (inDollarBlock && sql.slice(i, i + 2) === '$$') {
      inDollarBlock = false;
      current += sql.slice(i, i + 2);
      i += 1;
      continue;
    }

    if (sql[i] === ';' && !inDollarBlock) {
      current += ';';
      statements.push(current);
      current = '';
    } else {
      current += sql[i];
    }
  }

  // Push any remaining content
  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

main();
