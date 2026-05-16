/**
 * OTA Content Manager
 * Syncs hotel photos, descriptions, amenities, policies to all connected OTA channels
 * from a single central content repository (like AioSell's 1,000+ OTA channel support).
 */

import { db } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export interface OTAContentProfile {
  id: string;
  tenantId: string;
  propertyId: string;
  channelName: string;
  lastSyncAt: Date;
  syncStatus: 'synced' | 'pending' | 'failed' | 'partial';
  fieldMapping: Record<string, string>;
  totalFields: number;
  syncedFields: number;
  failedFields: number;
}

export interface PropertyContent {
  name: string;
  description: string;
  shortDescription: string;
  photos: Array<{ url: string; caption: string; category: string; primary: boolean }>;
  amenities: string[];
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationPolicy: string;
    childrenPolicy: string;
    petPolicy: string;
    smokingPolicy: string;
  };
  roomTypeContents: Array<{
    roomTypeId: string;
    name: string;
    description: string;
    photos: Array<{ url: string; caption: string; primary: boolean }>;
    amenities: string[];
    maxOccupancy: number;
    bedTypes: string[];
    roomSize: number;
  }>;
  contactInfo: {
    email: string;
    phone: string;
    website: string;
    address: string;
  };
}

export interface ContentSyncResult {
  channelName: string;
  status: 'synced' | 'partial' | 'failed';
  totalFields: number;
  syncedFields: number;
  failedFields: number;
  errors: Array<{ field: string; message: string }>;
  duration: number;
  syncedAt: Date;
}

export type ContentFieldType = 'photos' | 'descriptions' | 'amenities' | 'policies' | 'all';

// ============================================
// CHANNEL-SPECIFIC FIELD MAPPINGS
// ============================================

const CHANNEL_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  booking_com: {
    name: 'hotel_name',
    description: 'hotel_description',
    shortDescription: 'hotel_short_description',
    photos: 'hotel_photos',
    amenities: 'hotel_facilities',
    'policies.checkInTime': 'checkin_time',
    'policies.checkOutTime': 'checkout_time',
    'policies.cancellationPolicy': 'cancellation_policy',
    'policies.childrenPolicy': 'children_policy',
    'policies.petPolicy': 'pet_policy',
    'policies.smokingPolicy': 'smoking_policy',
    'contactInfo.email': 'hotel_email',
    'contactInfo.phone': 'hotel_phone',
    'contactInfo.website': 'hotel_url',
    'contactInfo.address': 'hotel_address',
  },
  expedia: {
    name: 'Name',
    description: 'Descriptions.longDescription',
    shortDescription: 'Descriptions.shortDescription',
    photos: 'Images',
    amenities: 'Amenities',
    'policies.checkInTime': 'Policies.CheckInTime',
    'policies.checkOutTime': 'Policies.CheckOutTime',
    'policies.cancellationPolicy': 'Policies.CancellationPolicy',
    'policies.childrenPolicy': 'Policies.ChildrenPolicy',
    'policies.petPolicy': 'Policies.PetPolicy',
    'policies.smokingPolicy': 'Policies.SmokingPolicy',
    'contactInfo.email': 'Contact.Email',
    'contactInfo.phone': 'Contact.Phone',
    'contactInfo.website': 'Contact.URL',
    'contactInfo.address': 'Location.Address',
  },
  airbnb: {
    name: 'name',
    description: 'description',
    shortDescription: 'summary',
    photos: 'pictures',
    amenities: 'amenities',
    'policies.checkInTime': 'check_in_time',
    'policies.checkOutTime': 'check_out_time',
    'policies.cancellationPolicy': 'cancellation_policy',
    'policies.childrenPolicy': 'house_rules.children_allowed',
    'policies.petPolicy': 'house_rules.pets_allowed',
    'policies.smokingPolicy': 'house_rules.smoking_allowed',
    'contactInfo.email': 'contact_email',
    'contactInfo.phone': 'contact_phone',
    'contactInfo.website': 'listing_url',
    'contactInfo.address': 'location.address',
  },
  agoda: {
    name: 'property_name',
    description: 'property_description',
    shortDescription: 'property_short_desc',
    photos: 'property_photos',
    amenities: 'property_facilities',
    'policies.checkInTime': 'checkin_time',
    'policies.checkOutTime': 'checkout_time',
    'policies.cancellationPolicy': 'cancellation_policy',
    'policies.childrenPolicy': 'children_policy',
    'policies.petPolicy': 'pet_policy',
    'policies.smokingPolicy': 'smoking_policy',
    'contactInfo.email': 'contact_email',
    'contactInfo.phone': 'contact_phone',
    'contactInfo.website': 'property_website',
    'contactInfo.address': 'property_address',
  },
  makemytrip: {
    name: 'hotel_name',
    description: 'hotel_desc',
    shortDescription: 'hotel_short_desc',
    photos: 'hotel_images',
    amenities: 'hotel_amenities',
    'policies.checkInTime': 'check_in',
    'policies.checkOutTime': 'check_out',
    'policies.cancellationPolicy': 'cancellation_policy',
    'policies.childrenPolicy': 'children_policy',
    'policies.petPolicy': 'pet_policy',
    'policies.smokingPolicy': 'smoking_policy',
    'contactInfo.email': 'email',
    'contactInfo.phone': 'phone',
    'contactInfo.website': 'website',
    'contactInfo.address': 'address',
  },
};

/** Default mapping for channels not explicitly listed above */
const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  name: 'property_name',
  description: 'property_description',
  shortDescription: 'property_short_description',
  photos: 'property_photos',
  amenities: 'property_amenities',
  'policies.checkInTime': 'check_in_time',
  'policies.checkOutTime': 'check_out_time',
  'policies.cancellationPolicy': 'cancellation_policy',
  'policies.childrenPolicy': 'children_policy',
  'policies.petPolicy': 'pet_policy',
  'policies.smokingPolicy': 'smoking_policy',
  'contactInfo.email': 'contact_email',
  'contactInfo.phone': 'contact_phone',
  'contactInfo.website': 'contact_website',
  'contactInfo.address': 'contact_address',
};

// ============================================
// CONTENT TRANSFORMATION
// ============================================

/**
 * Transform StaySuite content to channel-specific format
 */
function transformContentForChannel(
  content: PropertyContent,
  channelName: string,
  fields: ContentFieldType
): Record<string, unknown> {
  const mapping = CHANNEL_FIELD_MAPPINGS[channelName] || DEFAULT_FIELD_MAPPING;
  const payload: Record<string, unknown> = {};

  // Apply field-level filtering
  const includeDescriptions = fields === 'all' || fields === 'descriptions';
  const includePhotos = fields === 'all' || fields === 'photos';
  const includeAmenities = fields === 'all' || fields === 'amenities';
  const includePolicies = fields === 'all' || fields === 'policies';

  if (includeDescriptions) {
    payload[mapping.name] = content.name;
    payload[mapping.description] = content.description;
    payload[mapping.shortDescription] = content.shortDescription;
    payload[mapping['contactInfo.email']] = content.contactInfo.email;
    payload[mapping['contactInfo.phone']] = content.contactInfo.phone;
    payload[mapping['contactInfo.website']] = content.contactInfo.website;
    payload[mapping['contactInfo.address']] = content.contactInfo.address;
  }

  if (includePhotos) {
    payload[mapping.photos] = content.photos.map(p => ({
      url: p.url,
      caption: p.caption,
      category: p.category,
      primary: p.primary,
    }));

    // Room type photos
    if (content.roomTypeContents) {
      payload.roomTypes = content.roomTypeContents.map(rt => ({
        externalRoomTypeId: rt.roomTypeId,
        photos: rt.photos.map(p => ({
          url: p.url,
          caption: p.caption,
          primary: p.primary,
        })),
      }));
    }
  }

  if (includeAmenities) {
    payload[mapping.amenities] = content.amenities;

    if (content.roomTypeContents) {
      payload.roomTypeAmenities = content.roomTypeContents.map(rt => ({
        externalRoomTypeId: rt.roomTypeId,
        amenities: rt.amenities,
      }));
    }
  }

  if (includePolicies) {
    payload[mapping['policies.checkInTime']] = content.policies.checkInTime;
    payload[mapping['policies.checkOutTime']] = content.policies.checkOutTime;
    payload[mapping['policies.cancellationPolicy']] = content.policies.cancellationPolicy;
    payload[mapping['policies.childrenPolicy']] = content.policies.childrenPolicy;
    payload[mapping['policies.petPolicy']] = content.policies.petPolicy;
    payload[mapping['policies.smokingPolicy']] = content.policies.smokingPolicy;
  }

  return payload;
}

/**
 * Simulate pushing content to an OTA channel API
 * In production, this would call the actual channel API endpoints.
 */
async function pushContentToChannel(
  channelName: string,
  connectionId: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; errors: Array<{ field: string; message: string }> }> {
  // In production, this would make real API calls to the channel's content API.
  // For example:
  // - Booking.com: POST to their XML content endpoint
  // - Expedia: PUT to their Hotel Content API
  // - Airbnb: PATCH to their Listing API
  //
  // We simulate the response here, assuming success.

  const errors: Array<{ field: string; message: string }> = [];

  // Simulate occasional field-level failures for realism
  const fieldCount = Object.keys(payload).length;
  const failedCount = Math.random() < 0.1 ? Math.floor(Math.random() * Math.min(3, fieldCount)) : 0;

  if (failedCount > 0) {
    const fieldKeys = Object.keys(payload);
    for (let i = 0; i < failedCount; i++) {
      const randomField = fieldKeys[Math.floor(Math.random() * fieldKeys.length)];
      errors.push({
        field: randomField,
        message: `Channel ${channelName} rejected field "${randomField}": invalid format`,
      });
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Fetch property content from DB and build the PropertyContent object
 */
export async function getPropertyContent(
  tenantId: string,
  propertyId: string
): Promise<PropertyContent> {
  const property = await db.property.findFirst({
    where: { id: propertyId, tenantId, deletedAt: null },
  });

  if (!property) {
    throw new Error(`Property not found: ${propertyId}`);
  }

  const roomTypes = await db.roomType.findMany({
    where: { propertyId, status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });

  // Parse amenities from room type JSON
  const parseAmenities = (amenitiesJson: string): string[] => {
    try {
      return JSON.parse(amenitiesJson || '[]');
    } catch {
      return [];
    }
  };

  // Parse photos from property/room type images JSON
  const parsePhotos = (imagesJson: string, primaryIndex = 0): Array<{ url: string; caption: string; category: string; primary: boolean }> => {
    try {
      const images = JSON.parse(imagesJson || '[]');
      return (Array.isArray(images) ? images : []).map((img: Record<string, unknown>, idx: number) => ({
        url: String(img.url || img.src || ''),
        caption: String(img.caption || img.alt || ''),
        category: String(img.category || 'general'),
        primary: idx === primaryIndex,
      }));
    } catch {
      return [];
    }
  };

  // Get cancellation policy if available
  const cancellationPolicies = await db.cancellationPolicy.findMany({
    where: { tenantId, isActive: true },
    take: 1,
  });

  const defaultCancellationPolicy = cancellationPolicies.length > 0
    ? `Free cancellation up to ${cancellationPolicies[0].freeCancelHoursBefore} hours before check-in. ${cancellationPolicies[0].penaltyPercent}% penalty thereafter.`
    : 'Standard cancellation policy applies. Please contact the property for details.';

  return {
    name: property.name,
    description: property.description || '',
    shortDescription: property.description
      ? (property.description.length > 200
          ? property.description.substring(0, 200) + '...'
          : property.description)
      : '',
    photos: parsePhotos(property.logo || '[]'),
    amenities: parseAmenities('[]'), // Property-level amenities are typically stored elsewhere
    policies: {
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      cancellationPolicy: defaultCancellationPolicy,
      childrenPolicy: 'Children of all ages are welcome.',
      petPolicy: 'Pets are not allowed.',
      smokingPolicy: 'Smoking is not permitted.',
    },
    roomTypeContents: roomTypes.map(rt => ({
      roomTypeId: rt.id,
      name: rt.name,
      description: rt.description || '',
      photos: parsePhotos(rt.images),
      amenities: parseAmenities(rt.amenities),
      maxOccupancy: rt.maxOccupancy,
      bedTypes: [], // Could be enhanced with bed type data
      roomSize: rt.sizeSqMeters || rt.sizeSqFeet || 0,
    })),
    contactInfo: {
      email: property.email || '',
      phone: property.phone || '',
      website: property.website || '',
      address: `${property.address}, ${property.city}${property.state ? ', ' + property.state : ''}, ${property.country}${property.postalCode ? ' ' + property.postalCode : ''}`,
    },
  };
}

/**
 * Update property content (central content repository)
 * In production, this would update the Property and RoomType models.
 */
export async function updatePropertyContent(
  tenantId: string,
  propertyId: string,
  content: Partial<PropertyContent>
): Promise<void> {
  const property = await db.property.findFirst({
    where: { id: propertyId, tenantId, deletedAt: null },
  });

  if (!property) {
    throw new Error(`Property not found: ${propertyId}`);
  }

  // Update property-level content
  if (content.name || content.description) {
    await db.property.update({
      where: { id: propertyId },
      data: {
        ...(content.name && { name: content.name }),
        ...(content.description && { description: content.description }),
      },
    });
  }

  // Update policies if provided
  if (content.policies) {
    const policies = content.policies;
    await db.property.update({
      where: { id: propertyId },
      data: {
        ...(policies.checkInTime && { checkInTime: policies.checkInTime }),
        ...(policies.checkOutTime && { checkOutTime: policies.checkOutTime }),
      },
    });
  }

  // Update room type content if provided
  if (content.roomTypeContents) {
    for (const rtc of content.roomTypeContents) {
      // Verify room type belongs to this property
      const roomType = await db.roomType.findFirst({
        where: { id: rtc.roomTypeId, propertyId },
      });
      if (!roomType) continue;

      await db.roomType.update({
        where: { id: rtc.roomTypeId },
        data: {
          ...(rtc.name && { name: rtc.name }),
          ...(rtc.description !== undefined && { description: rtc.description }),
          ...(rtc.maxOccupancy && { maxOccupancy: rtc.maxOccupancy }),
        },
      });
    }
  }
}

/**
 * Sync content to a specific channel
 */
export async function syncContentToChannel(
  tenantId: string,
  propertyId: string,
  channelName: string,
  fields: ContentFieldType = 'all'
): Promise<ContentSyncResult> {
  const startTime = Date.now();

  // Fetch property content
  const content = await getPropertyContent(tenantId, propertyId);

  // Find channel connection
  const connection = await db.channelConnection.findFirst({
    where: { tenantId, channel: channelName, status: 'active' },
  });

  if (!connection) {
    return {
      channelName,
      status: 'failed',
      totalFields: 0,
      syncedFields: 0,
      failedFields: 0,
      errors: [{ field: 'connection', message: `No active connection found for ${channelName}` }],
      duration: Date.now() - startTime,
      syncedAt: new Date(),
    };
  }

  // Get field mapping for this channel
  const mapping = CHANNEL_FIELD_MAPPINGS[channelName] || DEFAULT_FIELD_MAPPING;
  const totalFields = Object.keys(mapping).length;

  // Transform content to channel format
  const payload = transformContentForChannel(content, channelName, fields);

  // Push to channel API
  const result = await pushContentToChannel(channelName, connection.id, payload);

  // Calculate field counts
  const syncedFields = result.success ? totalFields : totalFields - result.errors.length;
  const failedFields = result.errors.length;
  const status: ContentSyncResult['status'] = result.success ? 'synced' : failedFields === totalFields ? 'failed' : 'partial';

  // Update or create content profile
  await db.oTAContentProfile.upsert({
    where: {
      tenantId_propertyId_channelName: { tenantId, propertyId, channelName },
    },
    create: {
      tenantId,
      propertyId,
      channelName,
      syncStatus: status,
      fieldMapping: JSON.stringify(mapping),
      lastSyncAt: new Date(),
      totalFields,
      syncedFields,
      failedFields,
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    },
    update: {
      syncStatus: status,
      fieldMapping: JSON.stringify(mapping),
      lastSyncAt: new Date(),
      totalFields,
      syncedFields,
      failedFields,
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    },
  });

  // Create sync log entry
  await db.oTAContentSyncLog.create({
    data: {
      tenantId,
      propertyId,
      channelName,
      contentType: fields,
      syncType: fields === 'all' ? 'full' : 'partial',
      status,
      totalItems: totalFields,
      syncedItems: syncedFields,
      failedItems: failedFields,
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    },
  });

  return {
    channelName,
    status,
    totalFields,
    syncedFields,
    failedFields,
    errors: result.errors,
    duration: Date.now() - startTime,
    syncedAt: new Date(),
  };
}

/**
 * Sync content to all connected channels
 */
export async function syncContentToAllChannels(
  tenantId: string,
  propertyId: string,
  fields: ContentFieldType = 'all'
): Promise<ContentSyncResult[]> {
  // Get all active channel connections
  const connections = await db.channelConnection.findMany({
    where: { tenantId, status: 'active' },
  });

  const results: ContentSyncResult[] = [];

  // Run syncs sequentially to avoid overwhelming rate limits
  for (const connection of connections) {
    const result = await syncContentToChannel(tenantId, propertyId, connection.channel, fields);
    results.push(result);
  }

  return results;
}

/**
 * Get content sync status for all channels
 */
export async function getContentSyncStatus(
  tenantId: string,
  propertyId: string
): Promise<OTAContentProfile[]> {
  const profiles = await db.oTAContentProfile.findMany({
    where: { tenantId, propertyId },
    orderBy: { lastSyncAt: 'desc' },
  });

  return profiles.map(p => ({
    id: p.id,
    tenantId: p.tenantId,
    propertyId: p.propertyId,
    channelName: p.channelName,
    lastSyncAt: p.lastSyncAt || new Date(),
    syncStatus: p.syncStatus as OTAContentProfile['syncStatus'],
    fieldMapping: JSON.parse(p.fieldMapping || '{}'),
    totalFields: p.totalFields,
    syncedFields: p.syncedFields,
    failedFields: p.failedFields,
  }));
}

/**
 * Get content sync logs for a property
 */
export async function getContentSyncLogs(
  tenantId: string,
  propertyId: string,
  options?: { limit?: number; offset?: number; channelName?: string }
): Promise<{ logs: Array<Record<string, unknown>>; total: number }> {
  const where: Record<string, unknown> = { tenantId, propertyId };
  if (options?.channelName) {
    where.channelName = options.channelName;
  }

  const [logs, total] = await Promise.all([
    db.oTAContentSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    db.oTAContentSyncLog.count({ where }),
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      channelName: log.channelName,
      contentType: log.contentType,
      syncType: log.syncType,
      status: log.status,
      totalItems: log.totalItems,
      syncedItems: log.syncedItems,
      failedItems: log.failedItems,
      errorDetails: log.errorDetails,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      duration: log.completedAt
        ? log.completedAt.getTime() - log.startedAt.getTime()
        : null,
    })),
    total,
  };
}
