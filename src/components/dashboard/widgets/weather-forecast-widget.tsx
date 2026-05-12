'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  Wind,
  Droplets,
  MapPin,
  ThermometerSun,
  CloudSun,
  CloudDrizzle,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────

type ForecastCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'drizzle' | 'thunderstorm' | 'snow';

interface ForecastDay {
  dayName: string;
  date: string;
  high: number;
  low: number;
  condition: ForecastCondition;
}

interface CurrentConditions {
  temp: number;
  feelsLike: number;
  condition: ForecastCondition;
  conditionText: string;
  humidity: number;
  windSpeed: number;
  windDir: string;
  uvIndex: number;
}

interface WeatherForecastData {
  location: string;
  region: string;
  current: CurrentConditions;
  forecast: ForecastDay[];
  globalHigh: number;
  globalLow: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const DARJEELING_WEATHER: WeatherForecastData = {
  location: 'Darjeeling',
  region: 'West Bengal, India',
  current: {
    temp: 14,
    feelsLike: 11,
    condition: 'partly_cloudy',
    conditionText: 'Partly Cloudy',
    humidity: 72,
    windSpeed: 18,
    windDir: 'NE',
    uvIndex: 4,
  },
  forecast: [
    { dayName: 'Today', date: 'Jun 15', high: 16, low: 10, condition: 'partly_cloudy' },
    { dayName: 'Tue', date: 'Jun 16', high: 18, low: 11, condition: 'sunny' },
    { dayName: 'Wed', date: 'Jun 17', high: 15, low: 9, condition: 'rain' },
    { dayName: 'Thu', date: 'Jun 18', high: 13, low: 8, condition: 'thunderstorm' },
    { dayName: 'Fri', date: 'Jun 19', high: 17, low: 10, condition: 'cloudy' },
  ],
  globalHigh: 18,
  globalLow: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getConditionMeta(condition: ForecastCondition): {
  Icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  glowClass: string;
} {
  const map: Record<ForecastCondition, { Icon: LucideIcon; colorClass: string; bgClass: string; glowClass: string }> = {
    sunny: {
      Icon: Sun,
      colorClass: 'text-amber-500 dark:text-amber-400',
      bgClass: 'bg-amber-100/80 dark:bg-amber-900/40',
      glowClass: 'shadow-amber-400/30',
    },
    partly_cloudy: {
      Icon: CloudSun,
      colorClass: 'text-amber-400 dark:text-amber-300',
      bgClass: 'bg-amber-50/80 dark:bg-amber-950/30',
      glowClass: 'shadow-amber-300/20',
    },
    cloudy: {
      Icon: Cloud,
      colorClass: 'text-slate-500 dark:text-slate-400',
      bgClass: 'bg-slate-100/80 dark:bg-slate-800/40',
      glowClass: 'shadow-slate-400/20',
    },
    rain: {
      Icon: CloudRain,
      colorClass: 'text-teal-500 dark:text-teal-400',
      bgClass: 'bg-teal-50/80 dark:bg-teal-900/30',
      glowClass: 'shadow-teal-400/20',
    },
    drizzle: {
      Icon: CloudDrizzle,
      colorClass: 'text-teal-400 dark:text-teal-300',
      bgClass: 'bg-teal-50/60 dark:bg-teal-900/20',
      glowClass: 'shadow-teal-300/15',
    },
    thunderstorm: {
      Icon: CloudLightning,
      colorClass: 'text-violet-500 dark:text-violet-400',
      bgClass: 'bg-violet-50/80 dark:bg-violet-900/30',
      glowClass: 'shadow-violet-400/20',
    },
    snow: {
      Icon: CloudSnow,
      colorClass: 'text-cyan-400 dark:text-cyan-300',
      bgClass: 'bg-cyan-50/80 dark:bg-cyan-900/30',
      glowClass: 'shadow-cyan-400/20',
    },
  };
  return map[condition];
}

function getTempBarGradient(high: number, low: number, globalHigh: number, globalLow: number): string {
  const avgTemp = (high + low) / 2;
  const range = globalHigh - globalLow || 1;
  const normalized = (avgTemp - globalLow) / range;
  if (normalized > 0.7) return 'from-rose-400 via-amber-400 to-orange-300';
  if (normalized > 0.4) return 'from-amber-400 via-yellow-400 to-amber-300';
  return 'from-teal-400 via-cyan-400 to-teal-300';
}

function getTempBarWidth(high: number, low: number, globalHigh: number, globalLow: number): number {
  const range = globalHigh - globalLow || 1;
  const width = ((high - low) / range) * 100;
  return Math.max(width, 15);
}

function getTempBarOffset(low: number, globalHigh: number, globalLow: number): number {
  const range = globalHigh - globalLow || 1;
  return ((low - globalLow) / range) * 100;
}

// ── Skeleton Component ────────────────────────────────────────────────────

function WeatherForecastSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-amber-400 via-teal-400 to-slate-400" />
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
        {/* Forecast days */}
        <div className="space-y-2.5 pt-2 border-t border-border/30">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1">
                <Skeleton className="h-2 rounded-full" />
              </div>
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Forecast Day Row ──────────────────────────────────────────────────────

function ForecastDayRow({
  day,
  index,
  globalHigh,
  globalLow,
}: {
  day: ForecastDay;
  index: number;
  globalHigh: number;
  globalLow: number;
}) {
  const { Icon, colorClass } = getConditionMeta(day.condition);
  const barGradient = getTempBarGradient(day.high, day.low, globalHigh, globalLow);
  const barWidth = getTempBarWidth(day.high, day.low, globalHigh, globalLow);
  const barOffset = getTempBarOffset(day.low, globalHigh, globalLow);
  const isToday = day.dayName === 'Today';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors',
        isToday ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/40'
      )}
    >
      {/* Day name */}
      <span className={cn(
        'text-xs font-medium w-10 shrink-0',
        isToday ? 'text-primary' : 'text-muted-foreground'
      )}>
        {day.dayName}
      </span>

      {/* Weather icon */}
      <AnimatePresence mode="wait">
        <motion.div
          key={day.condition}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25 }}
          className={cn('h-5 w-5 rounded-md flex items-center justify-center', getConditionMeta(day.condition).bgClass)}
        >
          <Icon className={cn('h-3.5 w-3.5', colorClass)} />
        </motion.div>
      </AnimatePresence>

      {/* Low temp */}
      <span className="text-[11px] font-medium text-muted-foreground/70 tabular-nums w-6 text-right shrink-0">
        {day.low}°
      </span>

      {/* Temperature bar */}
      <div className="flex-1 h-2 bg-muted/50 rounded-full relative overflow-hidden">
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{
            width: `${barWidth}%`,
            left: `${barOffset}%`,
            opacity: 1,
          }}
          transition={{ delay: 0.5 + index * 0.08, duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'absolute top-0 h-full rounded-full bg-gradient-to-r',
            barGradient
          )}
        />
      </div>

      {/* High temp */}
      <span className="text-[11px] font-bold text-foreground tabular-nums w-6 shrink-0">
        {day.high}°
      </span>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function WeatherForecastWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<WeatherForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(DARJEELING_WEATHER);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !data) {
    return <WeatherForecastSkeleton />;
  }

  const { Icon: CurrentIcon, colorClass, bgClass, glowClass } = getConditionMeta(data.current.condition);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden hover-lift transition-all duration-300">
        {/* Gradient accent line */}
        <div className="h-[2px] bg-gradient-to-r from-amber-400 via-teal-400 to-slate-400" />

        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{data.location}</h3>
                <p className="text-[10px] text-muted-foreground/60">{data.region}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-primary/40 text-primary bg-primary/5 font-medium">
              {t('weather5Day')}
            </Badge>
          </div>

          {/* Current Conditions */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30">
            {/* Large weather icon */}
            <motion.div
              key={data.current.condition}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0',
                bgClass,
                glowClass
              )}
            >
              <CurrentIcon className={cn('h-7 w-7', colorClass)} />
            </motion.div>

            {/* Temperature + condition */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <motion.span
                  key={data.current.temp}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-3xl font-bold text-foreground tabular-nums leading-none"
                >
                  {data.current.temp}°C
                </motion.span>
              </div>
              <p className={cn('text-xs font-medium mt-0.5', colorClass)}>
                {data.current.conditionText}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <Droplets className="h-3 w-3 text-teal-500 dark:text-teal-400" />
                  <span>{data.current.humidity}%</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <Wind className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                  <span>{data.current.windSpeed} km/h</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <ThermometerSun className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                  <span>Feels {data.current.feelsLike}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Day Forecast */}
          <div className="space-y-1 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between px-2 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {t('weatherForecast')}
              </p>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50">
                <span className="flex items-center gap-0.5">
                  <span className="w-2 h-1.5 rounded-sm bg-gradient-to-r from-teal-400 to-cyan-300" />
                  {t('weatherCool')}
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="w-2 h-1.5 rounded-sm bg-gradient-to-r from-amber-400 to-rose-400" />
                  {t('weatherWarm')}
                </span>
              </div>
            </div>

            {data.forecast.map((day, i) => (
              <ForecastDayRow
                key={day.dayName}
                day={day}
                index={i}
                globalHigh={data.globalHigh}
                globalLow={data.globalLow}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
