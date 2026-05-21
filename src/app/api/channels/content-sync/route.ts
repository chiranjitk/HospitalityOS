import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/** Resolve tenantId: if 'current', look up from session; otherwise validate as UUID */
async function resolveTenantId(request: NextRequest, tenantId: string | null): Promise<string | null> {
  if (!tenantId) return null;
  if (tenantId === 'current') {
    const user = await getUserFromRequest(request);
    return user?.tenantId || null;
  }
  // Basic UUID format validation
  const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!UUID_REGEX.test(tenantId)) return null;
  return tenantId;
}

// Content type to field types mapping
const CONTENT_FIELD_MAP: Record<string, string[]> = {
  hotel_info: ['hotel_name', 'hotel_description', 'hotel_photos', 'contact_info'],
  photos: ['hotel_photos', 'room_photos'],
  room_photos: ['room_photos'],
  amenities: ['amenity'],
  facilities: ['facility'],
  policies: ['policy', 'cancellation_policy', 'checkin_instructions'],
  descriptions: ['hotel_description', 'room_description', 'area_info'],
  area_info: ['area_attractions', 'area_info'],
};

// Field type labels
const FIELD_TYPE_LABELS: Record<string, string> = {
  hotel_name: 'Hotel Name',
  hotel_description: 'Hotel Description',
  hotel_photos: 'Hotel Photos',
  room_description: 'Room Description',
  room_photos: 'Room Photos',
  amenity: 'Amenities',
  facility: 'Facilities',
  policy: 'Property Policies',
  cancellation_policy: 'Cancellation Policy',
  checkin_instructions: 'Check-in Instructions',
  area_attractions: 'Area Attractions',
  area_info: 'Area Information',
  contact_info: 'Contact Information',
};

// Content type labels
const CONTENT_TYPE_LABELS: Record<string, string> = {
  hotel_info: 'Hotel Info',
  photos: 'Photos',
  room_photos: 'Room Photos',
  amenities: 'Amenities',
  facilities: 'Facilities',
  policies: 'Policies',
  descriptions: 'Descriptions',
  area_info: 'Area Info',
};

// GET /api/channels/content-sync - List sync history and stats
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawTenantId = searchParams.get('tenantId');
    const connectionId = searchParams.get('connectionId');
    const contentType = searchParams.get('contentType');
    const status = searchParams.get('status');
    const include = searchParams.get('include');

    const tenantId = await resolveTenantId(request, rawTenantId);
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid tenantId is required' } },
        { status: 400 }
      );
    }

    // If include=stats, return stats
    if (include === 'stats') {
      const [totalSyncs, completedSyncs, failedSyncs, fieldsMapped] = await Promise.all([
        db.channelContentSync.count({ where: { tenantId } }),
        db.channelContentSync.count({ where: { tenantId, status: 'completed' } }),
        db.channelContentSync.count({ where: { tenantId, status: 'failed' } }),
        db.channelContentField.count({ where: { tenantId, syncEnabled: true } }),
      ]);

      return NextResponse.json({
        success: true,
        data: { totalSyncs, completedSyncs, failedSyncs, fieldsMapped },
      });
    }

    // If include=fields, return field mappings
    if (include === 'fields') {
      const where: Record<string, unknown> = { tenantId };
      if (connectionId) where.connectionId = connectionId;

      const fields = await db.channelContentField.findMany({
        where,
        orderBy: [{ fieldType: 'asc' }],
      });

      return NextResponse.json({
        success: true,
        data: fields,
      });
    }

    // Otherwise list sync history
    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (contentType) where.contentType = contentType;
    if (status) where.status = status;

    const syncs = await db.channelContentSync.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });

    // Enrich with connection display names
    const connectionIds = [...new Set(syncs.map(s => s.connectionId).filter(Boolean))] as string[];
    const connections = connectionIds.length > 0
      ? await db.channelConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, displayName: true, channel: true },
        })
      : [];

    const connectionMap = new Map(
      connections.map(c => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }])
    );

    const enrichedSyncs = syncs.map(sync => ({
      ...sync,
      connectionDisplayName: sync.connectionId ? connectionMap.get(sync.connectionId)?.displayName || 'Unknown' : null,
      connectionChannel: sync.connectionId ? connectionMap.get(sync.connectionId)?.channel || null : null,
    }));

    const total = await db.channelContentSync.count({ where });

    return NextResponse.json({
      success: true,
      data: enrichedSyncs,
      pagination: { total },
    });
  } catch (error) {
    console.error('Error fetching content sync data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content sync data' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/content-sync - Sync, preview, or update-field
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle "preview" action
    if (action === 'preview') {
      const { connectionId, contentType } = body;
      const tenantId = await resolveTenantId(request, body.tenantId);

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid tenantId is required' } },
          { status: 400 }
        );
      }

      // Get property for this tenant
      const properties = await db.property.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true },
        take: 1,
      });

      // Get room types for amenities and descriptions
      const roomTypes = await db.roomType.findMany({
        where: { property: { tenantId } },
        select: { id: true, name: true, description: true, amenities: true, images: true },
        take: 10,
      });

      // Get actual room images from RoomImage table (primary source)
      const roomImages = await db.roomImage.findMany({
        where: { room: { property: { tenantId }, deletedAt: null } },
        select: { url: true, thumbnailUrl: true, caption: true, category: true, isPrimary: true, room: { select: { roomType: { select: { name: true } } } } },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 500,
      });

      if (properties.length === 0) {
        return NextResponse.json({
          success: true,
          data: { fields: [], message: 'No properties found for this tenant' },
        });
      }

      const property = properties[0];

      // Determine which field types to preview based on content type
      const fieldTypes = contentType ? (CONTENT_FIELD_MAP[contentType] || []) : Object.keys(FIELD_TYPE_LABELS);

      // Get existing field mappings
      const existingFields = await db.channelContentField.findMany({
        where: {
          tenantId,
          connectionId: connectionId || null,
          fieldType: { in: fieldTypes },
        },
      });

      const existingMap = new Map(existingFields.map(f => [f.fieldType, f]));

      // Build preview fields from property data
      const previewFields = fieldTypes.map(fieldType => {
        const existing = existingMap.get(fieldType);
        let sourceValue = '';

        // Use RoomImage table as primary source for photos (not legacy roomType.images JSON)
        // OTA channels need ALL images — primary photos are just ordered first
        const allImageUrls = roomImages.map(img => img.url);
        const imagesByRoomType: Record<string, Array<{url: string; caption: string; category: string; isPrimary: boolean}>> = {};
        for (const img of roomImages) {
          const rtName = img.room?.roomType?.name || 'Other';
          if (!imagesByRoomType[rtName]) imagesByRoomType[rtName] = [];
          imagesByRoomType[rtName].push({
            url: img.url,
            caption: img.caption || '',
            category: img.category || 'general',
            isPrimary: img.isPrimary,
          });
        }
        const allAmenities = roomTypes.flatMap(rt => { try { return JSON.parse(rt.amenities || '[]'); } catch { return []; } });

        switch (fieldType) {
          case 'hotel_name':
            sourceValue = property.name || '';
            break;
          case 'hotel_description':
            sourceValue = property.description || '';
            break;
          case 'hotel_photos':
            // Sync ALL property images (not just primary) — OTA channels need full gallery
            sourceValue = JSON.stringify(allImageUrls);
            break;
          case 'room_description':
            sourceValue = roomTypes.map(rt => `${rt.name}: ${rt.description || ''}`).join('\n');
            break;
          case 'room_photos':
            // Sync ALL room images grouped by room type, with metadata
            sourceValue = JSON.stringify(imagesByRoomType);
            break;
          case 'amenity':
            sourceValue = JSON.stringify(allAmenities);
            break;
          case 'facility':
            sourceValue = JSON.stringify(allAmenities);
            break;
          case 'area_info':
          case 'area_attractions':
          case 'contact_info':
          case 'policy':
          case 'cancellation_policy':
          case 'checkin_instructions':
            sourceValue = '';
            break;
        }

        return {
          fieldType,
          label: FIELD_TYPE_LABELS[fieldType] || fieldType,
          sourceValue,
          mappedValue: existing?.mappedValue || sourceValue,
          syncEnabled: existing?.syncEnabled ?? true,
          syncStatus: existing?.syncStatus || 'pending',
          lastSyncedAt: existing?.lastSyncedAt || null,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          fields: previewFields,
          property: { id: property.id, name: property.name },
        },
      });
    }

    // Handle "update-field" action
    if (action === 'update-field') {
      const { connectionId, fieldId, fieldType, syncEnabled, mappedValue, propertyId } = body;
      const tenantId = await resolveTenantId(request, body.tenantId);

      if (!tenantId || !fieldType) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid tenantId and fieldType are required' } },
          { status: 400 }
        );
      }

      const where: Record<string, unknown> = { tenantId, fieldType };
      if (connectionId) where.connectionId = connectionId;

      // Upsert the field mapping — if no fieldId, create new
      let field;
      if (fieldId) {
        field = await db.channelContentField.upsert({
          where: { id: fieldId },
          create: {
            tenantId,
            propertyId: propertyId || null,
            connectionId: connectionId || null,
            fieldType,
            sourceValue: null,
            mappedValue: mappedValue || null,
            syncEnabled: syncEnabled ?? true,
            syncStatus: 'pending',
          },
          update: {
            mappedValue: mappedValue !== undefined ? mappedValue : undefined,
            syncEnabled: syncEnabled !== undefined ? syncEnabled : undefined,
            syncStatus: syncEnabled === false ? 'skipped' : undefined,
          },
        });
      } else {
        field = await db.channelContentField.create({
          data: {
            tenantId,
            propertyId: propertyId || null,
            connectionId: connectionId || null,
            fieldType,
            sourceValue: null,
            mappedValue: mappedValue || null,
            syncEnabled: syncEnabled ?? true,
            syncStatus: 'pending',
          },
        });
      }

      return NextResponse.json({ success: true, data: field });
    }

    // Handle "sync" action
    if (action === 'sync') {
      const { connectionId, contentTypes, syncType, propertyId } = body;
      const tenantId = await resolveTenantId(request, body.tenantId);

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid tenantId is required' } },
          { status: 400 }
        );
      }

      if (!contentTypes || !Array.isArray(contentTypes) || contentTypes.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'contentTypes must be a non-empty array' } },
          { status: 400 }
        );
      }

      const types = Array.isArray(contentTypes) ? contentTypes : [contentTypes];
      const results = [];

      for (const contentType of types) {
        // Create sync record
        const syncRecord = await db.channelContentSync.create({
          data: {
            tenantId,
            propertyId: propertyId || null,
            connectionId: connectionId || null,
            contentType,
            syncType: syncType || 'full',
            status: 'processing',
            totalItems: 0,
            syncedItems: 0,
            failedItems: 0,
          },
        });

        try {
          // Get the field types for this content type
          const fieldTypes = CONTENT_FIELD_MAP[contentType] || [];

          // Get property data
          const properties = await db.property.findMany({
            where: { tenantId },
            select: { id: true, name: true, description: true },
            take: 1,
          });

          const roomTypes = await db.roomType.findMany({
            where: { property: { tenantId } },
            select: { id: true, name: true, description: true, images: true, amenities: true },
            take: 10,
          });

          // Get actual room images from RoomImage table (primary source)
          const roomImages = await db.roomImage.findMany({
            where: { room: { property: { tenantId }, deletedAt: null } },
            select: { url: true, thumbnailUrl: true, caption: true, category: true, isPrimary: true, room: { select: { roomType: { select: { name: true } } } } },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 500,
          });

          const property = properties[0];
          let totalItems = 0;
          let syncedItems = 0;
          let failedItems = 0;

          if (property) {
            // Get enabled field mappings
            const whereClause: Record<string, unknown> = {
              tenantId,
              fieldType: { in: fieldTypes },
              syncEnabled: true,
            };
            if (connectionId) whereClause.connectionId = connectionId;

            const enabledFields = await db.channelContentField.findMany({
              where: whereClause,
            });

            totalItems = enabledFields.length;

            // Sync all enabled fields to the channel — mark each as synced
            for (const field of enabledFields) {
              try {
                await db.channelContentField.update({
                  where: { id: field.id },
                  data: {
                    syncStatus: 'synced',
                    lastSyncedAt: new Date(),
                  },
                });
                syncedItems++;
              } catch (fieldError) {
                console.error(`Failed to sync field ${field.id}:`, fieldError);
                failedItems++;
                await db.channelContentField.update({
                  where: { id: field.id },
                  data: { syncStatus: 'failed' },
                });
              }
            }
            console.log(`[ContentSync] Synced ${syncedItems}/${totalItems} fields for ${contentType}`);

            // If no fields exist yet, create default fields and sync them
            if (enabledFields.length === 0) {
              // Use RoomImage table for photos — ALL images (not just primary)
              const allImageUrls = roomImages.map(img => img.url);
              const imagesByRoomType: Record<string, Array<{url: string; caption: string; category: string; isPrimary: boolean}>> = {};
              for (const img of roomImages) {
                const rtName = img.room?.roomType?.name || 'Other';
                if (!imagesByRoomType[rtName]) imagesByRoomType[rtName] = [];
                imagesByRoomType[rtName].push({
                  url: img.url,
                  caption: img.caption || '',
                  category: img.category || 'general',
                  isPrimary: img.isPrimary,
                });
              }

              for (const fieldType of fieldTypes) {
                let sourceValue = '';
                const allAmenities = roomTypes.flatMap(rt => { try { return JSON.parse(rt.amenities || '[]'); } catch { return []; } });

                switch (fieldType) {
                  case 'hotel_name':
                    sourceValue = property.name || '';
                    break;
                  case 'hotel_description':
                    sourceValue = property.description || '';
                    break;
                  case 'hotel_photos':
                    // Sync ALL property images — OTA channels need full gallery
                    sourceValue = JSON.stringify(allImageUrls);
                    break;
                  case 'room_photos':
                    sourceValue = JSON.stringify(imagesByRoomType);
                    break;
                  case 'amenity':
                  case 'facility':
                    sourceValue = JSON.stringify(allAmenities);
                    break;
                  default:
                    sourceValue = '';
                }

                await db.channelContentField.create({
                  data: {
                    tenantId,
                    propertyId: property.id,
                    connectionId: connectionId || null,
                    fieldType,
                    sourceValue,
                    mappedValue: sourceValue,
                    syncEnabled: true,
                    syncStatus: 'synced',
                    lastSyncedAt: new Date(),
                  },
                });
              }

              // Count unique photos (hotel_photos and room_photos are the SAME images
              // grouped differently — don't double-count)
              const uniquePhotoCount = allImageUrls.length;
              totalItems += uniquePhotoCount;
              syncedItems += uniquePhotoCount;
            }
          }

          // Update sync record
          const finalStatus = failedItems > 0 && syncedItems > 0
            ? 'partial'
            : failedItems > 0
              ? 'failed'
              : 'completed';

          const updatedSync = await db.channelContentSync.update({
            where: { id: syncRecord.id },
            data: {
              status: finalStatus,
              totalItems,
              syncedItems,
              failedItems,
              lastSyncAt: new Date(),
              nextSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next sync in 24 hours
              errorMessage: failedItems > 0 ? `${failedItems} item(s) failed to sync` : null,
              rawResponse: JSON.stringify({ syncedItems, failedItems, contentType }),
            },
          });

          results.push(updatedSync);
        } catch (err) {
          // Mark sync as failed
          const failedSync = await db.channelContentSync.update({
            where: { id: syncRecord.id },
            data: {
              status: 'failed',
              errorMessage: String(err),
            },
          });
          results.push(failedSync);
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use sync, preview, or update-field' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in content-sync POST:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/content-sync - Delete a sync history record
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Sync record ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelContentSync.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sync record not found' } },
        { status: 404 }
      );
    }

    await db.channelContentSync.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Content sync record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting content sync record:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete content sync record' } },
      { status: 500 }
    );
  }
}
