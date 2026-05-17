/**
 * REST Client Configurations
 * Registry of all 28 Tier-3 OTA configurations that can be served by ConfigurableRestClient.
 *
 * Each config captures the ONLY differences between these near-identical clones:
 *   - OTA name / identifier
 *   - Default currency
 *   - Auth header name & prefix
 *   - Credential field to read
 *   - Webhook header name
 *   - Metasearch flag
 *   - Minor endpoint path variations
 */

import type { RESTClientConfig } from './configurable-rest-client';

// ============================================
// CONFIG REGISTRY
// ============================================

export const REST_CLIENT_CONFIGS: Map<string, RESTClientConfig> = new Map([
  // ------------------------------------------
  // Hostelworld — hostel-focused, EUR currency
  // ------------------------------------------
  ['hostelworld', {
    otaId: 'hostelworld',
    otaName: 'Hostelworld',
    defaultCurrency: 'EUR',
    defaultCountry: '',
    authMode: 'api_key_header',
    authHeaderName: 'X-Hostelworld-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Hostelworld-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
      inventoryPath: 'beds/availability',
      inventoryReadPath: 'beds/availability',
      inventoryWritePath: 'beds/availability',
      bookingsPath: 'bookings',
      reservationsPath: 'reservations',
    },
    inventoryResponseKey: 'beds',
    inventoryFallbackKeys: ['data'],
    roomIdField: 'bed_type_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // ZenHotels — simple REST, X-API-Key header
  // ------------------------------------------
  ['zenhotels', {
    otaId: 'zenhotels',
    otaName: 'ZenHotels',
    defaultCurrency: 'USD',
    authMode: 'api_key_header',
    authHeaderName: 'X-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-ZenHotels-Event',
    isMetasearch: false,
    endpoints: {
      inventoryPath: 'availability',
      inventoryReadPath: 'availability',
      inventoryWritePath: 'availability',
    },
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Rakuten Travel — Japanese OTA, JPY currency
  // ------------------------------------------
  ['rakuten_travel', {
    otaId: 'rakuten_travel',
    otaName: 'Rakuten Travel',
    defaultCurrency: 'JPY',
    defaultCountry: 'JP',
    authMode: 'api_key_header',
    authHeaderName: 'X-Rakuten-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Rakuten-Event',
    isMetasearch: false,
    endpoints: {
      apiVersionPrefix: '/v1',
      inventoryPath: 'inventory',
      inventoryReadPath: 'inventory',
      inventoryWritePath: 'inventory',
      bookingsPath: 'bookings',
      reservationsPath: 'reservations',
    },
    roomIdField: 'room_class_code',
    ratePlanIdField: 'plan_id',
  }],

  // ------------------------------------------
  // Jalan — Japanese OTA, JPY currency
  // ------------------------------------------
  ['jalan', {
    otaId: 'jalan',
    otaName: 'Jalan',
    defaultCurrency: 'JPY',
    defaultCountry: 'JP',
    authMode: 'api_key_header',
    authHeaderName: 'X-Jalan-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Jalan-Event',
    isMetasearch: false,
    endpoints: {
      apiVersionPrefix: '/v1',
      inventoryPath: 'plans',
      inventoryReadPath: 'plans',
      inventoryWritePath: 'plans',
      restrictionsPath: 'availability',
      bookingsPath: 'bookings',
      reservationsPath: 'reservations',
    },
    roomIdField: 'plan_id',
    ratePlanIdField: 'rate_id',
  }],

  // ------------------------------------------
  // Ostrovok — Russian/CIS OTA, RUB currency, Bearer auth
  // ------------------------------------------
  ['ostrovok', {
    otaId: 'ostrovok',
    otaName: 'Ostrovok',
    defaultCurrency: 'RUB',
    defaultCountry: 'RU',
    authMode: 'bearer_token',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer ',
    authCredentialKey: 'accessToken',
    webhookHeaderName: 'X-Ostrovok-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'hotel',
      inventoryPath: 'availability',
      inventoryReadPath: 'availability',
      inventoryWritePath: 'availability',
    },
    roomIdField: 'room_type_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // HRS — German OTA, EUR currency
  // ------------------------------------------
  ['hrs', {
    otaId: 'hrs',
    otaName: 'HRS',
    defaultCurrency: 'EUR',
    defaultCountry: 'DE',
    authMode: 'api_key_header',
    authHeaderName: 'X-HRS-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-HRS-Event',
    isMetasearch: false,
    endpoints: {
      inventoryPath: 'inventory',
      inventoryReadPath: 'inventory',
      inventoryWritePath: 'inventory',
      bookingsPath: 'bookings',
      reservationsPath: 'reservations',
    },
    roomIdField: 'room_type_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Edreams (ODIGEO Group) — EUR, X-ODIGEO-Key
  // ------------------------------------------
  ['edreams', {
    otaId: 'edreams',
    otaName: 'Edreams',
    defaultCurrency: 'EUR',
    defaultCountry: 'ES',
    authMode: 'api_key_header',
    authHeaderName: 'X-ODIGEO-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-ODIGEO-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Lastminute (ODIGEO Group) — EUR/GBP, X-ODIGEO-Key
  // ------------------------------------------
  ['lastminute', {
    otaId: 'lastminute',
    otaName: 'Lastminute',
    defaultCurrency: 'EUR',
    defaultCountry: 'GB',
    authMode: 'api_key_header',
    authHeaderName: 'X-ODIGEO-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-ODIGEO-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Jumia Travel — African OTA, NGN currency
  // ------------------------------------------
  ['jumia_travel', {
    otaId: 'jumia_travel',
    otaName: 'Jumia Travel',
    defaultCurrency: 'NGN',
    defaultCountry: 'NG',
    authMode: 'api_key_header',
    authHeaderName: 'X-Jumia-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Jumia-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Trivago — Metasearch, EUR, X-Trivago-API-Key
  // ------------------------------------------
  ['trivago', {
    otaId: 'trivago',
    otaName: 'Trivago',
    defaultCurrency: 'EUR',
    authMode: 'api_key_header',
    authHeaderName: 'X-Trivago-API-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Trivago-Event',
    webhookDefaultEvent: 'rate_update',
    isMetasearch: true,
    metasearchLabel: '(metasearch)',
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Skyscanner — Metasearch, EUR, X-Skyscanner-Key
  // ------------------------------------------
  ['skyscanner', {
    otaId: 'skyscanner',
    otaName: 'Skyscanner',
    defaultCurrency: 'EUR',
    authMode: 'api_key_header',
    authHeaderName: 'X-Skyscanner-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Skyscanner-Event',
    webhookDefaultEvent: 'rate_update',
    isMetasearch: true,
    metasearchLabel: '(metasearch)',
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Priceline — US OTA, USD, X-Priceline-Key
  // ------------------------------------------
  ['priceline', {
    otaId: 'priceline',
    otaName: 'Priceline',
    defaultCurrency: 'USD',
    defaultCountry: 'US',
    authMode: 'api_key_header',
    authHeaderName: 'X-Priceline-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Priceline-Event',
    isMetasearch: false,
    endpoints: {
      inventoryPath: 'inventory',
      inventoryReadPath: 'inventory',
      inventoryWritePath: 'inventory',
    },
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Hotwire — US OTA (Expedia Group), USD, X-Hotwire-Key
  // ------------------------------------------
  ['hotwire', {
    otaId: 'hotwire',
    otaName: 'Hotwire',
    defaultCurrency: 'USD',
    defaultCountry: 'US',
    authMode: 'api_key_header',
    authHeaderName: 'X-Hotwire-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Hotwire-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Wego — Metasearch (Middle East), AED, X-Wego-Key
  // ------------------------------------------
  ['wego', {
    otaId: 'wego',
    otaName: 'Wego',
    defaultCurrency: 'AED',
    authMode: 'api_key_header',
    authHeaderName: 'X-Wego-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Wego-Event',
    webhookDefaultEvent: 'rate_update',
    isMetasearch: true,
    metasearchLabel: '(metasearch)',
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // FlipKey — Vacation rental, EUR, X-FlipKey-Key
  // ------------------------------------------
  ['flipkey', {
    otaId: 'flipkey',
    otaName: 'FlipKey',
    defaultCurrency: 'EUR',
    authMode: 'api_key_header',
    authHeaderName: 'X-FlipKey-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-FlipKey-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
      roomIdField: 'property_id',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Yatra — Indian OTA, INR, X-Yatra-Key
  // ------------------------------------------
  ['yatra', {
    otaId: 'yatra',
    otaName: 'Yatra',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'api_key_header',
    authHeaderName: 'X-Yatra-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Yatra-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Cleartrip — Indian OTA (Flipkart Group), INR, X-Cleartrip-Key
  // ------------------------------------------
  ['cleartrip', {
    otaId: 'cleartrip',
    otaName: 'Cleartrip',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'api_key_header',
    authHeaderName: 'X-Cleartrip-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Cleartrip-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // EaseMyTrip — Indian OTA, INR, X-EMT-Key
  // ------------------------------------------
  ['easemytrip', {
    otaId: 'easemytrip',
    otaName: 'EaseMyTrip',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'api_key_header',
    authHeaderName: 'X-EMT-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-EMT-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // FabHotels — Indian budget hotel chain, INR, Bearer auth
  // ------------------------------------------
  ['fabhotels', {
    otaId: 'fabhotels',
    otaName: 'FabHotels',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'oauth2_client_credentials',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer ',
    authCredentialKey: 'apiKey',
    tokenEndpoint: '/auth/token',
    webhookHeaderName: 'X-FabHotels-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Treebo — Indian budget hotel chain, INR, Bearer auth
  // ------------------------------------------
  ['treebo', {
    otaId: 'treebo',
    otaName: 'Treebo',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'oauth2_client_credentials',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer ',
    authCredentialKey: 'apiKey',
    tokenEndpoint: '/auth/token',
    webhookHeaderName: 'X-Treebo-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Stayz — Australian vacation rental, AUD, X-Stayz-Key
  // ------------------------------------------
  ['stayz', {
    otaId: 'stayz',
    otaName: 'Stayz',
    defaultCurrency: 'AUD',
    defaultCountry: 'AU',
    authMode: 'api_key_header',
    authHeaderName: 'X-Stayz-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Stayz-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // 9flats — European vacation rental, EUR, X-9Flats-Key
  // ------------------------------------------
  ['9flats', {
    otaId: '9flats',
    otaName: '9flats',
    defaultCurrency: 'EUR',
    defaultCountry: 'DE',
    authMode: 'api_key_header',
    authHeaderName: 'X-9Flats-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-9Flats-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Bookabach — NZ vacation rental, NZD, X-Bookabach-Key
  // ------------------------------------------
  ['bookabach', {
    otaId: 'bookabach',
    otaName: 'Bookabach',
    defaultCurrency: 'NZD',
    defaultCountry: 'NZ',
    authMode: 'api_key_header',
    authHeaderName: 'X-Bookabach-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Bookabach-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Hotelplan — Swiss OTA, CHF, X-Hotelplan-Key
  // ------------------------------------------
  ['hotelplan', {
    otaId: 'hotelplan',
    otaName: 'Hotelplan',
    defaultCurrency: 'CHF',
    defaultCountry: 'CH',
    authMode: 'api_key_header',
    authHeaderName: 'X-Hotelplan-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Hotelplan-Event',
    isMetasearch: false,
    endpoints: {
      inventoryPath: 'inventory',
      inventoryReadPath: 'inventory',
      inventoryWritePath: 'inventory',
    },
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Housetrip — European vacation rental, EUR, X-Housetrip-Key
  // ------------------------------------------
  ['housetrip', {
    otaId: 'housetrip',
    otaName: 'Housetrip',
    defaultCurrency: 'EUR',
    defaultCountry: '',
    authMode: 'api_key_header',
    authHeaderName: 'X-Housetrip-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Housetrip-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // IXIGO — Indian travel, INR, X-IXIGO-Key
  // ------------------------------------------
  ['ixigo', {
    otaId: 'ixigo',
    otaName: 'IXIGO',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'api_key_header',
    authHeaderName: 'X-IXIGO-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-IXIGO-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Kayak — Metasearch, USD, X-Kayak-Key
  // ------------------------------------------
  ['kayak', {
    otaId: 'kayak',
    otaName: 'Kayak',
    defaultCurrency: 'USD',
    authMode: 'api_key_header',
    authHeaderName: 'X-Kayak-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Kayak-Event',
    webhookDefaultEvent: 'rate_update',
    isMetasearch: true,
    metasearchLabel: '(metasearch)',
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Musafir — UAE travel agency, AED, X-Musafir-Key
  // ------------------------------------------
  ['musafir', {
    otaId: 'musafir',
    otaName: 'Musafir',
    defaultCurrency: 'AED',
    defaultCountry: '',
    authMode: 'api_key_header',
    authHeaderName: 'X-Musafir-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-Musafir-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // Plum Guide — Curated stays, GBP, X-PlumGuide-Key
  // ------------------------------------------
  ['plum_guide', {
    otaId: 'plum_guide',
    otaName: 'Plum Guide',
    defaultCurrency: 'GBP',
    defaultCountry: '',
    authMode: 'api_key_header',
    authHeaderName: 'X-PlumGuide-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-PlumGuide-Event',
    isMetasearch: false,
    endpoints: {
      resourceSegment: 'properties',
    },
    roomIdField: 'property_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // TravelGuru — Indian OTA, INR, X-TravelGuru-Key
  // ------------------------------------------
  ['travelguru', {
    otaId: 'travelguru',
    otaName: 'TravelGuru',
    defaultCurrency: 'INR',
    defaultCountry: 'IN',
    authMode: 'api_key_header',
    authHeaderName: 'X-TravelGuru-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-TravelGuru-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],

  // ------------------------------------------
  // TUI — European tour operator, EUR, X-TUI-Key
  // ------------------------------------------
  ['tui', {
    otaId: 'tui',
    otaName: 'TUI',
    defaultCurrency: 'EUR',
    defaultCountry: '',
    authMode: 'api_key_header',
    authHeaderName: 'X-TUI-Key',
    authCredentialKey: 'apiKey',
    webhookHeaderName: 'X-TUI-Event',
    isMetasearch: false,
    roomIdField: 'room_id',
    ratePlanIdField: 'rate_plan_id',
  }],
]);

// ============================================
// HELPER: Get config or throw
// ============================================

export function getRESTClientConfig(otaId: string): RESTClientConfig | undefined {
  return REST_CLIENT_CONFIGS.get(otaId);
}

/**
 * Check whether a given OTA ID is a Tier-3 clone served by ConfigurableRestClient.
 */
export function isConfigurableRESTClient(otaId: string): boolean {
  return REST_CLIENT_CONFIGS.has(otaId);
}

// ============================================
// GENERIC REST CLIENT FALLBACK
// ============================================

/**
 * Minimal config for the GenericRestClient fallback.
 * Used for any OTA not in the explicit registry but still following the generic REST pattern.
 */
export const GENERIC_REST_CONFIG: RESTClientConfig = {
  otaId: 'generic',
  otaName: 'Generic REST',
  defaultCurrency: 'USD',
  authMode: 'api_key_header',
  authHeaderName: 'X-API-Key',
  authCredentialKey: 'apiKey',
  webhookHeaderName: 'X-Event-Type',
  isMetasearch: false,
  endpoints: {
    resourceSegment: 'properties',
  },
  roomIdField: 'room_id',
  ratePlanIdField: 'rate_plan_id',
};
