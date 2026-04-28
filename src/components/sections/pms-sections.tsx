// DEPRECATED: Use section-resolver.ts + category loaders instead
'use client';
import { lazy } from 'react';

const PropertiesList = lazy(() => import('@/components/pms/properties-list'));
const RoomTypesManager = lazy(() => import('@/components/pms/room-types-manager'));
const RoomsManager = lazy(() => import('@/components/pms/rooms-manager'));
const FloorPlans = lazy(() => import('@/components/pms/floor-plans'));
const InventoryCalendar = lazy(() => import('@/components/pms/inventory-calendar'));
const AvailabilityControl = lazy(() => import('@/components/pms/availability-control'));
const InventoryLocking = lazy(() => import('@/components/pms/inventory-locking'));
const RatePlansPricingRules = lazy(() => import('@/components/pms/rate-plans-pricing-rules'));
const OverbookingSettings = lazy(() => import('@/components/pms/overbooking-settings'));
const BulkPriceUpdate = lazy(() => import('@/components/pms/bulk-price-update'));
const RevenueDashboard = lazy(() => import('@/components/pms/revenue-dashboard'));

export const pmsSections: Record<string, React.LazyExoticComponent<any>> = {
  PropertiesList,
  RoomTypesManager,
  RoomsManager,
  FloorPlans,
  InventoryCalendar,
  AvailabilityControl,
  InventoryLocking,
  RatePlansPricingRules,
  OverbookingSettings,
  BulkPriceUpdate,
  RevenueDashboard,
};
