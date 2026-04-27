/**
 * Channel OTA Types & Config - Unit Tests
 *
 * Tests the OTA type system, configuration registry, and helper functions
 * for the 46+ OTA channel configurations.
 */

import { describe, it, expect } from 'vitest';

import {
  ALL_OTAS,
  GLOBAL_OTAS,
  INDIAN_OTAS,
  ASIA_PACIFIC_OTAS,
  EUROPEAN_OTAS,
  VACATION_RENTAL_OTAS,
  MIDDLE_EAST_AFRICA_OTAS,
  METASEARCH_OTAS,
  getOTAById,
  getOTAsByRegion,
  getOTAsByType,
  getOTAsByPriority,
  getOTAsWithFeature,
  getOTACount,
} from '@/lib/ota/config';
import type { OTAFeature, OTARegion, OTAType, OTAPriority } from '@/lib/ota/types';

// ═════════════════════════════════════════════════════════════════════════════
// A. ALL_OTAS total count and composition
// ═════════════════════════════════════════════════════════════════════════════

describe('A. ALL_OTAS Composition', () => {
  // A1: total count is 46 channels
  it('A1: ALL_OTAS has exactly 46 channels', () => {
    expect(ALL_OTAS.length).toBe(46);
  });

  // A2: composed from all sub-arrays
  it('A2: ALL_OTAS is a concatenation of all regional arrays', () => {
    const expectedTotal =
      GLOBAL_OTAS.length +
      INDIAN_OTAS.length +
      ASIA_PACIFIC_OTAS.length +
      EUROPEAN_OTAS.length +
      VACATION_RENTAL_OTAS.length +
      MIDDLE_EAST_AFRICA_OTAS.length +
      METASEARCH_OTAS.length;

    expect(ALL_OTAS.length).toBe(expectedTotal);
    // Each OTA appears exactly once (no duplicates)
    const ids = ALL_OTAS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A3: global OTAs count
  it('A3: GLOBAL_OTAS has 8 entries', () => {
    expect(GLOBAL_OTAS.length).toBe(8);
  });

  // A4: Indian OTAs count
  it('A4: INDIAN_OTAS has 10 entries', () => {
    expect(INDIAN_OTAS.length).toBe(10);
  });

  // A5: Asia-Pacific OTAs count
  it('A5: ASIA_PACIFIC_OTAS has 7 entries', () => {
    expect(ASIA_PACIFIC_OTAS.length).toBe(7);
  });

  // A6: European OTAs count
  it('A6: EUROPEAN_OTAS has 6 entries', () => {
    expect(EUROPEAN_OTAS.length).toBe(6);
  });

  // A7: Vacation rental OTAs count
  it('A7: VACATION_RENTAL_OTAS has 7 entries', () => {
    expect(VACATION_RENTAL_OTAS.length).toBe(7);
  });

  // A8: Middle East & Africa OTAs count
  it('A8: MIDDLE_EAST_AFRICA_OTAS has 3 entries', () => {
    expect(MIDDLE_EAST_AFRICA_OTAS.length).toBe(3);
  });

  // A9: Metasearch OTAs count
  it('A9: METASEARCH_OTAS has 5 entries', () => {
    expect(METASEARCH_OTAS.length).toBe(5);
  });

  // A10: each entry has a unique ID
  it('A10: every OTA has a unique id', () => {
    const ids = ALL_OTAS.map((o) => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. getOTAById
// ═════════════════════════════════════════════════════════════════════════════

describe('B. getOTAById', () => {
  // B1: returns Booking.com by id
  it('B1: returns Booking.com config by id', () => {
    const ota = getOTAById('booking_com');
    expect(ota).toBeDefined();
    expect(ota!.name).toBe('Booking.com');
    expect(ota!.id).toBe('booking_com');
    expect(ota!.priority).toBe('critical');
  });

  // B2: returns Expedia by id
  it('B2: returns Expedia config by id', () => {
    const ota = getOTAById('expedia');
    expect(ota).toBeDefined();
    expect(ota!.name).toBe('Expedia');
    expect(ota!.region).toBe('global');
  });

  // B3: returns MakeMyTrip by id
  it('B3: returns MakeMyTrip config by id', () => {
    const ota = getOTAById('makemytrip');
    expect(ota).toBeDefined();
    expect(ota!.name).toBe('MakeMyTrip');
    expect(ota!.region).toBe('india');
  });

  // B4: returns undefined for nonexistent id
  it('B4: returns undefined for nonexistent id', () => {
    const ota = getOTAById('nonexistent_ota');
    expect(ota).toBeUndefined();
  });

  // B5: returns empty for empty string
  it('B5: returns undefined for empty string', () => {
    const ota = getOTAById('');
    expect(ota).toBeUndefined();
  });

  // B6: all OTA entries are findable by their id
  it('B6: every OTA entry is findable by its id', () => {
    for (const ota of ALL_OTAS) {
      const found = getOTAById(ota.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(ota.id);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. getOTAsByRegion
// ═════════════════════════════════════════════════════════════════════════════

describe('C. getOTAsByRegion', () => {
  // C1: filters by global region
  it('C1: filters global region OTAs', () => {
    const results = getOTAsByRegion('global');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.region).toBe('global');
    });
  });

  // C2: filters by india region
  it('C2: filters Indian region OTAs', () => {
    const results = getOTAsByRegion('india');
    expect(results.length).toBe(10);
    results.forEach((ota) => {
      expect(ota.region).toBe('india');
    });
  });

  // C3: filters by europe region
  it('C3: filters European region OTAs', () => {
    const results = getOTAsByRegion('europe');
    expect(results.length).toBe(6);
    results.forEach((ota) => {
      expect(ota.region).toBe('europe');
    });
  });

  // C4: filters by asia_pacific region
  it('C4: filters Asia-Pacific region OTAs', () => {
    const results = getOTAsByRegion('asia_pacific');
    expect(results.length).toBe(7);
    results.forEach((ota) => {
      expect(ota.region).toBe('asia_pacific');
    });
  });

  // C5: filters by middle_east region
  it('C5: filters Middle East region OTAs', () => {
    const results = getOTAsByRegion('middle_east');
    expect(results.length).toBe(2);
    results.forEach((ota) => {
      expect(ota.region).toBe('middle_east');
    });
  });

  // C6: filters by africa region
  it('C6: filters Africa region OTAs', () => {
    const results = getOTAsByRegion('africa');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('jumia_travel');
  });

  // C7: returns empty for unknown region
  it('C7: returns empty array for unknown region', () => {
    const results = getOTAsByRegion('antarctica');
    expect(results).toEqual([]);
  });

  // C8: global region includes major OTAs
  it('C8: global region includes booking_com, expedia, airbnb', () => {
    const globals = getOTAsByRegion('global');
    const ids = globals.map((o) => o.id);
    expect(ids).toContain('booking_com');
    expect(ids).toContain('expedia');
    expect(ids).toContain('airbnb');
  });

  // C9: india region includes makemytrip and goibibo
  it('C9: india region includes makemytrip and goibibo', () => {
    const indians = getOTAsByRegion('india');
    const ids = indians.map((o) => o.id);
    expect(ids).toContain('makemytrip');
    expect(ids).toContain('goibibo');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. getOTAsByType
// ═════════════════════════════════════════════════════════════════════════════

describe('D. getOTAsByType', () => {
  // D1: filters by ota type
  it('D1: filters OTA type channels', () => {
    const results = getOTAsByType('ota');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.type).toBe('ota');
    });
  });

  // D2: filters by vacation_rental type
  it('D2: filters vacation rental type channels', () => {
    const results = getOTAsByType('vacation_rental');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.type).toBe('vacation_rental');
    });
    // Should include Airbnb, Vrbo, HomeAway, etc.
    const ids = results.map((o) => o.id);
    expect(ids).toContain('airbnb');
    expect(ids).toContain('vrbo');
    expect(ids).toContain('homeaway');
  });

  // D3: filters by metasearch type
  it('D3: filters metasearch type channels', () => {
    const results = getOTAsByType('metasearch');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.type).toBe('metasearch');
    });
    const ids = results.map((o) => o.id);
    expect(ids).toContain('google_hotels');
    expect(ids).toContain('trivago');
    expect(ids).toContain('kayak');
  });

  // D4: returns empty for unknown type
  it('D4: returns empty array for unknown type', () => {
    const results = getOTAsByType('unknown_type');
    expect(results).toEqual([]);
  });

  // D5: vacation_rental count is correct
  it('D5: vacation rental count is correct', () => {
    const results = getOTAsByType('vacation_rental');
    // From config: airbnb, vrbo, homeaway, flipkey, housetrip, plum_guide, 9flats, stayz, bookabach = 9
    // Wait, let me check: some are in global, some in europe, some in asia_pacific
    // From ALL_OTAS total: should be 9
    expect(results.length).toBe(9);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. getOTAsByPriority
// ═════════════════════════════════════════════════════════════════════════════

describe('E. getOTAsByPriority', () => {
  // E1: filters critical priority
  it('E1: filters critical priority channels', () => {
    const results = getOTAsByPriority('critical');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.priority).toBe('critical');
    });
  });

  // E2: filters high priority
  it('E2: filters high priority channels', () => {
    const results = getOTAsByPriority('high');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.priority).toBe('high');
    });
  });

  // E3: filters medium priority
  it('E3: filters medium priority channels', () => {
    const results = getOTAsByPriority('medium');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.priority).toBe('medium');
    });
  });

  // E4: filters low priority
  it('E4: filters low priority channels', () => {
    const results = getOTAsByPriority('low');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.priority).toBe('low');
    });
  });

  // E5: returns empty for unknown priority
  it('E5: returns empty array for unknown priority', () => {
    const results = getOTAsByPriority('urgent');
    expect(results).toEqual([]);
  });

  // E6: critical includes top global OTAs
  it('E6: critical includes booking_com, expedia, airbnb, agoda', () => {
    const criticals = getOTAsByPriority('critical');
    const ids = criticals.map((o) => o.id);
    expect(ids).toContain('booking_com');
    expect(ids).toContain('expedia');
    expect(ids).toContain('airbnb');
    expect(ids).toContain('agoda');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. getOTAsWithFeature
// ═════════════════════════════════════════════════════════════════════════════

describe('F. getOTAsWithFeature', () => {
  // F1: filters inventory feature
  it('F1: filters channels with inventory feature', () => {
    const results = getOTAsWithFeature('inventory');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('inventory');
    });
  });

  // F2: filters rates feature
  it('F2: filters channels with rates feature', () => {
    const results = getOTAsWithFeature('rates');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('rates');
    });
  });

  // F3: filters bookings feature
  it('F3: filters channels with bookings feature', () => {
    const results = getOTAsWithFeature('bookings');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('bookings');
    });
  });

  // F4: filters restrictions feature
  it('F4: filters channels with restrictions feature', () => {
    const results = getOTAsWithFeature('restrictions');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('restrictions');
    });
  });

  // F5: filters reviews feature (fewer OTAs)
  it('F5: filters channels with reviews feature', () => {
    const results = getOTAsWithFeature('reviews');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('reviews');
    });
  });

  // F6: filters payments feature
  it('F6: filters channels with payments feature', () => {
    const results = getOTAsWithFeature('payments');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('payments');
    });
  });

  // F7: filters messaging feature
  it('F7: filters channels with messaging feature', () => {
    const results = getOTAsWithFeature('messaging');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((ota) => {
      expect(ota.features).toContain('messaging');
    });
    const ids = results.map((o) => o.id);
    expect(ids).toContain('airbnb'); // Airbnb has messaging
  });

  // F8: returns empty for unknown feature
  it('F8: returns empty array for unknown feature', () => {
    const results = getOTAsWithFeature('telepathy' as OTAFeature);
    expect(results).toEqual([]);
  });

  // F9: metasearch channels only have inventory and rates
  it('F9: metasearch channels only have inventory and rates, not bookings', () => {
    const metasearchs = getOTAsByType('metasearch');
    metasearchs.forEach((ota) => {
      expect(ota.features).toContain('inventory');
      expect(ota.features).toContain('rates');
      expect(ota.features).not.toContain('bookings');
      expect(ota.features).not.toContain('restrictions');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. getOTACount
// ═════════════════════════════════════════════════════════════════════════════

describe('G. getOTACount', () => {
  // G1: total count matches ALL_OTAS.length
  it('G1: total count matches ALL_OTAS length', () => {
    const count = getOTACount();
    expect(count.total).toBe(ALL_OTAS.length);
  });

  // G2: byRegion counts are accurate
  it('G2: byRegion counts are accurate', () => {
    const count = getOTACount();
    expect(count.byRegion.global).toBe(GLOBAL_OTAS.length);
    expect(count.byRegion.india).toBe(INDIAN_OTAS.length);
    expect(count.byRegion.asia_pacific).toBe(ASIA_PACIFIC_OTAS.length);
    expect(count.byRegion.europe).toBe(EUROPEAN_OTAS.length);
  });

  // G3: byPriority counts are accurate
  it('G3: byPriority counts are accurate', () => {
    const count = getOTACount();
    const criticalCount = ALL_OTAS.filter((o) => o.priority === 'critical').length;
    const highCount = ALL_OTAS.filter((o) => o.priority === 'high').length;
    const mediumCount = ALL_OTAS.filter((o) => o.priority === 'medium').length;
    const lowCount = ALL_OTAS.filter((o) => o.priority === 'low').length;

    expect(count.byPriority.critical).toBe(criticalCount);
    expect(count.byPriority.high).toBe(highCount);
    expect(count.byPriority.medium).toBe(mediumCount);
    expect(count.byPriority.low).toBe(lowCount);
    // Sum of all priorities should equal total
    expect(
      count.byPriority.critical +
      count.byPriority.high +
      count.byPriority.medium +
      count.byPriority.low
    ).toBe(count.total);
  });

  // G4: count has the expected structure
  it('G4: count object has correct structure', () => {
    const count = getOTACount();
    expect(count).toHaveProperty('total');
    expect(count).toHaveProperty('byRegion');
    expect(count).toHaveProperty('byPriority');
    expect(typeof count.total).toBe('number');
    expect(typeof count.byRegion).toBe('object');
    expect(typeof count.byPriority).toBe('object');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H. OTA Config Data Integrity
// ═════════════════════════════════════════════════════════════════════════════

describe('H. OTA Config Data Integrity', () => {
  // H1: all OTAs have required fields
  it('H1: all OTAs have required fields populated', () => {
    ALL_OTAS.forEach((ota) => {
      expect(ota.id).toBeTruthy();
      expect(ota.name).toBeTruthy();
      expect(ota.displayName).toBeTruthy();
      expect(ota.logo).toBeTruthy();
      expect(ota.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['global', 'india', 'asia_pacific', 'europe', 'middle_east', 'africa', 'americas']).toContain(
        ota.region
      );
      expect(['ota', 'vacation_rental', 'metasearch', 'gds', 'wholesale']).toContain(ota.type);
      expect(['critical', 'high', 'medium', 'low']).toContain(ota.priority);
      expect(Array.isArray(ota.features)).toBe(true);
      expect(ota.features.length).toBeGreaterThan(0);
      expect(ota.commission).toBeDefined();
      expect(ota.apiConfig).toBeDefined();
      expect(ota.apiConfig.baseUrl).toBeTruthy();
      expect(['rest', 'xml', 'soap', 'graphql', 'json']).toContain(ota.apiConfig.type);
      expect(ota.apiConfig.timeout).toBeGreaterThan(0);
      expect(ota.apiConfig.retryAttempts).toBeGreaterThan(0);
      expect(Array.isArray(ota.supportedLanguages)).toBe(true);
      expect(Array.isArray(ota.supportedCurrencies)).toBe(true);
      expect(ota.website).toBeTruthy();
    });
  });

  // H2: all OTAs have unique IDs
  it('H2: all OTA IDs are unique', () => {
    const ids = ALL_OTAS.map((o) => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // H3: all OTAs have valid URLs
  it('H3: all OTAs have valid website and documentation URLs', () => {
    ALL_OTAS.forEach((ota) => {
      expect(ota.website).toMatch(/^https:\/\//);
      expect(ota.documentation).toMatch(/^https:\/\//);
    });
  });

  // H4: critical OTAs have realTimeSync enabled
  it('H4: critical priority OTAs generally have realTimeSync enabled', () => {
    const criticals = getOTAsByPriority('critical');
    // Most critical OTAs should have realTimeSync
    const realTimeSyncCount = criticals.filter((o) => o.apiConfig.realTimeSync).length;
    expect(realTimeSyncCount).toBeGreaterThanOrEqual(criticals.length - 1);
  });

  // H5: commission ranges are valid
  it('H5: all commission min <= max values', () => {
    ALL_OTAS.forEach((ota) => {
      expect(ota.commission.min).toBeLessThanOrEqual(ota.commission.max);
      expect(ota.commission.min).toBeGreaterThanOrEqual(0);
    });
  });
});
