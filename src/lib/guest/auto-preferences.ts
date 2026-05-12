import { db } from '@/lib/db';

export interface GuestPreferencesResult {
  bookingId: string;
  guestId: string;
  guestName: string;
  preferences: {
    roomFeatures: RoomFeaturePreference[];
    dietaryNotes: string[];
    communicationPreferences: CommunicationPreference;
    accessibilityNeeds: string[];
    specialRequests: string[];
    learnedPreferences: Record<string, unknown>;
  };
  applicableRoomAmenities: string[];
  applicableDietaryRequirements: string | null;
  loyaltyTier: string;
  isRepeatGuest: boolean;
  isVip: boolean;
  totalStays: number;
}

export interface RoomFeaturePreference {
  feature: string;
  preference: 'strong' | 'moderate' | 'mild' | 'none';
  matched: boolean;
  description: string;
}

export interface CommunicationPreference {
  channel: string;
  optIn: boolean;
  language: string | null;
}

/**
 * applyGuestPreferences - Reads guest preferences and returns suggested room features,
 * dietary notes, and communication preferences for a booking.
 *
 * This is designed to be called during the check-in flow to auto-apply
 * guest preferences to the room assignment and service configuration.
 */
export async function applyGuestPreferences(bookingId: string): Promise<GuestPreferencesResult> {
  // Fetch the booking with guest data
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      primaryGuest: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          preferences: true,
          dietaryRequirements: true,
          specialRequests: true,
          isVip: true,
          loyaltyTier: true,
          totalStays: true,
          emailOptIn: true,
          smsOptIn: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  const guest = booking.primaryGuest;

  // Parse stored preferences JSON
  let storedPrefs: Record<string, unknown> = {};
  try {
    storedPrefs = typeof guest.preferences === 'string'
      ? JSON.parse(guest.preferences)
      : guest.preferences || {};
  } catch {
    storedPrefs = {};
  }

  // Fetch guest behavior for learned preferences
  let learnedPrefs: Record<string, unknown> = {};
  let isRepeatGuest = false;
  try {
    const behavior = await db.guestBehavior.findUnique({
      where: { guestId: guest.id },
      select: {
        isRepeatGuest: true,
        learnedPreferences: true,
        preferredRoomTypes: true,
        totalNights: true,
      },
    });

    if (behavior) {
      isRepeatGuest = behavior.isRepeatGuest;
      if (behavior.learnedPreferences) {
        try {
          learnedPrefs = typeof behavior.learnedPreferences === 'string'
            ? JSON.parse(behavior.learnedPreferences)
            : behavior.learnedPreferences || {};
        } catch { /* ignore */ }
      }
    }
  } catch { /* no behavior record */ }

  // Build room feature preferences
  const roomFeatures: RoomFeaturePreference[] = buildRoomFeaturePreferences(storedPrefs, learnedPrefs);

  // Build dietary notes
  const dietaryNotes = buildDietaryNotes(guest.dietaryRequirements, storedPrefs);

  // Build communication preferences
  const communicationPreferences: CommunicationPreference = {
    channel: buildPreferredChannel(storedPrefs, guest),
    optIn: guest.emailOptIn || guest.smsOptIn,
    language: extractLanguage(storedPrefs),
  };

  // Build accessibility needs
  const accessibilityNeeds = buildAccessibilityNeeds(storedPrefs, booking.specialRequests);

  // Build special requests
  const specialRequests = buildSpecialRequests(guest.specialRequests, storedPrefs, learnedPrefs);

  // Determine applicable room amenities from preferences
  const applicableRoomAmenities = buildApplicableAmenities(storedPrefs, learnedPrefs);

  return {
    bookingId,
    guestId: guest.id,
    guestName: `${guest.firstName} ${guest.lastName}`,
    preferences: {
      roomFeatures,
      dietaryNotes,
      communicationPreferences,
      accessibilityNeeds,
      specialRequests,
      learnedPreferences: learnedPrefs,
    },
    applicableRoomAmenities,
    applicableDietaryRequirements: guest.dietaryRequirements,
    loyaltyTier: guest.loyaltyTier,
    isRepeatGuest,
    isVip: guest.isVip,
    totalStays: guest.totalStays,
  };
}

// Helper: build room feature preferences from stored data
function buildRoomFeaturePreferences(
  storedPrefs: Record<string, unknown>,
  learnedPrefs: Record<string, unknown>,
): RoomFeaturePreference[] {
  const features: RoomFeaturePreference[] = [];

  // View preference
  const viewPref = storedPrefs.view as string | undefined;
  if (viewPref === 'sea') {
    features.push({ feature: 'hasSeaView', preference: 'strong', matched: false, description: 'Prefers sea view' });
  } else if (viewPref === 'mountain') {
    features.push({ feature: 'hasMountainView', preference: 'strong', matched: false, description: 'Prefers mountain view' });
  } else if (viewPref === 'garden') {
    features.push({ feature: 'hasBalcony', preference: 'moderate', matched: false, description: 'Prefers garden/balcony view' });
  } else if (viewPref === 'city') {
    features.push({ feature: 'highFloor', preference: 'moderate', matched: false, description: 'Prefers city view (higher floor)' });
  }

  // Balcony preference
  const balconyPref = storedPrefs.balcony as string | undefined;
  if (balconyPref === 'yes') {
    features.push({ feature: 'hasBalcony', preference: 'strong', matched: false, description: 'Requires balcony' });
  } else if (balconyPref === 'no') {
    features.push({ feature: 'hasBalcony', preference: 'none', matched: false, description: 'Prefers no balcony' });
  }

  // Smoking preference
  const smokingPref = storedPrefs.smoking as string | undefined;
  if (smokingPref === 'no') {
    features.push({ feature: 'nonSmoking', preference: 'strong', matched: false, description: 'Requires non-smoking room' });
  } else if (smokingPref === 'yes') {
    features.push({ feature: 'smoking', preference: 'strong', matched: false, description: 'Requires smoking room' });
  }

  // Floor preference
  const floorPref = storedPrefs.floor as string | undefined;
  if (floorPref === 'low') {
    features.push({ feature: 'lowFloor', preference: 'moderate', matched: false, description: 'Prefers lower floor' });
  } else if (floorPref === 'high') {
    features.push({ feature: 'highFloor', preference: 'moderate', matched: false, description: 'Prefers higher floor' });
  }

  // Bed type preference
  const bedPref = storedPrefs.bedType as string | undefined;
  if (bedPref) {
    features.push({ feature: 'bedType', preference: 'moderate', matched: false, description: `Prefers ${bedPref} bed` });
  }

  // Room size preference
  const sizePref = storedPrefs.roomSize as string | undefined;
  if (sizePref) {
    features.push({ feature: 'roomSize', preference: 'mild', matched: false, description: `Prefers ${sizePref} room` });
  }

  // From learned preferences
  if (learnedPrefs.preferredFloor) {
    const existingFloor = features.find(f => f.feature === 'lowFloor' || f.feature === 'highFloor');
    if (!existingFloor) {
      const floor = Number(learnedPrefs.preferredFloor);
      features.push({
        feature: 'preferredFloor',
        preference: 'mild',
        matched: false,
        description: `Previously stayed on floor ${floor}`,
      });
    }
  }

  if (learnedPrefs.preferredRoomType) {
    features.push({
      feature: 'roomType',
      preference: 'mild',
      matched: false,
      description: `Previously booked ${(learnedPrefs.preferredRoomType as string) || 'similar room type'}`,
    });
  }

  // Temperature preference
  const tempPref = storedPrefs.temperature as string | undefined;
  if (tempPref) {
    features.push({ feature: 'temperature', preference: 'mild', matched: false, description: `Prefers ${tempPref} temperature` });
  }

  // Pillow preference
  const pillowPref = storedPrefs.pillowType as string | undefined;
  if (pillowPref) {
    features.push({ feature: 'pillowType', preference: 'mild', matched: false, description: `Prefers ${pillowPref} pillows` });
  }

  return features;
}

// Helper: build dietary notes
function buildDietaryNotes(
  dietaryRequirements: string | null | undefined,
  storedPrefs: Record<string, unknown>,
): string[] {
  const notes: string[] = [];

  if (dietaryRequirements) {
    notes.push(dietaryRequirements);
  }

  const mealPref = storedPrefs.mealPreference as string | undefined;
  if (mealPref) {
    notes.push(`Meal preference: ${mealPref}`);
  }

  const allergies = storedPrefs.allergies as string | undefined;
  if (allergies) {
    notes.push(`Allergies: ${allergies}`);
  }

  return notes;
}

// Helper: build communication preferences
function buildPreferredChannel(
  storedPrefs: Record<string, unknown>,
  guest: { emailOptIn: boolean; smsOptIn: boolean; email: string | null; phone: string | null },
): string {
  const commPref = storedPrefs.communication as string | undefined;
  if (commPref === 'email' && guest.emailOptIn) return 'email';
  if (commPref === 'sms' && guest.smsOptIn) return 'sms';
  if (commPref === 'whatsapp') return 'whatsapp';
  if (commPref === 'none') return 'none';

  // Default: prefer email if opted in, otherwise sms
  return guest.emailOptIn ? 'email' : guest.smsOptIn ? 'sms' : 'none';
}

// Helper: extract language
function extractLanguage(storedPrefs: Record<string, unknown>): string | null {
  const lang = storedPrefs.language as string | undefined;
  return lang || null;
}

// Helper: build accessibility needs
function buildAccessibilityNeeds(
  storedPrefs: Record<string, unknown>,
  specialRequests: string | null | undefined,
): string[] {
  const needs: string[] = [];

  const accessPref = storedPrefs.accessibility as string | undefined;
  if (accessPref === 'required') {
    needs.push('Accessible room required');
  } else if (accessPref === 'preferred') {
    needs.push('Accessible room preferred');
  }

  if (specialRequests) {
    const lower = specialRequests.toLowerCase();
    if (lower.includes('wheelchair')) needs.push('Wheelchair accessible');
    if (lower.includes('mobility')) needs.push('Mobility assistance');
    if (lower.includes('hearing impaired')) needs.push('Hearing assistance');
    if (lower.includes('visual')) needs.push('Visual assistance');
  }

  return [...new Set(needs)];
}

// Helper: build special requests
function buildSpecialRequests(
  specialRequests: string | null | undefined,
  storedPrefs: Record<string, unknown>,
  learnedPrefs: Record<string, unknown>,
): string[] {
  const requests: string[] = [];

  if (specialRequests) {
    requests.push(specialRequests);
  }

  const extraPillows = storedPrefs.extraPillows as string | undefined;
  if (extraPillows === 'yes') {
    requests.push('Extra pillows requested');
  }

  const extraBed = storedPrefs.extraBed as string | undefined;
  if (extraBed === 'yes') {
    requests.push('Extra bed / crib requested');
  }

  const lateCheckout = storedPrefs.lateCheckout as string | undefined;
  if (lateCheckout === 'always') {
    requests.push('Frequent late checkout requester');
  }

  const minibar = storedPrefs.minibar as string | undefined;
  if (minibar === 'no') {
    requests.push('No minibar items');
  }

  // From learned preferences
  if (learnedPrefs.frequentlyRequestedServices) {
    const services = learnedPrefs.frequentlyRequestedServices;
    if (Array.isArray(services)) {
      for (const service of services) {
        if (typeof service === 'string') {
          requests.push(`Frequently requests: ${service}`);
        }
      }
    }
  }

  return [...new Set(requests)];
}

// Helper: build applicable amenities
function buildApplicableAmenities(
  storedPrefs: Record<string, unknown>,
  learnedPrefs: Record<string, unknown>,
): string[] {
  const amenities: string[] = [];

  const extras = storedPrefs.extras as string[] | undefined;
  if (Array.isArray(extras)) {
    amenities.push(...extras.filter((e): e is string => typeof e === 'string'));
  }

  const requestedAmenities = storedPrefs.amenities as string[] | undefined;
  if (Array.isArray(requestedAmenities)) {
    amenities.push(...requestedAmenities.filter((a): a is string => typeof a === 'string'));
  }

  return [...new Set(amenities)];
}
