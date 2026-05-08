/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Lock adapter factory map and creation utility.
 */

import type { HardwareProviderId } from '../../types';
import type { ILockProvider } from '../lock-provider';
import { SimulatedLockProvider } from './simulator';
import { AssaAbloyVisionlineAdapter } from './assa-abloy-visionline';
import { SaltoKSAdapter } from './salto-ks';
import { NukiAdapter } from './nuki';
import { SeamAdapter } from './seam';
import { DormakabaAdapter } from './dormakaba';

// ---------------------------------------------------------------------------
// Factory map — each entry is a zero-arg factory that returns a new instance.
// Callers are responsible for calling `initialize()` on the returned adapter.
// ---------------------------------------------------------------------------

export const lockAdapterFactoryMap: Record<string, () => ILockProvider> = {
  'simulator': () => new SimulatedLockProvider(),
  'assa-abloy-visionline': () => new AssaAbloyVisionlineAdapter(),
  'salto-ks': () => new SaltoKSAdapter(),
  'nuki': () => new NukiAdapter(),
  'seam': () => new SeamAdapter(),
  'dormakaba-saflok': () => new DormakabaAdapter(),
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a lock adapter instance for the given provider ID.
 * The returned adapter must be initialized with `initialize(config, credentials)`
 * before use.
 *
 * @throws Error if the provider ID is not registered.
 */
export function createLockAdapter(providerId: HardwareProviderId): ILockProvider {
  const factory = lockAdapterFactoryMap[providerId];

  if (!factory) {
    throw new Error(
      `No lock adapter registered for provider "${providerId}". ` +
      `Available providers: ${Object.keys(lockAdapterFactoryMap).join(', ')}`,
    );
  }

  return factory();
}
