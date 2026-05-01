'use client';

import { create } from 'zustand';
import { useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

/** Raw shape returned by GET /api/dashboard */
export interface DashboardData {
  stats: {
    revenue: { today: number; thisWeek: number; thisMonth: number; change: number | null };
    occupancy: { today: number; thisWeek: number; thisMonth: number; change: number };
    bookings: { today: number; thisWeek: number; thisMonth: number; pending: number };
    guests: { checkedIn: number; arriving: number; departing: number; total: number };
    adr: number;
    revpar: number;
    activeWifiSessions: number;
    pendingServiceRequests: number;
    lowStockItems: number;
  };
  arrivalsToday: Array<{
    id: string;
    confirmationCode: string;
    guestName: string;
    roomType: string;
    roomNumber?: string;
    nights: number;
    status: string;
    time: string;
  }>;
  departuresToday: Array<{
    id: string;
    confirmationCode: string;
    guestName: string;
    roomType: string;
    roomNumber?: string;
    balance: number;
    status: string;
    time: string;
  }>;
  charts: {
    revenue: Array<{ date: string; revenue: number; bookings: number; occupancy: number }>;
    occupancyByRoomType: Array<{ name: string; value: number }>;
    bookingSources: Array<{ source: string; bookings: number }>;
    hourlyActivity: Array<{ hour: string; checkins: number; checkouts: number }>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    timestamp: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    guest?: { name: string; initials: string };
    room?: string;
    timestamp: string;
    status: string;
    amount: number;
  }>;
  commandCenter: {
    rooms: {
      available: number;
      occupied: number;
      maintenance: number;
      dirty: number;
      out_of_order: number;
    };
    totalRooms: number;
    upcomingCheckIns: number;
    staffOnDuty: number;
    todaysTasks: Array<{
      id: string;
      type: string;
      title: string;
      room?: string;
      status: string;
      priority: string;
      scheduledAt: string;
      assignee: string | null;
    }>;
  };
}

interface DashboardDataStore {
  /** The latest dashboard data snapshot, or null if never fetched. */
  data: DashboardData | null;
  /** True during the very first fetch. */
  isLoading: boolean;
  /** True during a background (non-initial) refresh. */
  isRefreshing: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Timestamp of the last successful fetch. */
  lastUpdated: Date | null;
  /** Total number of completed fetches (useful for debugging). */
  fetchCount: number;

  // ── Actions ──
  setData: (data: DashboardData) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// ─── Zustand Store ────────────────────────────────────────────────────────

export const useDashboardDataStore = create<DashboardDataStore>((set, get) => ({
  data: null,
  isLoading: true,
  isRefreshing: false,
  error: null,
  lastUpdated: null,
  fetchCount: 0,

  setData: (data) =>
    set({
      data,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastUpdated: new Date(),
      fetchCount: get().fetchCount + 1,
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setError: (error) => set({ error, isLoading: false, isRefreshing: false }),
  reset: () =>
    set({
      data: null,
      isLoading: true,
      isRefreshing: false,
      error: null,
      lastUpdated: null,
      fetchCount: 0,
    }),
}));

// ─── Module-level deduplication & lifecycle refs ─────────────────────────
// These live outside React component tree so they are shared across ALL
// consumers of the hook within the same browser tab.

/** Prevents concurrent in-flight fetches. Only one fetch at a time. */
let isFetchingRef = false;

/** Number of currently mounted components using this hook. */
let activeWidgetsRef = 0;

/** Handle for the auto-refresh interval. */
let autoRefreshTimerRef: ReturnType<typeof setInterval> | null = null;

/** Auto-refresh interval in milliseconds. */
const REFRESH_INTERVAL_MS = 45_000;

/**
 * Core fetch function. Reads from /api/dashboard and updates the zustand store.
 * If a fetch is already in-flight, the call is silently skipped (deduplication).
 */
async function fetchDashboardData(showRefreshLoader = false): Promise<void> {
  // ── Deduplication gate ──
  if (isFetchingRef) return;
  isFetchingRef = true;

  const store = useDashboardDataStore.getState();

  // Show appropriate loading indicator
  if (showRefreshLoader && store.data) {
    useDashboardDataStore.getState().setRefreshing(true);
  } else if (!store.data) {
    useDashboardDataStore.getState().setLoading(true);
  }

  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`Dashboard API returned ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      // On success: always replace data (even on refresh)
      useDashboardDataStore.getState().setData(result.data);
    } else {
      // API returned a logical error
      const msg = result.error?.message || 'Unknown dashboard error';
      useDashboardDataStore.getState().setError(msg);
    }
  } catch (err) {
    // Error resilience: only set error if we have NO prior data.
    // This ensures widgets keep rendering with stale data during network blips.
    const current = useDashboardDataStore.getState();
    if (!current.data) {
      useDashboardDataStore.getState().setError(
        err instanceof Error ? err.message : 'Failed to fetch dashboard data',
      );
    }
    // Even on error, clear the loading/refreshing flags
    useDashboardDataStore.setState({ isLoading: false, isRefreshing: false });
  } finally {
    isFetchingRef = false;
  }
}

/**
 * Starts the auto-refresh interval if it is not already running.
 * The interval only runs when at least one widget is mounted.
 */
function startAutoRefresh(): void {
  if (autoRefreshTimerRef !== null) return; // already running

  autoRefreshTimerRef = setInterval(() => {
    // Only refresh if at least one widget is still mounted
    if (activeWidgetsRef > 0) {
      fetchDashboardData(true);
    } else {
      stopAutoRefresh();
    }
  }, REFRESH_INTERVAL_MS);
}

/** Stops the auto-refresh interval. */
function stopAutoRefresh(): void {
  if (autoRefreshTimerRef !== null) {
    clearInterval(autoRefreshTimerRef);
    autoRefreshTimerRef = null;
  }
}

// ─── React Hook ──────────────────────────────────────────────────────────

/**
 * `useDashboardData` — shared data hook for all dashboard widgets.
 *
 * **Features:**
 * - Fetches `/api/dashboard` once and shares the result globally via zustand.
 * - The FIRST mount triggers the initial fetch; subsequent mounts reuse cached data.
 * - Auto-refreshes every 45 seconds while at least one widget is mounted.
 * - Exposes a `refresh()` function for manual data reload.
 * - Deduplicates concurrent in-flight requests (multiple simultaneous mounts → 1 fetch).
 * - Error resilience: keeps last-known-good data on fetch failure.
 *
 * **Usage in a widget component:**
 * ```tsx
 * const { data, isLoading, isRefreshing, error, refresh } = useDashboardData();
 * ```
 */
export function useDashboardData() {
  const data = useDashboardDataStore((s) => s.data);
  const isLoading = useDashboardDataStore((s) => s.isLoading);
  const isRefreshing = useDashboardDataStore((s) => s.isRefreshing);
  const error = useDashboardDataStore((s) => s.error);
  const lastUpdated = useDashboardDataStore((s) => s.lastUpdated);
  const fetchCount = useDashboardDataStore((s) => s.fetchCount);

  // Track whether this specific component instance is mounted
  const mountedRef = useRef(false);

  // ── Manual refresh ──
  const refresh = useCallback(() => {
    fetchDashboardData(true);
  }, []);

  // ── Mount / Unmount lifecycle ──
  useEffect(() => {
    if (mountedRef.current) return; // strict-mode guard
    mountedRef.current = true;

    activeWidgetsRef++;

    // If no data yet, trigger the initial fetch
    if (!useDashboardDataStore.getState().data) {
      fetchDashboardData(false);
    }

    // Start auto-refresh if this is the first widget
    startAutoRefresh();

    return () => {
      activeWidgetsRef--;
      // Stop auto-refresh when the last widget unmounts
      if (activeWidgetsRef <= 0) {
        activeWidgetsRef = 0;
        stopAutoRefresh();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    fetchCount,
    refresh,
  } as const;
}
