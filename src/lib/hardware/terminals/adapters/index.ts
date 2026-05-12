/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Terminal adapter factory map and creation utility.
 */

import type { HardwareProviderId } from '../../types';
import type { ITerminalProvider } from '../terminal-provider';
import { SimulatedTerminalProvider } from './simulator';
import { StripeTerminalAdapter } from './stripe-terminal';
import { SquareTerminalAdapter } from './square-terminal';
import { AdyenTerminalAdapter } from './adyen-terminal';
import { VerifoneEngageAdapter } from './verifone-engage';
import { IngenicoAdapter } from './ingenico';

// ---------------------------------------------------------------------------
// Factory map — each entry is a zero-arg factory that returns a new instance.
// Callers are responsible for calling `initialize()` on the returned adapter.
// ---------------------------------------------------------------------------

export const terminalAdapterFactoryMap: Record<string, () => ITerminalProvider> = {
  'simulator': () => new SimulatedTerminalProvider(),
  'stripe-terminal': () => new StripeTerminalAdapter(),
  'square-terminal': () => new SquareTerminalAdapter(),
  'adyen-terminal': () => new AdyenTerminalAdapter(),
  'verifone-engage': () => new VerifoneEngageAdapter(),
  'ingenico': () => new IngenicoAdapter(),
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a terminal adapter instance for the given provider ID.
 * The returned adapter must be initialized with `initialize(config, credentials)`
 * before use.
 *
 * @throws Error if the provider ID is not registered.
 */
export function createTerminalAdapter(providerId: HardwareProviderId): ITerminalProvider {
  const factory = terminalAdapterFactoryMap[providerId];

  if (!factory) {
    throw new Error(
      `No terminal adapter registered for provider "${providerId}". ` +
      `Available providers: ${Object.keys(terminalAdapterFactoryMap).join(', ')}`,
    );
  }

  return factory();
}
