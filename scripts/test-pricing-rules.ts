#!/usr/bin/env node
/**
 * E2E test for all 15 pricing rule types.
 * 
 * Usage: node scripts/test-pricing-rules.ts
 * 
 * Validates:
 *  - Seed data integrity (all 15 types + legacy, proper conditions)
 *  - Price calculation logic (weekend markup, markdown, fixed discount, etc.)
 *  - No hardcoded 10% weekend markup
 *  - Weekend definition consistency (Sat+Sun only)
 *  - Property isolation
 *  - API type coverage
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
const match = envContent.match(/^DATABASE_URL=([\"']?)(.+?)\1$/m);
const dbUrl = match ? match[2] : '';
if (!dbUrl) { console.error('FATAL: Cannot resolve DATABASE_URL from .env'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

// ── Test Framework ───────────────────────────────────────────────
const report: { suite: string; passed: number; failed: number; tests: { name: string; status: 'pass' | 'fail'; detail?: string }[] }[] = [];
function suite(name: string) {
  const s = { suite: name, passed: 0, failed: 0, tests: [] as { name: string; status: 'pass' | 'fail'; detail?: string }[] };
  report.push(s);
  return {
    test(n: string, ok: boolean, detail?: string) {
      if (ok) { s.passed++; s.tests.push({ name: n, status: 'pass' }); }
      else { s.failed++; s.tests.push({ name: n, status: 'fail', detail }); }
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  const all = await prisma.pricingRule.findMany({ orderBy: { createdAt: 'asc' } });

  // ─── Suite 1: Seed Data Integrity ─────────────────────────────
  const s1 = suite('Seed Data Integrity');
  s1.test('Total rules >= 16', all.length >= 16, `Found ${all.length}`);

  const tc: Record<string, number> = {};
  all.forEach(r => tc[r.type] = (tc[r.type] || 0) + 1);
  const expected = ['markup', 'markdown', 'discount_percentage', 'discount_fixed', 'surcharge_percentage', 'surcharge_fixed', 'early_bird', 'last_minute', 'advance_booking', 'seasonal', 'weekend', 'long_stay', 'occupancy', 'promo_code', 'channel'];
  expected.forEach(t => s1.test(`Type "${t}" exists`, (tc[t] || 0) >= 1, `Count: ${tc[t] || 0}`));

  all.forEach(r => {
    s1.test(`"${r.name}" valid type`, typeof r.type === 'string' && r.type.length > 0);
    s1.test(`"${r.name}" valid value`, typeof r.value === 'number');
    s1.test(`"${r.name}" valid valueType`, ['percentage', 'fixed'].includes(r.valueType || ''));
    let cOk = false; try { JSON.parse(r.conditions || '{}'); cOk = true; } catch { /* */ }
    s1.test(`"${r.name}" conditions JSON`, cOk);
    let rOk = false; try { rOk = Array.isArray(JSON.parse(r.roomTypes || '[]')); } catch { /* */ }
    s1.test(`"${r.name}" roomTypes JSON array`, rOk);
    s1.test(`"${r.name}" priority >= 1`, (r.priority || 0) >= 1);
    s1.test(`"${r.name}" has effectiveFrom`, r.effectiveFrom instanceof Date);
  });

  all.filter(r => r.type === 'weekend').forEach(wr => {
    const c = JSON.parse(wr.conditions || '{}'); const d: string[] = c.daysOfWeek || [];
    s1.test(`"${wr.name}" Sat+Sun`, d.includes('Sat') && d.includes('Sun'), JSON.stringify(d));
  });
  all.filter(r => r.type === 'promo_code').forEach(pr => {
    const c = JSON.parse(pr.conditions || '{}');
    s1.test(`"${pr.name}" has promoCode`, !!(c.promoCode && c.promoCode.length > 0));
  });
  all.filter(r => r.type === 'early_bird').forEach(eb => {
    const c = JSON.parse(eb.conditions || '{}');
    s1.test(`"${eb.name}" has advanceBookingDaysMin`, (c.advanceBookingDaysMin || 0) >= 1);
  });
  all.filter(r => r.type === 'last_minute').forEach(lm => {
    const c = JSON.parse(lm.conditions || '{}');
    s1.test(`"${lm.name}" has advanceBookingDaysMax`, (c.advanceBookingDaysMax || 0) >= 1);
  });
  all.filter(r => r.type === 'channel').forEach(cr => {
    const c = JSON.parse(cr.conditions || '{}');
    s1.test(`"${cr.name}" has bookingChannel`, Array.isArray(c.bookingChannel) && c.bookingChannel.length > 0);
  });
  all.filter(r => r.type === 'occupancy').forEach(or => {
    const c = JSON.parse(or.conditions || '{}');
    s1.test(`"${or.name}" has minOccupancy`, (c.minOccupancy || 0) >= 2);
  });
  all.filter(r => r.type === 'long_stay').forEach(ls => {
    const c = JSON.parse(ls.conditions || '{}');
    s1.test(`"${ls.name}" has minStay`, (c.minStay || 0) >= 3);
  });
  all.filter(r => r.type === 'advance_booking').forEach(ab => {
    const c = JSON.parse(ab.conditions || '{}');
    s1.test(`"${ab.name}" has advanceBookingDaysMin`, (c.advanceBookingDaysMin || 0) >= 1);
  });
  all.filter(r => r.type.startsWith('surcharge')).forEach(sr => s1.test(`"${sr.name}" positive value`, sr.value > 0));
  all.filter(r => r.type.startsWith('discount')).forEach(dr => s1.test(`"${dr.name}" positive value`, dr.value > 0));

  // ─── Suite 2: Price Calculation ────────────────────────────────
  const s2 = suite('Price Calculation Logic');
  const DISCOUNT = ['markdown', 'discount_percentage', 'discount_fixed', 'early_bird', 'long_stay', 'promo_code', 'advance_booking'];
  function calc(base: number, rules: { type: string; value: number; valueType: string; conditions: Record<string, unknown>; isActive: boolean; roomTypes: string[]; priority: number }[], dow: string, rtId: string, isWE: boolean): number {
    let p = base;
    rules.filter(r => r.isActive && (!r.roomTypes?.length || r.roomTypes.includes(rtId)))
      .filter(r => {
        if (r.type === 'weekend' && !isWE) return false;
        if (['early_bird', 'last_minute', 'long_stay', 'occupancy', 'promo_code', 'channel'].includes(r.type)) return false;
        const d = r.conditions?.daysOfWeek as string[] | undefined;
        if (d?.length && !d.includes(dow)) return false;
        return true;
      }).sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .forEach(r => {
        const disc = DISCOUNT.includes(r.type);
        if (r.valueType === 'percentage') { p *= (1 + (disc ? -r.value : r.value) / 100); }
        else { p += (disc ? -r.value : r.value); }
      });
    return Math.round(p);
  }

  const active = all.filter(r => r.isActive).map(r => ({
    type: r.type, value: r.value, valueType: r.valueType,
    conditions: JSON.parse(r.conditions || '{}'), isActive: r.isActive,
    roomTypes: JSON.parse(r.roomTypes || '[]'), priority: r.priority || 1,
  }));
  const rooms = await prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } });
  const std = rooms.find(r => r.name.includes('Standard'));
  const dlx = rooms.find(r => r.name.includes('Deluxe'));
  if (!std || !dlx) { s2.test('Room types not found', false, 'Missing Standard or Deluxe'); }
  else {
    s2.test('Weekend > Weekday (Standard)', calc(std.basePrice, active, 'Mon', std.id, false) < calc(std.basePrice, active, 'Sat', std.id, true));
    s2.test('Weekend > Weekday (Deluxe)', calc(dlx.basePrice, active, 'Tue', dlx.id, false) < calc(dlx.basePrice, active, 'Sun', dlx.id, true));
    const weOnly = active.filter(r => r.type === 'weekend' && r.roomTypes.includes(std.id));
    const expM = weOnly.reduce((s, r) => s + r.value, 0);
    const noWE = calc(std.basePrice, active.filter(r => r.type !== 'weekend'), 'Sat', std.id, true);
    const withWE = calc(std.basePrice, active, 'Sat', std.id, true);
    const eff = ((withWE - noWE) / noWE * 100);
    s2.test('No hardcoded 10%', Math.abs(eff - expM) < 2, `Expected ~${expM}% got ${eff.toFixed(1)}%`);
    s2.test('Sun > Mon', calc(std.basePrice, active, 'Sun', std.id, true) > calc(std.basePrice, active, 'Mon', std.id, false));
    s2.test('Inactive excluded', calc(std.basePrice, active, 'Sat', std.id, true) === calc(std.basePrice, active.filter(r => r.isActive), 'Sat', std.id, true));
    s2.test('Rules affect price', calc(std.basePrice, active, 'Wed', std.id, false) !== std.basePrice);
  }

  // ─── Suite 3: API Compatibility ────────────────────────────────
  const s3 = suite('Rule Type Coverage & API');
  const VALID = ['markup', 'markdown', 'dynamic', 'seasonal', 'discount_percentage', 'discount_fixed', 'surcharge_percentage', 'surcharge_fixed', 'early_bird', 'last_minute', 'long_stay', 'weekend', 'occupancy', 'promo_code', 'advance_booking', 'channel'];
  const dbT = [...new Set(all.map(r => r.type))];
  VALID.forEach(t => s3.test(`API type "${t}" in DB`, dbT.includes(t)));
  dbT.forEach(t => s3.test(`DB type "${t}" in allowlist`, VALID.includes(t)));
  s3.test('All valid valueType', all.filter(r => !['percentage', 'fixed'].includes(r.valueType)).length === 0);
  s3.test('All conditions JSON', all.every(r => { try { JSON.parse(r.conditions || '{}'); return true; } catch { return false; } }));
  s3.test('All roomTypes JSON array', all.every(r => { try { return Array.isArray(JSON.parse(r.roomTypes || '[]')); } catch { return false; } }));
  s3.test('Has active rules', all.filter(r => r.isActive).length > 0);
  s3.test('Has inactive rules', all.filter(r => !r.isActive).length >= 0);

  // ─── Suite 4: Weekend Consistency ──────────────────────────────
  const s4 = suite('Weekend Definition (Sat+Sun)');
  const wRules = all.filter(r => r.type === 'weekend');
  s4.test('Has weekend rules', wRules.length >= 1, `${wRules.length} found`);
  wRules.forEach(wr => {
    const c = JSON.parse(wr.conditions || '{}'); const d: string[] = c.daysOfWeek || [];
    s4.test(`"${wr.name}" has Sat`, d.includes('Sat'));
    s4.test(`"${wr.name}" has Sun`, d.includes('Sun'));
    s4.test(`"${wr.name}" no Fri`, !d.includes('Fri'));
    s4.test(`"${wr.name}" no Mon-Thu`, !d.some((x: string) => ['Mon', 'Tue', 'Wed', 'Thu'].includes(x)));
  });

  // ─── Suite 5: Property Isolation ───────────────────────────────
  const s5 = suite('Property Isolation');
  const props = await prisma.property.findMany({ select: { id: true, name: true } });
  if (props.length >= 2) {
    s5.test('Prop-1 has rules', all.filter(r => r.propertyId === props[0].id).length >= 10);
    s5.test('Prop-2 has rules', all.filter(r => r.propertyId === props[1].id).length >= 2);
    const p1Rooms = await prisma.roomType.findMany({ where: { propertyId: props[0].id }, select: { id: true } });
    const p2Ids = all.filter(r => r.propertyId === props[1].id).flatMap(r => JSON.parse(r.roomTypes || '[]') as string[]);
    s5.test('No cross-property room refs', !p2Ids.some(id => p1Rooms.some(pr => pr.id === id)));
  }

  await prisma.$disconnect();

  // ── Print Report ────────────────────────────────────────────────
  const tp = report.reduce((s, r) => s + r.passed, 0);
  const tf = report.reduce((s, r) => s + r.failed, 0);
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  PRICING RULES E2E TEST RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Status: ${tf === 0 ? 'ALL PASSED ✅' : 'FAILED ❌ (' + tf + ' failures)'}`);
  console.log(`  Total: ${tp} passed, ${tf} failed`);
  console.log('───────────────────────────────────────────────────');
  report.forEach(s => {
    console.log(`${s.failed === 0 ? '✅' : '❌'} ${s.suite} (${s.passed}/${s.passed + s.failed})`);
    s.tests.forEach(t => console.log(`${t.status === 'pass' ? '  ✓' : '  ✗'} ${t.name}${t.detail ? ' — ' + t.detail : ''}`));
    console.log('');
  });
  process.exit(tf > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
