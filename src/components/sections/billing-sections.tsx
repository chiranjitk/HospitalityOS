'use client';
import { lazy } from 'react';

const Folios = lazy(() => import('@/components/billing/folios'));
const Invoices = lazy(() => import('@/components/billing/invoices'));
const Payments = lazy(() => import('@/components/billing/payments'));
const Refunds = lazy(() => import('@/components/billing/refunds'));
const Discounts = lazy(() => import('@/components/billing/discounts'));
const SaaSPlans = lazy(() => import('@/components/billing/saas-plans'));
const Subscriptions = lazy(() => import('@/components/billing/subscriptions'));
const UsageBilling = lazy(() => import('@/components/billing/usage-billing'));
const CancellationPolicies = lazy(() => import('@/components/billing/cancellation-policies'));
const NightAudit = lazy(() => import('@/components/billing/night-audit'));
const ScheduledCharges = lazy(() => import('@/components/billing/scheduled-charges'));
const PostingRules = lazy(() => import('@/components/billing/posting-rules'));
const CityLedger = lazy(() => import('@/components/billing/city-ledger'));
const Commissions = lazy(() => import('@/components/billing/commissions'));

export const billingSections: Record<string, React.LazyExoticComponent<any>> = {
  Folios,
  Invoices,
  Payments,
  Refunds,
  Discounts,
  SaaSPlans,
  Subscriptions,
  UsageBilling,
  CancellationPolicies,
  NightAudit,
  ScheduledCharges,
  PostingRules,
  CityLedger,
  Commissions,
};
