/**
 * Timezone utility functions for backend operations
 * These functions handle timezone-aware date operations for multi-tenant scenarios
 */

/**
 * Get the current date in the tenant's timezone as a YYYY-MM-DD string
 * This is useful for comparing dates without time components
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get the current datetime in the tenant's timezone
 */
export function getNowInTimezone(timezone: string): Date {
  const now = new Date();
  return convertToTimezone(now, timezone);
}

/**
 * Convert a UTC date to the tenant's timezone
 */
export function convertToTimezone(utcDate: Date, timezone: string): Date {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(utcDate);
    
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    return new Date(
      parseInt(getPart('year')),
      parseInt(getPart('month')) - 1,
      parseInt(getPart('day')),
      parseInt(getPart('hour')),
      parseInt(getPart('minute')),
      parseInt(getPart('second'))
    );
  } catch {
    return utcDate;
  }
}

/**
 * Convert a local date in the tenant's timezone to UTC
 */
export function convertFromTimezone(localDate: Date, timezone: string): Date {
  try {
    // Get the offset for the timezone
    const now = new Date();
    const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzString = now.toLocaleString('en-US', { timeZone: timezone });
    
    const utcDate = new Date(utcString);
    const tzDate = new Date(tzString);
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    
    return new Date(localDate.getTime() - offsetMs);
  } catch {
    return localDate;
  }
}

/**
 * Get start of day in the tenant's timezone
 */
export function getStartOfDayInTimezone(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localDate = convertToTimezone(d, timezone);
  localDate.setHours(0, 0, 0, 0);
  return convertFromTimezone(localDate, timezone);
}

/**
 * Get end of day in the tenant's timezone
 */
export function getEndOfDayInTimezone(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localDate = convertToTimezone(d, timezone);
  localDate.setHours(23, 59, 59, 999);
  return convertFromTimezone(localDate, timezone);
}

/**
 * Check if a date string (YYYY-MM-DD) is in the past relative to the tenant's timezone
 */
export function isDateInPast(dateString: string, timezone: string): boolean {
  const todayInTz = getTodayInTimezone(timezone);
  return dateString < todayInTz;
}

/**
 * Check if a date string (YYYY-MM-DD) is today in the tenant's timezone
 */
export function isDateToday(dateString: string, timezone: string): boolean {
  const todayInTz = getTodayInTimezone(timezone);
  return dateString === todayInTz;
}

/**
 * Format a date according to the tenant's date format setting
 */
export function formatDateWithFormat(date: Date | string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format time according to the tenant's time format setting
 */
export function formatTimeWithFormat(time: string | Date, use24Hour: boolean): string {
  let date: Date;
  
  if (typeof time === 'string') {
    if (time.includes('T')) {
      date = new Date(time);
    } else {
      date = new Date(`2000-01-01T${time}`);
    }
  } else {
    date = time;
  }
  
  if (isNaN(date.getTime())) {
    return typeof time === 'string' ? time : '--:--';
  }
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24Hour,
  });
}

/**
 * Get the IANA timezone identifier from a common timezone name or offset
 */
export function normalizeTimezone(timezone: string): string {
  // Common timezone mappings
  const timezoneMap: Record<string, string> = {
    'IST': 'Asia/Kolkata',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'GMT': 'UTC',
    'UTC': 'UTC',
  };
  
  return timezoneMap[timezone] || timezone;
}

/**
 * Get a list of common timezones for dropdowns
 * Organized by region for easy navigation
 */
export function getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
  return [
    // UTC
    { value: 'UTC', label: 'UTC', offset: '+00:00' },
    // Americas
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00/-04:00' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00/-05:00' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00/-06:00' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00/-07:00' },
    { value: 'America/Anchorage', label: 'Alaska', offset: '-09:00/-08:00' },
    { value: 'Pacific/Honolulu', label: 'Hawaii', offset: '-10:00' },
    { value: 'America/Toronto', label: 'Toronto', offset: '-05:00/-04:00' },
    { value: 'America/Vancouver', label: 'Vancouver', offset: '-08:00/-07:00' },
    { value: 'America/Mexico_City', label: 'Mexico City', offset: '-06:00/-05:00' },
    { value: 'America/Sao_Paulo', label: 'Sao Paulo', offset: '-03:00' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires', offset: '-03:00' },
    { value: 'America/Bogota', label: 'Bogota', offset: '-05:00' },
    { value: 'America/Lima', label: 'Lima', offset: '-05:00' },
    { value: 'America/Santiago', label: 'Santiago', offset: '-04:00/-03:00' },
    { value: 'America/Manaus', label: 'Manaus', offset: '-04:00' },
    { value: 'America/Costa_Rica', label: 'Costa Rica', offset: '-06:00' },
    { value: 'America/Puerto_Rico', label: 'Puerto Rico', offset: '-04:00' },
    // Europe
    { value: 'Europe/London', label: 'London', offset: '+00:00/+01:00' },
    { value: 'Europe/Paris', label: 'Paris', offset: '+01:00/+02:00' },
    { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00/+02:00' },
    { value: 'Europe/Madrid', label: 'Madrid', offset: '+01:00/+02:00' },
    { value: 'Europe/Rome', label: 'Rome', offset: '+01:00/+02:00' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam', offset: '+01:00/+02:00' },
    { value: 'Europe/Brussels', label: 'Brussels', offset: '+01:00/+02:00' },
    { value: 'Europe/Zurich', label: 'Zurich', offset: '+01:00/+02:00' },
    { value: 'Europe/Vienna', label: 'Vienna', offset: '+01:00/+02:00' },
    { value: 'Europe/Stockholm', label: 'Stockholm', offset: '+01:00/+02:00' },
    { value: 'Europe/Oslo', label: 'Oslo', offset: '+01:00/+02:00' },
    { value: 'Europe/Copenhagen', label: 'Copenhagen', offset: '+01:00/+02:00' },
    { value: 'Europe/Helsinki', label: 'Helsinki', offset: '+02:00/+03:00' },
    { value: 'Europe/Warsaw', label: 'Warsaw', offset: '+01:00/+02:00' },
    { value: 'Europe/Prague', label: 'Prague', offset: '+01:00/+02:00' },
    { value: 'Europe/Budapest', label: 'Budapest', offset: '+01:00/+02:00' },
    { value: 'Europe/Bucharest', label: 'Bucharest', offset: '+02:00/+03:00' },
    { value: 'Europe/Athens', label: 'Athens', offset: '+02:00/+03:00' },
    { value: 'Europe/Istanbul', label: 'Istanbul', offset: '+03:00' },
    { value: 'Europe/Moscow', label: 'Moscow', offset: '+03:00' },
    { value: 'Europe/Lisbon', label: 'Lisbon', offset: '+00:00/+01:00' },
    { value: 'Europe/Dublin', label: 'Dublin', offset: '+00:00/+01:00' },
    { value: 'Europe/Athens', label: 'Athens', offset: '+02:00/+03:00' },
    { value: 'Europe/Kiev', label: 'Kyiv', offset: '+02:00/+03:00' },
    { value: 'Europe/Sofia', label: 'Sofia', offset: '+02:00/+03:00' },
    { value: 'Europe/Belgrade', label: 'Belgrade', offset: '+01:00/+02:00' },
    { value: 'Europe/Tallinn', label: 'Tallinn', offset: '+02:00/+03:00' },
    { value: 'Europe/Riga', label: 'Riga', offset: '+02:00/+03:00' },
    { value: 'Europe/Vilnius', label: 'Vilnius', offset: '+02:00/+03:00' },
    { value: 'Europe/Reykjavik', label: 'Reykjavik', offset: '+00:00' },
    // Asia
    { value: 'Asia/Kolkata', label: 'Mumbai / Kolkata', offset: '+05:30' },
    { value: 'Asia/Karachi', label: 'Karachi', offset: '+05:00' },
    { value: 'Asia/Dhaka', label: 'Dhaka', offset: '+06:00' },
    { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
    { value: 'Asia/Riyadh', label: 'Riyadh', offset: '+03:00' },
    { value: 'Asia/Tehran', label: 'Tehran', offset: '+03:30' },
    { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: '+08:00' },
    { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+08:00' },
    { value: 'Asia/Taipei', label: 'Taipei', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
    { value: 'Asia/Seoul', label: 'Seoul', offset: '+09:00' },
    { value: 'Asia/Bangkok', label: 'Bangkok', offset: '+07:00' },
    { value: 'Asia/Jakarta', label: 'Jakarta', offset: '+07:00' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh', offset: '+07:00' },
    { value: 'Asia/Manila', label: 'Manila', offset: '+08:00' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur', offset: '+08:00' },
    { value: 'Asia/Colombo', label: 'Colombo', offset: '+05:30' },
    { value: 'Asia/Kathmandu', label: 'Kathmandu', offset: '+05:45' },
    { value: 'Asia/Yangon', label: 'Yangon', offset: '+06:30' },
    { value: 'Asia/Macau', label: 'Macau', offset: '+08:00' },
    { value: 'Asia/Ulaanbaatar', label: 'Ulaanbaatar', offset: '+08:00' },
    // Africa
    { value: 'Africa/Cairo', label: 'Cairo', offset: '+02:00' },
    { value: 'Africa/Lagos', label: 'Lagos', offset: '+01:00' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg', offset: '+02:00' },
    { value: 'Africa/Nairobi', label: 'Nairobi', offset: '+03:00' },
    { value: 'Africa/Casablanca', label: 'Casablanca', offset: '+01:00' },
    { value: 'Africa/Accra', label: 'Accra', offset: '+00:00' },
    { value: 'Africa/Tunis', label: 'Tunis', offset: '+01:00' },
    { value: 'Africa/Addis_Ababa', label: 'Addis Ababa', offset: '+03:00' },
    { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam', offset: '+03:00' },
    { value: 'Africa/Algiers', label: 'Algiers', offset: '+01:00' },
    // Oceania
    { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00/+11:00' },
    { value: 'Australia/Melbourne', label: 'Melbourne', offset: '+10:00/+11:00' },
    { value: 'Australia/Brisbane', label: 'Brisbane', offset: '+10:00' },
    { value: 'Australia/Perth', label: 'Perth', offset: '+08:00' },
    { value: 'Australia/Adelaide', label: 'Adelaide', offset: '+09:30/+10:30' },
    { value: 'Australia/Hobart', label: 'Hobart', offset: '+10:00/+11:00' },
    { value: 'Pacific/Auckland', label: 'Auckland', offset: '+12:00/+13:00' },
    { value: 'Pacific/Fiji', label: 'Fiji', offset: '+12:00/+13:00' },
    { value: 'Pacific/Honolulu', label: 'Honolulu', offset: '-10:00' },
    { value: 'Pacific/Guam', label: 'Guam', offset: '+10:00' },
    { value: 'Pacific/Port_Moresby', label: 'Port Moresby', offset: '+10:00' },
  ];
}
