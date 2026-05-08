import { describe, it, expect } from 'vitest';
import {
  getTodayInTimezone,
  getNowInTimezone,
  convertToTimezone,
  convertFromTimezone,
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  isDateInPast,
  isDateToday,
  formatDateWithFormat,
  formatTimeWithFormat,
  normalizeTimezone,
  getCommonTimezones,
} from '@/lib/timezone';

describe('getTodayInTimezone', () => {
  it('should return a string in YYYY-MM-DD format', () => {
    const result = getTodayInTimezone('UTC');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return a valid date', () => {
    const result = getTodayInTimezone('UTC');
    const date = new Date(result);
    expect(isNaN(date.getTime())).toBe(false);
  });

  it('should handle different timezones', () => {
    const utc = getTodayInTimezone('UTC');
    const kolkata = getTodayInTimezone('Asia/Kolkata');
    // Both should be valid YYYY-MM-DD strings
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(kolkata).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle common timezone abbreviations', () => {
    const result = getTodayInTimezone('IST');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should throw RangeError for invalid timezone (Intl.DateTimeFormat does not catch)', () => {
    // getTodayInTimezone does NOT wrap Intl.DateTimeFormat in try-catch,
    // unlike convertToTimezone/convertFromTimezone which do.
    expect(() => getTodayInTimezone('Invalid/Timezone')).toThrow(RangeError);
  });
});

describe('getNowInTimezone', () => {
  it('should return a Date object', () => {
    const result = getNowInTimezone('UTC');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('should return current time in the given timezone', () => {
    const result = getNowInTimezone('UTC');
    const now = new Date();
    // Should be within a few seconds of the current time
    const diffMs = Math.abs(result.getTime() - now.getTime());
    expect(diffMs).toBeLessThan(60000); // within 1 minute
  });
});

describe('convertToTimezone', () => {
  it('should convert a UTC date to local timezone', () => {
    // Create a date at noon UTC
    const utcDate = new Date('2024-06-15T12:00:00Z');
    const result = convertToTimezone(utcDate, 'America/New_York');
    expect(result).toBeInstanceOf(Date);
    // New York is UTC-4 in June (EDT), so noon UTC = 8 AM EDT
    expect(result.getHours()).toBe(8);
  });

  it('should handle UTC timezone', () => {
    const utcDate = new Date('2024-06-15T12:00:00Z');
    const result = convertToTimezone(utcDate, 'UTC');
    expect(result.getHours()).toBe(12);
  });

  it('should handle Asia/Kolkata (UTC+5:30)', () => {
    const utcDate = new Date('2024-06-15T12:00:00Z');
    const result = convertToTimezone(utcDate, 'Asia/Kolkata');
    // 12:00 UTC → 17:30 IST
    expect(result.getHours()).toBe(17);
    expect(result.getMinutes()).toBe(30);
  });

  it('should return the original date for invalid timezone', () => {
    const utcDate = new Date('2024-06-15T12:00:00Z');
    const result = convertToTimezone(utcDate, 'Invalid/Zone');
    expect(result.getTime()).toBe(utcDate.getTime());
  });
});

describe('convertFromTimezone', () => {
  it('should convert a local timezone date back to UTC', () => {
    // Create a date representing 8 AM in New York (which should be 12:00 UTC in EDT)
    const localDate = new Date(2024, 5, 15, 8, 0, 0); // June 15, 8:00 AM local
    const result = convertFromTimezone(localDate, 'America/New_York');
    expect(result).toBeInstanceOf(Date);
  });

  it('should return original date for invalid timezone', () => {
    const localDate = new Date(2024, 5, 15, 8, 0, 0);
    const result = convertFromTimezone(localDate, 'Invalid/Zone');
    expect(result.getTime()).toBe(localDate.getTime());
  });
});

describe('getStartOfDayInTimezone', () => {
  it('should return a Date with time set to midnight in the given timezone', () => {
    const date = new Date('2024-06-15T15:30:00Z');
    const result = getStartOfDayInTimezone(date, 'UTC');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('should accept a date string', () => {
    const result = getStartOfDayInTimezone('2024-06-15T15:30:00Z', 'UTC');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});

describe('getEndOfDayInTimezone', () => {
  it('should return a Date with time set to 23:59:59.999 in the given timezone', () => {
    const date = new Date('2024-06-15T15:30:00Z');
    const result = getEndOfDayInTimezone(date, 'UTC');
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });

  it('should accept a date string', () => {
    const result = getEndOfDayInTimezone('2024-06-15T15:30:00Z', 'UTC');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});

describe('isDateInPast', () => {
  it('should return true for dates before today', () => {
    const pastDate = '2020-01-01';
    expect(isDateInPast(pastDate, 'UTC')).toBe(true);
  });

  it('should return false for dates in the future', () => {
    const futureDate = '2099-12-31';
    expect(isDateInPast(futureDate, 'UTC')).toBe(false);
  });

  it('should return false for today', () => {
    const today = getTodayInTimezone('UTC');
    expect(isDateInPast(today, 'UTC')).toBe(false);
  });
});

describe('isDateToday', () => {
  it('should return true for today', () => {
    const today = getTodayInTimezone('UTC');
    expect(isDateToday(today, 'UTC')).toBe(true);
  });

  it('should return false for a past date', () => {
    expect(isDateToday('2020-01-01', 'UTC')).toBe(false);
  });

  it('should return false for a future date', () => {
    expect(isDateToday('2099-12-31', 'UTC')).toBe(false);
  });
});

describe('formatDateWithFormat', () => {
  const date = new Date(2024, 5, 15); // June 15, 2024

  it('should format as YYYY-MM-DD', () => {
    expect(formatDateWithFormat(date, 'YYYY-MM-DD')).toBe('2024-06-15');
  });

  it('should format as MM/DD/YYYY', () => {
    expect(formatDateWithFormat(date, 'MM/DD/YYYY')).toBe('06/15/2024');
  });

  it('should format as DD/MM/YYYY', () => {
    expect(formatDateWithFormat(date, 'DD/MM/YYYY')).toBe('15/06/2024');
  });

  it('should accept a date string', () => {
    expect(formatDateWithFormat('2024-06-15', 'YYYY-MM-DD')).toBe('2024-06-15');
  });

  it('should default to DD/MM/YYYY for unknown format', () => {
    expect(formatDateWithFormat(date, 'MM-DD-YYYY' as any)).toBe('15/06/2024');
  });

  it('should pad single-digit day/month with zeros', () => {
    const jan5 = new Date(2024, 0, 5); // January 5
    expect(formatDateWithFormat(jan5, 'YYYY-MM-DD')).toBe('2024-01-05');
    expect(formatDateWithFormat(jan5, 'MM/DD/YYYY')).toBe('01/05/2024');
    expect(formatDateWithFormat(jan5, 'DD/MM/YYYY')).toBe('05/01/2024');
  });
});

describe('formatTimeWithFormat', () => {
  it('should format time in 12-hour format', () => {
    expect(formatTimeWithFormat('14:30', false)).toBe('2:30 PM');
  });

  it('should format time in 24-hour format', () => {
    expect(formatTimeWithFormat('14:30', true)).toBe('14:30');
  });

  it('should format midnight in 12-hour', () => {
    expect(formatTimeWithFormat('00:00', false)).toBe('12:00 AM');
  });

  it('should format noon in 12-hour', () => {
    expect(formatTimeWithFormat('12:00', false)).toBe('12:00 PM');
  });

  it('should handle ISO date string input', () => {
    const result = formatTimeWithFormat('2024-06-15T14:30:00Z', false);
    // The exact hour may vary by local timezone; just check it's a valid time string
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });

  it('should handle Date object input', () => {
    const date = new Date(2024, 5, 15, 14, 30, 0);
    const result = formatTimeWithFormat(date, false);
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });

  it('should return original string for invalid time string', () => {
    expect(formatTimeWithFormat('invalid', false)).toBe('invalid');
  });

  it('should return "--:--" for invalid Date object', () => {
    const badDate = new Date('not-a-date');
    expect(formatTimeWithFormat(badDate, false)).toBe('--:--');
  });
});

describe('normalizeTimezone', () => {
  it('should map IST to Asia/Kolkata', () => {
    expect(normalizeTimezone('IST')).toBe('Asia/Kolkata');
  });

  it('should map PST to America/Los_Angeles', () => {
    expect(normalizeTimezone('PST')).toBe('America/Los_Angeles');
  });

  it('should map PDT to America/Los_Angeles', () => {
    expect(normalizeTimezone('PDT')).toBe('America/Los_Angeles');
  });

  it('should map EST to America/New_York', () => {
    expect(normalizeTimezone('EST')).toBe('America/New_York');
  });

  it('should map EDT to America/New_York', () => {
    expect(normalizeTimezone('EDT')).toBe('America/New_York');
  });

  it('should map CST to America/Chicago', () => {
    expect(normalizeTimezone('CST')).toBe('America/Chicago');
  });

  it('should map CDT to America/Chicago', () => {
    expect(normalizeTimezone('CDT')).toBe('America/Chicago');
  });

  it('should map MST to America/Denver', () => {
    expect(normalizeTimezone('MST')).toBe('America/Denver');
  });

  it('should map MDT to America/Denver', () => {
    expect(normalizeTimezone('MDT')).toBe('America/Denver');
  });

  it('should map GMT to UTC', () => {
    expect(normalizeTimezone('GMT')).toBe('UTC');
  });

  it('should pass through IANA timezone names unchanged', () => {
    expect(normalizeTimezone('America/New_York')).toBe('America/New_York');
    expect(normalizeTimezone('Europe/London')).toBe('Europe/London');
    expect(normalizeTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('should pass through UTC unchanged', () => {
    expect(normalizeTimezone('UTC')).toBe('UTC');
  });

  it('should pass through unknown abbreviations unchanged', () => {
    expect(normalizeTimezone('FOO')).toBe('FOO');
  });
});

describe('getCommonTimezones', () => {
  it('should return an array of timezone objects', () => {
    const result = getCommonTimezones();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include UTC', () => {
    const result = getCommonTimezones();
    const utc = result.find(tz => tz.value === 'UTC');
    expect(utc).toBeDefined();
    expect(utc?.label).toBe('UTC');
    expect(utc?.offset).toBe('+00:00');
  });

  it('should include common US timezones', () => {
    const result = getCommonTimezones();
    const values = result.map(tz => tz.value);
    expect(values).toContain('America/New_York');
    expect(values).toContain('America/Chicago');
    expect(values).toContain('America/Denver');
    expect(values).toContain('America/Los_Angeles');
  });

  it('should include Asia/Kolkata', () => {
    const result = getCommonTimezones();
    const kolkata = result.find(tz => tz.value === 'Asia/Kolkata');
    expect(kolkata).toBeDefined();
    expect(kolkata?.offset).toBe('+05:30');
  });

  it('should include Europe/London and Europe/Paris', () => {
    const result = getCommonTimezones();
    const values = result.map(tz => tz.value);
    expect(values).toContain('Europe/London');
    expect(values).toContain('Europe/Paris');
  });

  it('each entry should have value, label, and offset', () => {
    const result = getCommonTimezones();
    for (const tz of result) {
      expect(tz).toHaveProperty('value');
      expect(tz).toHaveProperty('label');
      expect(tz).toHaveProperty('offset');
      expect(typeof tz.value).toBe('string');
      expect(typeof tz.label).toBe('string');
      expect(typeof tz.offset).toBe('string');
    }
  });
});
