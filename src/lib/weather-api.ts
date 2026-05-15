/**
 * Shared weather API utility for StaySuite dashboard widgets.
 *
 * Supports fetching from OpenWeatherMap with:
 *  - API key from env var NEXT_PUBLIC_OPENWEATHER_API_KEY
 *  - API key from property settings (via /api/settings integration)
 *  - Location from env var NEXT_PUBLIC_DEFAULT_CITY
 *  - Location from property settings
 *
 * Response caching in localStorage for 30 minutes.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type WeatherCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'drizzle'
  | 'thunderstorm'
  | 'snow'
  | 'clear_night'
  | 'mist'
  | 'fog'
  | 'haze';

export interface CurrentWeather {
  temp: number;
  condition: WeatherCondition;
  humidity: number;
  wind: number;
  feelsLike: number;
  visibility: number;
  high: number;
  low: number;
  description: string;
}

export interface ForecastDay {
  day: string;
  date: string;
  high: number;
  low: number;
  condition: WeatherCondition;
  description: string;
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
}

export interface WeatherForecastData {
  location: string;
  region: string;
  current: {
    temp: number;
    feelsLike: number;
    condition: WeatherCondition;
    conditionText: string;
    humidity: number;
    windSpeed: number;
    windDir: string;
    uvIndex: number;
  };
  forecast: ForecastDay[];
  globalHigh: number;
  globalLow: number;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage might be full or disabled
  }
}

// ── OpenWeatherMap condition mapping ────────────────────────────────────────

const OW_COND_MAP: Record<string, WeatherCondition> = {
  Clear: 'sunny',
  'Few clouds': 'partly_cloudy',
  'Scattered clouds': 'partly_cloudy',
  'Broken clouds': 'cloudy',
  'Overcast clouds': 'cloudy',
  Mist: 'mist',
  Fog: 'fog',
  Haze: 'haze',
  'Light rain': 'drizzle',
  Drizzle: 'drizzle',
  'Moderate rain': 'rain',
  Rain: 'rain',
  'Heavy intensity rain': 'rain',
  'Thunderstorm': 'thunderstorm',
  'Thunderstorm with light rain': 'thunderstorm',
  Snow: 'snow',
  'Light snow': 'snow',
  'Heavy snow': 'snow',
};

function mapOWCondition(id: number, main: string, description: string): WeatherCondition {
  // Group IDs: 2xx=thunderstorm, 3xx=drizzle, 5xx=rain, 6xx=snow, 7xx=atmosphere, 800=clear, 80x=clouds
  if (id >= 200 && id < 300) return 'thunderstorm';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id >= 500 && id < 600) return 'rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) {
    if (id === 701 || id === 721 || id === 741) return 'mist';
    if (id === 741) return 'fog';
    return 'haze';
  }
  if (id === 800) return 'sunny';
  if (id > 800) return 'partly_cloudy';
  return OW_COND_MAP[main] || OW_COND_MAP[description] || 'cloudy';
}

function windDirectionToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ── API Key Resolution ─────────────────────────────────────────────────────

async function resolveConfig(): Promise<{ apiKey: string | null; city: string | null; lat: number | null; lon: number | null }> {
  // 1. Check env vars (available on client for NEXT_PUBLIC_ prefixed)
  let apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || null;
  let city = process.env.NEXT_PUBLIC_DEFAULT_CITY || null;

  // 2. Try fetching from property settings API
  try {
    const res = await fetch('/api/property-settings');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        if (!apiKey && json.data.openWeatherApiKey) apiKey = json.data.openWeatherApiKey;
        if (!city && json.data.city) city = json.data.city;
        return {
          apiKey,
          city: city || json.data.city || null,
          lat: json.data.latitude ?? null,
          lon: json.data.longitude ?? null,
        };
      }
    }
  } catch {
    // Settings API may not exist or may fail — that's okay
  }

  return { apiKey, city, lat: null, lon: null };
}

// ── Current Weather ────────────────────────────────────────────────────────

const CURRENT_CACHE_KEY = 'staysuite_weather_current';

export async function fetchCurrentWeather(): Promise<WeatherData> {
  // Check cache first
  const cached = getCached<WeatherData>(CURRENT_CACHE_KEY);
  if (cached) return cached;

  const config = await resolveConfig();

  if (!config.apiKey) {
    throw new Error('WEATHER_API_NOT_CONFIGURED');
  }

  let url: string;
  if (config.lat !== null && config.lon !== null) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${config.lat}&lon=${config.lon}&appid=${config.apiKey}&units=metric`;
  } else if (config.city) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(config.city)}&appid=${config.apiKey}&units=metric`;
  } else {
    throw new Error('WEATHER_API_NOT_CONFIGURED');
  }

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('WEATHER_API_KEY_INVALID');
    if (res.status === 404) throw new Error('WEATHER_CITY_NOT_FOUND');
    throw new Error('WEATHER_FETCH_ERROR');
  }

  const owData = await res.json();

  const condition = mapOWCondition(owData.weather[0].id, owData.weather[0].main, owData.weather[0].description);

  const data: WeatherData = {
    location: `${owData.name}, ${owData.sys.country}`,
    current: {
      temp: Math.round(owData.main.temp),
      condition,
      humidity: owData.main.humidity,
      wind: Math.round(owData.wind.speed * 3.6), // m/s to km/h
      feelsLike: Math.round(owData.main.feels_like),
      visibility: Math.round((owData.visibility || 10000) / 1000), // meters to km
      high: Math.round(owData.main.temp_max),
      low: Math.round(owData.main.temp_min),
      description: owData.weather[0].description,
    },
    forecast: [], // Filled by forecast endpoint
  };

  setCache(CURRENT_CACHE_KEY, data);
  return data;
}

// ── 5-Day Forecast ─────────────────────────────────────────────────────────

const FORECAST_CACHE_KEY = 'staysuite_weather_forecast';

export async function fetchWeatherForecast(): Promise<WeatherForecastData> {
  // Check cache first
  const cached = getCached<WeatherForecastData>(FORECAST_CACHE_KEY);
  if (cached) return cached;

  const config = await resolveConfig();

  if (!config.apiKey) {
    throw new Error('WEATHER_API_NOT_CONFIGURED');
  }

  let url: string;
  if (config.lat !== null && config.lon !== null) {
    url = `https://api.openweathermap.org/data/2.5/forecast?lat=${config.lat}&lon=${config.lon}&appid=${config.apiKey}&units=metric`;
  } else if (config.city) {
    url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(config.city)}&appid=${config.apiKey}&units=metric`;
  } else {
    throw new Error('WEATHER_API_NOT_CONFIGURED');
  }

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('WEATHER_API_KEY_INVALID');
    if (res.status === 404) throw new Error('WEATHER_CITY_NOT_FOUND');
    throw new Error('WEATHER_FETCH_ERROR');
  }

  const owData = await res.json();

  // Group forecast items by date, picking midday entry for each day
  const dayMap = new Map<string, {
    date: string;
    temps: number[];
    conditions: { id: number; main: string; description: string }[];
    windSpeeds: number[];
    windDegs: number[];
  }>();

  for (const item of owData.list) {
    const dateKey = item.dt_txt.split(' ')[0];
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        date: dateKey,
        temps: [],
        conditions: [],
        windSpeeds: [],
        windDegs: [],
      });
    }
    const entry = dayMap.get(dateKey)!;
    entry.temps.push(item.main.temp);
    entry.conditions.push({
      id: item.weather[0].id,
      main: item.weather[0].main,
      description: item.weather[0].description,
    });
    entry.windSpeeds.push(item.wind.speed);
    entry.windDegs.push(item.wind.deg || 0);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const forecastDays: ForecastDay[] = [];
  let globalHigh = -Infinity;
  let globalLow = Infinity;

  // Take up to 5 days (skip today if in first group — include it as "Today")
  const sortedDays = Array.from(dayMap.entries()).slice(0, 5);

  for (const [dateStr, entry] of sortedDays) {
    const d = new Date(dateStr + 'T12:00:00');
    const high = Math.round(Math.max(...entry.temps));
    const low = Math.round(Math.min(...entry.temps));
    const avgTemp = entry.temps.reduce((a, b) => a + b, 0) / entry.temps.length;

    // Pick the midday condition if available
    const midIndex = Math.min(4, Math.floor(entry.conditions.length / 2));
    const midCondition = entry.conditions[midIndex] || entry.conditions[0];
    const condition = mapOWCondition(midCondition.id, midCondition.main, midCondition.description);

    globalHigh = Math.max(globalHigh, high);
    globalLow = Math.min(globalLow, low);

    const isToday = d.toDateString() === today.toDateString();
    const dayName = isToday ? 'Today' : dayNames[d.getDay()];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    forecastDays.push({
      day: dayName,
      date: `${monthNames[d.getMonth()]} ${d.getDate()}`,
      high,
      low,
      condition,
      description: midCondition.description,
    });
  }

  // Current conditions from the first item
  const firstItem = owData.list[0];
  const firstCondition = firstItem.weather[0];
  const currentCondition = mapOWCondition(firstCondition.id, firstCondition.main, firstCondition.description);
  const avgWindSpeed = owData.list.slice(0, 8).reduce((a, b) => a + b.wind.speed, 0) / Math.min(8, owData.list.length);

  const data: WeatherForecastData = {
    location: owData.city.name,
    region: owData.city.country,
    current: {
      temp: Math.round(firstItem.main.temp),
      feelsLike: Math.round(firstItem.main.feels_like),
      condition: currentCondition,
      conditionText: firstCondition.description
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      humidity: firstItem.main.humidity,
      windSpeed: Math.round(avgWindSpeed * 3.6), // m/s to km/h
      windDir: windDirectionToCompass(firstItem.wind.deg || 0),
      uvIndex: 0, // OpenWeatherMap free tier doesn't include UV; require call to UV endpoint for this
    },
    forecast: forecastDays,
    globalHigh: globalHigh === -Infinity ? 0 : globalHigh,
    globalLow: globalLow === Infinity ? 0 : globalLow,
  };

  setCache(FORECAST_CACHE_KEY, data);
  return data;
}

// ── Error type helpers ─────────────────────────────────────────────────────

export type WeatherErrorType =
  | 'WEATHER_API_NOT_CONFIGURED'
  | 'WEATHER_API_KEY_INVALID'
  | 'WEATHER_CITY_NOT_FOUND'
  | 'WEATHER_FETCH_ERROR'
  | 'UNKNOWN';

export function getWeatherErrorType(error: unknown): WeatherErrorType {
  if (error instanceof Error) {
    if (error.message.startsWith('WEATHER_')) return error.message as WeatherErrorType;
  }
  return 'UNKNOWN';
}
