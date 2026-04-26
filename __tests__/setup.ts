// Test setup - global test configuration
// This file is loaded by vitest before any tests run
// See vitest.config.ts -> setupFiles: ['__tests__/setup.ts']

import { beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env file explicitly to ensure DATABASE_URL is available for Prisma
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    }
  }
} catch {
  console.warn(`Warning: Could not load ${envPath}`);
}

import { db } from '@/lib/db';

/**
 * Global test configuration for Property Management tests.
 * Uses the REAL PostgreSQL database with seeded data.
 * Tests should create sessions in the DB for authenticated requests.
 */
beforeAll(async () => {
  // Ensure database connection is working
  try {
    await db.$connect();
    // Quick connectivity check
    const tenantCount = await db.tenant.count();
    if (tenantCount === 0) {
      throw new Error('Database appears empty. Run `bun run db:seed` first.');
    }
  } catch (error) {
    console.error('Test setup failed: could not connect to database.', error);
    throw error;
  }
});

afterAll(async () => {
  await db.$disconnect();
});
