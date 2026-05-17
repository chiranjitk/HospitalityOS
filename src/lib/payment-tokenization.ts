/**
 * Payment Tokenization Utilities
 *
 * Provides helpers for masking card numbers, validating gateway token formats,
 * and fetching token details from payment gateways.
 */

/**
 * Mask a card number showing only the last 4 digits.
 * e.g. "4111111111111111" → "************1111"
 */
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return '****';
  const last4 = cardNumber.replace(/\D/g, '').slice(-4);
  const maskedLength = Math.max(last4.length, 4);
  return '*'.repeat(maskedLength) + last4;
}

/**
 * Basic format validation for gateway tokens.
 * Returns true if the token appears valid for the given gateway.
 */
export function validateTokenFormat(gateway: string, token: string): boolean {
  if (!gateway || !token) return false;

  switch (gateway.toLowerCase()) {
    case 'stripe':
      // Stripe tokens: "tok_" prefix followed by 24+ alphanumeric chars
      // Stripe payment methods: "pm_" prefix
      return /^(tok_|pm_)[a-zA-Z0-9_]{16,}$/.test(token);

    case 'razorpay':
      // Razorpay tokens: "token_" prefix followed by hex chars
      // or a Razorpay payment method ID
      return /^(token_)[a-zA-Z0-9]{12,}$/.test(token) || /^[a-zA-Z0-9]{14,}$/.test(token);

    case 'paypal':
      // PayPal tokens: typically alphanumeric, 17+ chars
      // Could be a billing agreement token or order token
      return /^[A-Za-z0-9\-_]{10,}$/.test(token);

    case 'braintree':
      // Braintree nonce: hex string or "fake_" for sandbox
      return /^[a-fA-F0-9\-_]{16,}$/.test(token) || /^fake_[a-zA-Z0-9_]+$/.test(token);

    default:
      // For unknown gateways, basic non-empty check with min length
      return token.length >= 8;
  }
}

/**
 * Infer card brand from card number (BIN/IIN range).
 */
export function inferCardBrand(cardLast4OrFull: string): string {
  const digits = cardLast4OrFull.replace(/\D/g, '');
  if (!digits) return 'unknown';

  // Only check first 2 digits if we have more than 4
  if (digits.length > 4) {
    const first2 = digits.slice(0, 2);
    const first4 = digits.slice(0, 4);

    if (/^4/.test(digits)) return 'visa';
    if (/^5[1-5]/.test(first2) || /^2[2-7]/.test(first2)) return 'mastercard';
    if (/^3[47]/.test(first2)) return 'amex';
    if (/^6(?:011|5)/.test(first4)) return 'discover';
    if (/^35(2[89]|[3-8])/.test(first4)) return 'jcb';
    if (/^3(0[0-5]|[68])/.test(first2)) return 'diners_club';
  }

  return 'unknown';
}

interface GatewayTokenInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/**
 * Fetch token details from a payment gateway API.
 * In production, this would call the respective gateway's API to verify the token
 * and extract card details. For now, it uses heuristic parsing from metadata.
 */
export async function getGatewayTokenInfo(
  gateway: string,
  token: string,
  metadata?: Record<string, unknown>
): Promise<GatewayTokenInfo> {
  // If metadata is provided with card details, use that directly
  if (metadata) {
    if (metadata.last4 && metadata.brand && metadata.expMonth && metadata.expYear) {
      return {
        brand: metadata.brand as string,
        last4: metadata.last4 as string,
        expMonth: metadata.expMonth as number,
        expYear: metadata.expYear as number,
      };
    }
  }

  // In production, this would make API calls:
  // - Stripe: stripe.tokens.retrieve(token) or stripe.paymentMethods.retrieve(token)
  // - Razorpay: razorpayInstance.paymentMethod.fetch(token)
  // - PayPal: PayPal API to verify token
  //
  // For now, return a default response indicating the token is valid but
  // card details need to be provided via metadata during token creation
  switch (gateway.toLowerCase()) {
    case 'stripe': {
      // Stripe tokens need metadata from the client-side
      // The client should pass card details when creating the stored token
      return {
        brand: (metadata?.cardBrand as string) || 'unknown',
        last4: (metadata?.last4 as string) || '0000',
        expMonth: (metadata?.expMonth as number) || 0,
        expYear: (metadata?.expYear as number) || 0,
      };
    }

    case 'razorpay':
      return {
        brand: (metadata?.cardBrand as string) || 'unknown',
        last4: (metadata?.last4 as string) || '0000',
        expMonth: (metadata?.expMonth as number) || 0,
        expYear: (metadata?.expYear as number) || 0,
      };

    case 'paypal':
      // PayPal tokens don't always have card details
      return {
        brand: 'paypal',
        last4: (metadata?.last4 as string) || '',
        expMonth: 0,
        expYear: 0,
      };

    default:
      return {
        brand: 'unknown',
        last4: (metadata?.last4 as string) || '0000',
        expMonth: (metadata?.expMonth as number) || 0,
        expYear: (metadata?.expYear as number) || 0,
      };
  }
}

/**
 * Validate that a card expiry is not in the past.
 */
export function isExpiryValid(month: number, year: number): boolean {
  if (!month || !year) return false;
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Card expires at end of expiry month
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

/**
 * Normalize card last4 to exactly 4 digits.
 */
export function normalizeLast4(last4: string): string {
  const digits = (last4 || '').replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}
