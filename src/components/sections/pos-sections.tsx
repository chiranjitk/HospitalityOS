'use client';
import { lazy } from 'react';

const Orders = lazy(() => import('@/components/pos/orders'));
const Tables = lazy(() => import('@/components/pos/tables'));
const KitchenDisplay = lazy(() => import('@/components/pos/kitchen-display'));
const MenuManagement = lazy(() => import('@/components/pos/menu-management'));
const POSBilling = lazy(() => import('@/components/pos/billing'));

export const posSections: Record<string, React.LazyExoticComponent<any>> = {
  Orders,
  Tables,
  KitchenDisplay,
  MenuManagement,
  POSBilling,
};
