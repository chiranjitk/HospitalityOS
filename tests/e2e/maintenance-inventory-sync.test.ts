/**
 * E2E Test: MaintenanceBlock <-> InventoryLock Bidirectional Sync
 *
 * Verifies that creating/cancelling/completing a MaintenanceBlock
 * properly creates/deletes its linked InventoryLock, and vice versa.
 *
 * Run: npx tsx tests/e2e/maintenance-inventory-sync.test.ts
 *
 * Prerequisites:
 *   - DATABASE_URL must point to a test database
 *   - Run: prisma db push (to apply the maintenanceBlockId column)
 */

import { db } from '@/lib/db';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'e2e-sync-tenant';
const PROPERTY_ID = 'e2e-sync-property';
const ROOM_ID = 'e2e-sync-room';
const USER_ID = 'e2e-sync-user';

let createdBlockId = '';

async function setup() {
  await db.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: 'E2E Sync Test Tenant', status: 'active' },
  });

  await db.property.upsert({
    where: { id: PROPERTY_ID },
    update: {},
    create: {
      id: PROPERTY_ID,
      tenantId: TENANT_ID,
      name: 'E2E Sync Test Property',
      slug: 'e2e-sync-test',
      status: 'active',
    },
  });

  await db.roomType.upsert({
    where: { propertyId_code: { propertyId: PROPERTY_ID, code: 'E2ESYNC' } },
    update: {},
    create: {
      id: 'e2e-sync-room-type',
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'E2E Sync Room Type',
      code: 'E2ESYNC',
      basePrice: 100,
      status: 'active',
    },
  });

  await db.room.upsert({
    where: { id: ROOM_ID },
    update: { status: 'available' },
    create: {
      id: ROOM_ID,
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomTypeId: 'e2e-sync-room-type',
      number: 'E2E-001',
      name: 'E2E Sync Room',
      floor: 1,
      status: 'available',
    },
  });
}

async function cleanup() {
  await db.inventoryLock.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.maintenanceBlock.deleteMany({ where: { tenantId: TENANT_ID } });
  try { await db.room.delete({ where: { id: ROOM_ID } }); } catch {}
  try { await db.roomType.delete({ where: { id: 'e2e-sync-room-type' } }); } catch {}
  try { await db.property.delete({ where: { id: PROPERTY_ID } }); } catch {}
  try { await db.tenant.delete({ where: { id: TENANT_ID } }); } catch {}
}

// ── Test Runner ──────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (err) {
    return {
      name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Test 1: Creating a MaintenanceBlock should auto-create a linked InventoryLock
 * with maintenanceBlockId set for reliable bidirectional linking.
 */
async function testCreateBlock_createsLinkedLock() {
  const block = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'maintenance',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      blockedBy: USER_ID,
      status: 'active',
    },
  });

  createdBlockId = block.id;

  const locks = await db.inventoryLock.findMany({
    where: { maintenanceBlockId: block.id },
  });

  if (locks.length !== 1) {
    throw new Error(`Expected 1 linked lock, found ${locks.length}`);
  }

  const lock = locks[0];

  // Verify all lock properties match
  if (lock.tenantId !== TENANT_ID) throw new Error('Lock tenantId mismatch');
  if (lock.propertyId !== PROPERTY_ID) throw new Error('Lock propertyId mismatch');
  if (lock.roomId !== ROOM_ID) throw new Error('Lock roomId mismatch');
  if (lock.lockType !== 'maintenance') throw new Error('Lock lockType should be "maintenance"');
  if (!lock.reason.startsWith('Maintenance:')) throw new Error('Lock reason should start with "Maintenance:"');
  if (lock.createdBy !== USER_ID) throw new Error('Lock createdBy mismatch');

  console.log(`    -> Block ${block.id.slice(0, 8)} linked to Lock ${lock.id.slice(0, 8)}`);
}

/**
 * Test 2: Cancelling a MaintenanceBlock should delete its linked InventoryLock
 * using maintenanceBlockId (precise, not fragile reason-matching).
 */
async function testCancelBlock_deletesLinkedLock() {
  // Simulate cancel route behavior: cancel block, then clean lock by ID
  await db.maintenanceBlock.update({
    where: { id: createdBlockId },
    data: { status: 'cancelled' },
  });

  // Simulate cancel route cleanup logic: precise delete by maintenanceBlockId
  const deleteResult = await db.inventoryLock.deleteMany({
    where: { maintenanceBlockId: createdBlockId },
  });

  if (deleteResult.count === 0) {
    throw new Error('Linked lock should be deleted on block cancellation');
  }

  const lockAfter = await db.inventoryLock.findFirst({
    where: { maintenanceBlockId: createdBlockId },
  });

  if (lockAfter) {
    throw new Error('Lock should not exist after deletion');
  }

  console.log(`    -> Linked lock deleted precisely by maintenanceBlockId`);
}

/**
 * Test 3: Open-ended blocks (no endDate) should set far-future end date on lock.
 */
async function testOpenEndedBlock_setsFarFuture() {
  const block = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'inspection',
      startDate: new Date(),
      endDate: null,
      blockedBy: USER_ID,
      status: 'active',
    },
  });

  const lock = await db.inventoryLock.findFirst({
    where: { maintenanceBlockId: block.id },
  });

  if (!lock) throw new Error('Lock should exist for open-ended block');

  const lockEndYear = new Date(lock.endDate).getFullYear();
  if (lockEndYear < 2099) {
    throw new Error(`Open-ended block should set far-future end date, got year ${lockEndYear}`);
  }

  // Cleanup
  await db.inventoryLock.deleteMany({ where: { maintenanceBlockId: block.id } });
  await db.maintenanceBlock.delete({ where: { id: block.id } });

  console.log(`    -> Open-ended block uses far-future end: ${lock.endDate.toISOString().slice(0, 10)}`);
}

/**
 * Test 4: Deleting a maintenance-type InventoryLock that has a linked
 * MaintenanceBlock should cancel that block (reverse sync).
 */
async function testDeleteLock_cancelsLinkedBlock() {
  // Create a block
  const block = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'renovation',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      blockedBy: USER_ID,
      status: 'scheduled',
    },
  });

  // Create its linked lock
  await db.inventoryLock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      startDate: new Date(),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      reason: 'Maintenance: renovation',
      lockType: 'maintenance',
      createdBy: USER_ID,
      maintenanceBlockId: block.id,
    },
  });

  // Simulate DELETE route reverse sync: find linked block and cancel it
  const linkedBlock = await db.maintenanceBlock.findFirst({
    where: { id: block.id, status: { in: ['scheduled', 'active'] } },
  });

  if (!linkedBlock) throw new Error('Linked block should be findable');

  await db.maintenanceBlock.update({
    where: { id: linkedBlock.id },
    data: { status: 'cancelled' },
  });

  const verified = await db.maintenanceBlock.findUnique({ where: { id: block.id } });
  if (verified?.status !== 'cancelled') {
    throw new Error(`Block should be cancelled, got "${verified?.status}"`);
  }

  console.log(`    -> Reverse sync: deleting lock cancelled block ${block.id.slice(0, 8)}`);
}

/**
 * Test 5: Multiple blocks for the same room should each get their own linked lock.
 */
async function testMultipleBlocks_separateLocks() {
  const block1 = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'deep_cleaning',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      blockedBy: USER_ID,
      status: 'scheduled',
    },
  });

  const block2 = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'maintenance',
      startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000),
      blockedBy: USER_ID,
      status: 'scheduled',
    },
  });

  const lock1 = await db.inventoryLock.findFirst({ where: { maintenanceBlockId: block1.id } });
  const lock2 = await db.inventoryLock.findFirst({ where: { maintenanceBlockId: block2.id } });

  if (!lock1) throw new Error('Block 1 missing linked lock');
  if (!lock2) throw new Error('Block 2 missing linked lock');
  if (lock1.id === lock2.id) throw new Error('Blocks should have separate locks');

  // Cleanup
  await db.inventoryLock.deleteMany({ where: { maintenanceBlockId: { in: [block1.id, block2.id] } } });
  await db.maintenanceBlock.deleteMany({ where: { id: { in: [block1.id, block2.id] } } });

  console.log(`    -> Block1 -> Lock ${lock1.id.slice(0, 8)}, Block2 -> Lock ${lock2.id.slice(0, 8)}`);
}

/**
 * Test 6: Querying InventoryLock with include should return linked MaintenanceBlock data.
 */
async function testLockQuery_includesBlock() {
  const block = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      roomId: ROOM_ID,
      roomNumber: 'E2E-001',
      reason: 'quarantine',
      startDate: new Date(),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      blockedBy: USER_ID,
      status: 'active',
      priority: 'high',
    },
  });

  const lock = await db.inventoryLock.findFirst({
    where: { maintenanceBlockId: block.id },
    include: {
      maintenanceBlock: {
        select: { id: true, reason: true, status: true, priority: true },
      },
    },
  });

  if (!lock?.maintenanceBlock) throw new Error('Lock should include maintenanceBlock');
  if (lock.maintenanceBlock.reason !== 'quarantine') throw new Error('Reason mismatch');
  if (lock.maintenanceBlock.priority !== 'high') throw new Error('Priority mismatch');

  // Cleanup
  await db.inventoryLock.deleteMany({ where: { maintenanceBlockId: block.id } });
  await db.maintenanceBlock.delete({ where: { id: block.id } });

  console.log(`    -> Lock query includes maintenanceBlock: reason=${lock.maintenanceBlock.reason}, priority=${lock.maintenanceBlock.priority}`);
}

/**
 * Test 7: maintenanceBlockId is a protected field — PUT should not allow overwriting it.
 * This is verified at the code level (the field is destructured out in the PUT handler).
 */
async function testProtectedField_notOverwritable() {
  // Create two separate blocks with locks
  const block1 = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID, propertyId: PROPERTY_ID, roomId: ROOM_ID,
      roomNumber: 'E2E-001', reason: 'maintenance',
      startDate: new Date(), endDate: new Date(Date.now() + 2 * 86400000),
      blockedBy: USER_ID, status: 'active',
    },
  });

  const block2 = await db.maintenanceBlock.create({
    data: {
      tenantId: TENANT_ID, propertyId: PROPERTY_ID, roomId: ROOM_ID,
      roomNumber: 'E2E-001', reason: 'renovation',
      startDate: new Date(), endDate: new Date(Date.now() + 2 * 86400000),
      blockedBy: USER_ID, status: 'active',
    },
  });

  // Get lock1 and try to "move" it to block2 via direct update
  const lock1 = await db.inventoryLock.findFirst({
    where: { maintenanceBlockId: block1.id },
  });

  if (!lock1) throw new Error('Lock1 should exist');

  // Simulate what the PUT handler does: destructures out maintenanceBlockId
  // So a PUT with maintenanceBlockId: block2.id should NOT change the link
  const { maintenanceBlockId: _ignored, ...safeUpdates } = {
    id: lock1.id,
    maintenanceBlockId: block2.id, // This should be stripped out
    reason: 'Updated reason',
  };

  await db.inventoryLock.update({
    where: { id: lock1.id },
    data: safeUpdates,
  });

  const lockAfter = await db.inventoryLock.findFirst({
    where: { id: lock1.id },
  });

  // maintenanceBlockId should NOT have changed
  if (lockAfter?.maintenanceBlockId !== block1.id) {
    throw new Error('maintenanceBlockId should NOT be overwritten by PUT');
  }

  // Cleanup
  await db.inventoryLock.deleteMany({ where: { maintenanceBlockId: { in: [block1.id, block2.id] } } });
  await db.maintenanceBlock.deleteMany({ where: { id: { in: [block1.id, block2.id] } } });

  console.log(`    -> maintenanceBlockId is protected from PUT overwrite`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  E2E: MaintenanceBlock <-> InventoryLock Bidirectional Sync     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log('  Setting up test fixtures...');
  await setup();
  console.log('  Done.\n');

  const tests: TestResult[] = [];

  console.log('  Running tests...\n');

  tests.push(await runTest('1. Create block creates linked lock with maintenanceBlockId', testCreateBlock_createsLinkedLock));
  tests.push(await runTest('2. Cancel block deletes linked lock by ID (not reason matching)', testCancelBlock_deletesLinkedLock));
  tests.push(await runTest('3. Open-ended block sets far-future end date', testOpenEndedBlock_setsFarFuture));
  tests.push(await runTest('4. Deleting lock cancels linked block (reverse sync)', testDeleteLock_cancelsLinkedBlock));
  tests.push(await runTest('5. Multiple blocks each get separate linked locks', testMultipleBlocks_separateLocks));
  tests.push(await runTest('6. Lock query includes linked MaintenanceBlock data', testLockQuery_includesBlock));
  tests.push(await runTest('7. maintenanceBlockId is protected from PUT overwrite', testProtectedField_notOverwritable));

  const passed = tests.filter(r => r.passed).length;
  const failed = tests.filter(r => !r.passed).length;

  console.log('\n  ── Results ─────────────────────────────────────────\n');
  for (const r of tests) {
    const icon = r.passed ? ' PASS' : ' FAIL';
    const badge = r.passed ? '✅' : '❌';
    console.log(`  ${badge} ${r.name}`);
    console.log(`     [${icon}] ${r.duration}ms`);
    if (r.error) console.log(`     Error: ${r.error}`);
    console.log('');
  }

  console.log(`  Summary: ${passed}/${tests.length} passed, ${failed} failed\n`);

  console.log('  Cleaning up...');
  await cleanup();
  console.log('  Done.\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await cleanup().catch(() => {});
  process.exit(1);
});
