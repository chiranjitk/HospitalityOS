'use client';
import { lazy } from 'react';

const PaymentGatewaysPage = lazy(() => import('@/components/integrations/payment-gateways-page').then(m => ({ default: m.PaymentGatewaysPage })));
const WifiGateways = lazy(() => import('@/components/integrations/wifi-gateways').then(m => ({ default: m.WifiGateways })));
const PosSystems = lazy(() => import('@/components/integrations/pos-systems').then(m => ({ default: m.PosSystems })));
const ThirdPartyApis = lazy(() => import('@/components/integrations/third-party-apis').then(m => ({ default: m.ThirdPartyApis })));
const NotificationTemplates = lazy(() => import('@/components/notifications/templates').then(m => ({ default: m.Templates })));
const DeliveryLogs = lazy(() => import('@/components/notifications/delivery-logs').then(m => ({ default: m.DeliveryLogs })));
const NotificationSettingsComponent = lazy(() => import('@/components/notifications/settings').then(m => ({ default: m.NotificationSettingsComponent })));
const WebhookEvents = lazy(() => import('@/components/webhooks/events').then(m => ({ default: m.WebhookEvents })));
const WebhookDelivery = lazy(() => import('@/components/webhooks/delivery').then(m => ({ default: m.WebhookDelivery })));
const RetryQueue = lazy(() => import('@/components/webhooks/retry-queue').then(m => ({ default: m.RetryQueue })));
const SmartLocks = lazy(() => import('@/components/integrations/smart-locks').then(m => ({ default: m.SmartLocks })));
const PaymentTerminals = lazy(() => import('@/components/integrations/payment-terminals').then(m => ({ default: m.PaymentTerminals })));
const MobileAppManagement = lazy(() => import('@/components/integrations/mobile-app').then(m => ({ default: m.MobileAppManagement })));

export const integrationsNotificationsSections: Record<string, React.LazyExoticComponent<any>> = {
  PaymentGatewaysPage,
  WifiGateways,
  PosSystems,
  ThirdPartyApis,
  NotificationTemplates,
  DeliveryLogs,
  NotificationSettingsComponent,
  WebhookEvents,
  WebhookDelivery,
  RetryQueue,
  SmartLocks,
  PaymentTerminals,
  MobileAppManagement,
};
