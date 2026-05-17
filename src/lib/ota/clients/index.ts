/**
 * OTA REST Clients
 * Re-exports for ConfigurableRestClient and its config registry.
 */

export { ConfigurableRestClient } from './configurable-rest-client';
export type {
  RESTClientConfig,
  RESTEndpointPaths,
  AuthCredentialKey,
  AuthMode,
} from './configurable-rest-client';

export {
  REST_CLIENT_CONFIGS,
  GENERIC_REST_CONFIG,
  getRESTClientConfig,
  isConfigurableRESTClient,
} from './rest-configs';
