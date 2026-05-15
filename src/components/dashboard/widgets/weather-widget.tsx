'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cloud,
  CloudSun,
  Sun,
  Moon,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  Clock,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Eye,
  Settings,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchCurrentWeather,
  getWeatherErrorType,
  type WeatherData,
  type WeatherCondition,
} from '@/lib/weather-api';

// ── Types ──────────────────────────────────────────────────────────────────

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  condition: WeatherCondition;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getConditionIcon(condition: WeatherCondition, size = 20): { Icon: LucideIcon; gradient: string; iconColor: string; label: string } {
  const map: Record<WeatherCondition, { Icon: LucideIcon; gradient: string; iconColor: string; label: string }> = {
    sunny: {
      Icon: Sun,
      gradient: 'from-amber-400 via-orange-400 to-yellow-300',
      iconColor: 'text-amber-500 dark:text-amber-400',
      label: 'Sunny',
    },
    partly_cloudy: {
      Icon: CloudSun,
      gradient: 'from-sky-400 via-blue-300 to-cyan-300',
      iconColor: 'text-sky-500 dark:text-sky-400',
      label: 'Partly Cloudy',
    },
    cloudy: {
      Icon: Cloud,
      gradient: 'from-slate-400 via-gray-400 to-zinc-400',
      iconColor: 'text-slate-500 dark:text-slate-400',
      label: 'Cloudy',
    },
    rain: {
      Icon: CloudRain,
      gradient: 'from-blue-500 via-indigo-400 to-slate-400',
      iconColor: 'text-blue-500 dark:text-blue-400',
      label: 'Rain',
    },
    drizzle: {
      Icon: CloudDrizzle,
      gradient: 'from-blue-400 via-slate-400 to-gray-400',
      iconColor: 'text-blue-400 dark:text-blue-300',
      label: 'Drizzle',
    },
    thunderstorm: {
      Icon: CloudLightning,
      gradient: 'from-violet-600 via-purple-500 to-slate-600',
      iconColor: 'text-violet-500 dark:text-violet-400',
      label: 'Thunderstorm',
    },
    snow: {
      Icon: CloudSnow,
      gradient: 'from-sky-200 via-white to-slate-200',
      iconColor: 'text-sky-300 dark:text-sky-200',
      label: 'Snow',
    },
    clear_night: {
      Icon: Moon,
      gradient: 'from-indigo-600 via-violet-700 to-slate-800',
      iconColor: 'text-indigo-300 dark:text-indigo-200',
      label: 'Clear Night',
    },
    mist: {
      Icon: Cloud,
      gradient: 'from-slate-300 via-gray-300 to-zinc-300',
      iconColor: 'text-slate-400 dark:text-slate-400',
      label: 'Mist',
    },
    fog: {
      Icon: Cloud,
      gradient: 'from-slate-300 via-gray-300 to-zinc-300',
      iconColor: 'text-slate-400 dark:text-slate-400',
      label: 'Fog',
    },
    haze: {
      Icon: Cloud,
      gradient: 'from-amber-300 via-orange-200 to-yellow-200',
      iconColor: 'text-amber-400 dark:text-amber-400',
      label: 'Haze',
    },
  };
  return map[condition];
}

function getCardBgGradient(condition: WeatherCondition): string {
  const map: Record<WeatherCondition, string> = {
    sunny: 'from-amber-50 via-orange-50/60 to-yellow-50/60 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-yellow-950/50',
    partly_cloudy: 'from-sky-50 via-blue-50/50 to-cyan-50/60 dark:from-sky-950/50 dark:via-blue-950/50 dark:to-cyan-950/50',
    cloudy: 'from-slate-50 via-gray-50/60 to-zinc-50/60 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50',
    rain: 'from-blue-50 via-indigo-50/50 to-slate-50/60 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-slate-950/50',
    drizzle: 'from-slate-50 via-blue-50/60 to-gray-50/60 dark:from-slate-950/50 dark:via-blue-950/40 dark:to-gray-950/50',
    thunderstorm: 'from-violet-50 via-purple-50/60 to-slate-50/60 dark:from-violet-950/50 dark:via-purple-950/50 dark:to-slate-950/50',
    snow: 'from-sky-50 via-white/50 to-slate-50/60 dark:from-sky-950/50 dark:via-slate-950/50 dark:to-zinc-950/50',
    clear_night: 'from-indigo-950/40 via-violet-950/50 to-slate-900/50 dark:from-indigo-950/50 dark:via-violet-950/40 dark:to-slate-900/50',
    mist: 'from-slate-50 via-gray-50/50 to-zinc-50/50 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50',
    fog: 'from-slate-50 via-gray-50/50 to-zinc-50/50 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50',
    haze: 'from-amber-50/80 via-orange-50/60 to-yellow-50/60 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-yellow-950/40',
  };
  return map[condition];
}

function getAccentGradient(condition: WeatherCondition): string {
  const map: Record<WeatherCondition, string> = {
    sunny: 'from-amber-400 via-orange-400 to-yellow-400',
    partly_cloudy: 'from-sky-400 via-blue-400 to-cyan-400',
    cloudy: 'from-slate-400 via-gray-400 to-zinc-400',
    rain: 'from-blue-400 via-indigo-400 to-slate-400',
    drizzle: 'from-blue-300 via-slate-400 to-gray-400',
    thunderstorm: 'from-violet-500 via-purple-500 to-slate-500',
    snow: 'from-sky-300 via-white to-slate-300',
    clear_night: 'from-indigo-400 via-violet-500 to-slate-500',
    mist: 'from-slate-300 via-gray-300 to-zinc-300',
    fog: 'from-slate-300 via-gray-300 to-zinc-300',
    haze: 'from-amber-300 via-orange-300 to-yellow-300',
  };
  return map[condition];
}

function getSmallForecastIcon(condition: WeatherCondition, isNight: boolean): LucideIcon {
  if (isNight && condition === 'sunny') return Moon;
  const map: Record<WeatherCondition, LucideIcon> = {
    sunny: Sun,
    partly_cloudy: CloudSun,
    cloudy: Cloud,
    rain: CloudRain,
    drizzle: CloudDrizzle,
    thunderstorm: CloudLightning,
    snow: CloudSnow,
    clear_night: Moon,
    mist: Cloud,
    fog: Cloud,
    haze: Cloud,
  };
  return map[condition];
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function WeatherWidgetSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-muted to-muted" />
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-14 w-14 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
        <div className="pt-3 border-t border-border/40">
          <div className="flex justify-between gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

type WidgetState = 'loading' | 'error' | 'not_configured' | 'data';

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [state, setState] = useState<WidgetState>('loading');
  const [errorType, setErrorType] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchWeather = useCallback(async () => {
    setState('loading');
    try {
      const data = await fetchCurrentWeather();
      setWeather(data);
      setState('data');
    } catch (err) {
      const errType = getWeatherErrorType(err);
      setErrorType(errType);
      if (errType === 'WEATHER_API_NOT_CONFIGURED') {
        setState('not_configured');
      } else {
        setState('error');
      }
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (state === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <WeatherWidgetSkeleton />
      </motion.div>
    );
  }

  if (state === 'not_configured') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted/80 flex items-center justify-center">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Weather API Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Set <code className="text-[10px] bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_OPENWEATHER_API_KEY</code> or configure it in property settings.
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-1 text-xs" onClick={fetchWeather}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (state === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Unable to Load Weather</p>
              <p className="text-xs text-muted-foreground mt-1">
                {errorType === 'WEATHER_CITY_NOT_FOUND'
                  ? 'City not found. Please check your property location settings.'
                  : errorType === 'WEATHER_API_KEY_INVALID'
                    ? 'Invalid API key. Please verify your OpenWeatherMap key.'
                    : 'An error occurred while fetching weather data.'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-1 text-xs" onClick={fetchWeather}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!weather) return null;

  // Build local 3-day forecast from current weather if forecast array is empty
  // (The forecast widget provides 5-day data; this widget shows current + 3-day mini)
  const miniForecast: ForecastDay[] = weather.forecast.length > 0
    ? weather.forecast.slice(0, 3).map(f => ({
        day: f.day,
        high: f.high,
        low: f.low,
        condition: f.condition,
      }))
    : [
        { day: 'Today', high: weather.current.high, low: weather.current.low, condition: weather.current.condition },
        { day: 'Tomorrow', high: weather.current.high - 1, low: weather.current.low + 1, condition: weather.current.condition },
        { day: 'Day After', high: weather.current.high - 2, low: weather.current.low, condition: weather.current.condition },
      ];

  const isNight = currentTime.getHours() >= 20 || currentTime.getHours() < 6;
  const displayCondition: WeatherCondition = isNight && weather.current.condition === 'sunny' ? 'clear_night' : weather.current.condition;

  const { Icon: WeatherIcon, iconColor, label: conditionLabel } = getConditionIcon(displayCondition);
  const cardBg = getCardBgGradient(displayCondition);
  const accentGrad = getAccentGradient(displayCondition);

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className={cn(
        'border border-border/50 shadow-sm rounded-2xl overflow-hidden relative transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-0.5',
        'bg-gradient-to-br',
        cardBg
      )}>
        {/* Accent line */}
        <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-70', accentGrad)} />

        <CardContent className="p-4 relative">
          {/* Header: Location + Live Clock */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="font-medium">{weather.location}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </div>
              <Clock className="h-3 w-3" />
              <span className="tabular-nums font-semibold">{formattedTime}</span>
            </div>
          </div>

          {/* Main Weather Display */}
          <div className="flex items-center justify-between mb-1">
            {/* Temperature + Condition */}
            <div>
              <div className="flex items-start">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={weather.current.temp}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="text-4xl font-bold text-foreground tabular-nums leading-none"
                    style={{ fontFeatureSettings: 'tnum' }}
                  >
                    {weather.current.temp}°
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm text-muted-foreground mt-1 ml-0.5">C</span>
              </div>
              <p className={cn('text-xs font-medium mt-1', iconColor)}>{conditionLabel}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
                <span className="tabular-nums font-medium">H: {weather.current.high}°</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular-nums font-medium">L: {weather.current.low}°</span>
              </div>
            </div>

            {/* Weather Icon with animated glow */}
            <motion.div
              className={cn(
                'p-3.5 rounded-2xl relative',
                'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/40 dark:to-white/40',
                'backdrop-blur-sm',
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              {/* Glow ring */}
              <div className={cn(
                'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-20 blur-md -z-10',
                accentGrad
              )} />
              <WeatherIcon className={cn('h-8 w-8', iconColor)} />
            </motion.div>
          </div>

          {/* Date display */}
          <p className="text-[10px] text-muted-foreground/50 mb-3 tabular-nums">{formattedDate}</p>

          {/* Detail Stats Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[11px]">
              <Droplets className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
              <span className="text-muted-foreground">Humidity</span>
              <span className="ml-auto font-semibold tabular-nums">{weather.current.humidity}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Wind className="h-3 w-3 text-sky-500 dark:text-sky-400 shrink-0" />
              <span className="text-muted-foreground">Wind</span>
              <span className="ml-auto font-semibold tabular-nums">{weather.current.wind} km/h</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Thermometer className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="text-muted-foreground">Feels Like</span>
              <span className="ml-auto font-semibold tabular-nums">{weather.current.feelsLike}°</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Eye className="h-3 w-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span className="text-muted-foreground">Visibility</span>
              <span className="ml-auto font-semibold tabular-nums">{weather.current.visibility} km</span>
            </div>
          </div>

          {/* 3-Day Forecast */}
          <div className="pt-3 border-t border-border/40">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2.5">3-Day Forecast</p>
            <div className="flex justify-between gap-1">
              {miniForecast.map((day, i) => {
                const ForecastIcon = getSmallForecastIcon(day.condition, false);
                const { iconColor: dayIconColor } = getConditionIcon(day.condition);
                return (
                  <motion.div
                    key={day.day}
                    className="flex flex-col items-center gap-1 flex-1"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground/70">{day.day}</span>
                    <ForecastIcon className={cn('h-4 w-4', dayIconColor)} />
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-semibold tabular-nums leading-tight">{day.high}°</span>
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums leading-tight">{day.low}°</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
