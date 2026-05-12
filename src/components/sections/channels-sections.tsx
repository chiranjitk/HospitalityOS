'use client';
import { lazy } from 'react';

const OTAConnections = lazy(() => import('@/components/channels/ota-connections').then(m => ({ default: m.OTAConnections })));
const ChannelAnalytics = lazy(() => import('@/components/channels/channel-analytics').then(m => ({ default: m.ChannelAnalytics })));
const InventorySync = lazy(() => import('@/components/channels/inventory-sync').then(m => ({ default: m.InventorySync })));
const RateSync = lazy(() => import('@/components/channels/rate-sync').then(m => ({ default: m.RateSync })));
const BookingSync = lazy(() => import('@/components/channels/booking-sync').then(m => ({ default: m.BookingSync })));
const Restrictions = lazy(() => import('@/components/channels/restrictions').then(m => ({ default: m.Restrictions })));
const ChannelMapping = lazy(() => import('@/components/channels/mapping').then(m => ({ default: m.ChannelMapping })));
const RateParityDashboard = lazy(() => import('@/components/channels/rate-parity').then(m => ({ default: m.RateParityDashboard })));
const SyncLogs = lazy(() => import('@/components/channels/sync-logs').then(m => ({ default: m.SyncLogs })));
const CRS = lazy(() => import('@/components/channels/crs').then(m => ({ default: m.CRS })));
const ChannelHealth = lazy(() => import('@/components/channels/channel-health').then(m => ({ default: m.ChannelHealth })));
const ChannelAllocations = lazy(() => import('@/components/channels/allocations').then(m => ({ default: m.ChannelAllocations })));
const StopSellManager = lazy(() => import('@/components/channels/stop-sell').then(m => ({ default: m.StopSellManager })));
const RateDerivationRules = lazy(() => import('@/components/channels/rate-derivation').then(m => ({ default: m.RateDerivationRules })));
const VirtualInventory = lazy(() => import('@/components/channels/virtual-inventory').then(m => ({ default: m.VirtualInventory })));
const BookingPaceAnalysis = lazy(() => import('@/components/channels/booking-pace').then(m => ({ default: m.BookingPaceAnalysis })));


export const channelsSections: Record<string, React.LazyExoticComponent<any>> = {
  ChannelAnalytics,
  OTAConnections,
  InventorySync,
  RateSync,
  BookingSync,
  Restrictions,
  StopSellManager,
  ChannelAllocations,
  ChannelMapping,
  RateParityDashboard,
  SyncLogs,
  CRS,
  ChannelHealth,
  RateDerivationRules,
  VirtualInventory,
  BookingPaceAnalysis,
};
