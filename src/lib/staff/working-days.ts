import { db } from '@/lib/db';

/**
 * Calculate the actual number of working days in a given month/year.
 * Excludes weekends (Saturday/Sunday) and optionally configured holidays.
 * Falls back to counting weekdays only if no holiday config exists.
 */
export async function getWorkingDaysForMonth(
  year: number,
  month: number, // 1-12
  tenantId?: string
): Promise<number> {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) {
      workingDays++;
    }
  }

  // If tenantId is provided, subtract configured holidays in that month
  if (tenantId) {
    try {
      const holidayConfig = await db.systemConfig.findUnique({
        where: { tenantId_key: { tenantId, key: 'hr_holiday_calendar' } },
      });

      if (holidayConfig) {
        const config = holidayConfig.value as {
          holidays?: Array<{ date: string }>;
          weeklyOffDays?: number[]; // 0=Sunday, 6=Saturday default
        };

        // Recount with custom weekly off days if configured
        if (config.weeklyOffDays && config.weeklyOffDays.length > 0) {
          workingDays = 0;
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dow = date.getDay();
            if (!config.weeklyOffDays.includes(dow)) {
              workingDays++;
            }
          }
        }

        // Subtract holidays that fall on working days
        if (config.holidays && config.holidays.length > 0) {
          const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
          const monthHolidays = config.holidays.filter(h => h.date.startsWith(monthPrefix));
          for (const holiday of monthHolidays) {
            const hDate = new Date(holiday.date);
            const dow = hDate.getDay();
            const isWeekOff = config.weeklyOffDays
              ? config.weeklyOffDays.includes(dow)
              : (dow === 0 || dow === 6);
            if (!isWeekOff) {
              workingDays--;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading holiday config, using weekday-only count:', error);
    }
  }

  return workingDays;
}

/**
 * Get the current year's holiday calendar configuration for a tenant.
 */
export async function getHolidayCalendar(tenantId: string): Promise<{
  holidays: Array<{ date: string; name?: string }>;
  weeklyOffDays: number[];
}> {
  const defaultConfig = {
    holidays: [] as Array<{ date: string; name?: string }>,
    weeklyOffDays: [0, 6] as number[], // Sunday, Saturday
  };

  try {
    const config = await db.systemConfig.findUnique({
      where: { tenantId_key: { tenantId, key: 'hr_holiday_calendar' } },
    });

    if (config) {
      const val = config.value as Record<string, unknown>;
      return {
        holidays: (val.holidays as Array<{ date: string; name?: string }>) || defaultConfig.holidays,
        weeklyOffDays: (val.weeklyOffDays as number[]) || defaultConfig.weeklyOffDays,
      };
    }
  } catch (error) {
    console.error('Error fetching holiday calendar:', error);
  }

  return defaultConfig;
}
