/**
 * GDS Module — Public Exports
 *
 * Re-exports all types and factory functions from the GDS adapter module.
 */

export type {
  GDSProvider,
  GDSConnectionStatus,
  GDSSyncAction,
  ARIRequest,
  ARIUpdate,
  GDSBooking,
  GDSConfig,
  RateUpdate,
  GDSSyncResult,
  GDSTestResult,
  AvailabilityResponse,
  GDSError,
  SOAPFault,
  GDSRequestLog,
} from './types';

export { BaseGDSClient, GDSErrorWrapper, gdsError, validateGDSConfig } from './base-client';

export { AmadeusClient } from './amadeus-client';
export { SabreClient } from './sabre-client';
export { TravelportClient } from './travelport-client';

export { createGDSClient, getGDSConfig, getSupportedProviders, isGDSSyncEnabled, getBookingPullIntervalMinutes } from './client-factory';
