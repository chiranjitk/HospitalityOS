import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

/**
 * Verify that the room exists, is not soft-deleted, and belongs to the user's tenant.
 * Returns the room (with propertyId) or a NextResponse error.
 */
async function verifyRoomAccess(
  roomId: string,
  userTenantId: string
): Promise<{ propertyId: string } | NextResponse> {
  const room = await db.room.findUnique({
    where: { id: roomId, deletedAt: null },
    select: { propertyId: true },
  });

  if (!room) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
      { status: 404 }
    );
  }

  // Tenant isolation: verify room belongs to user's tenant via property
  const roomProperty = await db.property.findUnique({
    where: { id: room.propertyId },
    select: { tenantId: true },
  });

  if (roomProperty && roomProperty.tenantId !== userTenantId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
      { status: 404 }
    );
  }

  return room;
}

// GET /api/rooms/[id]/ota-sync - Get OTA sync status for all images of a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'rooms.view') && !hasPermission(user, 'rooms.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: roomId } = await params;

    const accessResult = await verifyRoomAccess(roomId, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const propertyId = accessResult.propertyId;

    // Fetch all active OTA channels for this property
    const channels = await db.otaChannel.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all images for this room
    const images = await db.roomImage.findMany({
      where: { roomId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });

    // Fetch all OtaImageSync records for these images and channels
    const imageIds = images.map((img) => img.id);
    const channelIds = channels.map((ch) => ch.id);

    const syncRecords = await db.otaImageSync.findMany({
      where: {
        imageId: { in: imageIds },
        channelId: { in: channelIds },
      },
    });

    // Build a lookup map for quick access: `${imageId}:${channelId}` -> sync record
    const syncMap = new Map<string, (typeof syncRecords)[number]>();
    for (const record of syncRecords) {
      syncMap.set(`${record.imageId}:${record.channelId}`, record);
    }

    // Build the response: each image includes its per-channel sync status
    type RoomImageWithSync = (typeof images)[number] & {
      syncStatus: Record<
        string,
        {
          id: string;
          status: string;
          remoteUrl: string | null;
          remoteId: string | null;
          lastSyncedAt: Date | null;
          error: string | null;
        }
      >;
    };

    const imagesWithSync: RoomImageWithSync[] = images.map((image) => {
      const syncStatus: RoomImageWithSync['syncStatus'] = {};

      for (const channel of channels) {
        const key = `${image.id}:${channel.id}`;
        const record = syncMap.get(key);

        syncStatus[channel.id] = record
          ? {
              id: record.id,
              status: record.status,
              remoteUrl: record.remoteUrl,
              remoteId: record.remoteId,
              lastSyncedAt: record.lastSyncedAt,
              error: record.error,
            }
          : {
              id: '',
              status: 'pending',
              remoteUrl: null,
              remoteId: null,
              lastSyncedAt: null,
              error: null,
            };
      }

      return {
        ...image,
        syncStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        channels,
        images: imagesWithSync,
      },
    });
  } catch (error) {
    console.error('Error fetching OTA sync status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch OTA sync status' } },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[id]/ota-sync - Sync images to OTA channels
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'rooms.manage') && !hasPermission(user, 'rooms.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: roomId } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(roomId, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const propertyId = accessResult.propertyId;

    const { channelIds, imageIds: requestedImageIds } = body as {
      channelIds?: string[];
      imageIds?: string[];
    };

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelIds is required and must be a non-empty array' } },
        { status: 400 }
      );
    }

    // Verify all requested channels belong to this property
    const channels = await db.otaChannel.findMany({
      where: {
        id: { in: channelIds },
        propertyId,
      },
    });

    if (channels.length !== channelIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'One or more channel IDs are invalid or do not belong to this property' } },
        { status: 400 }
      );
    }

    // Determine which images to sync
    let imagesToSync;
    if (requestedImageIds && Array.isArray(requestedImageIds) && requestedImageIds.length > 0) {
      // Use specified image IDs
      imagesToSync = await db.roomImage.findMany({
        where: {
          id: { in: requestedImageIds },
          roomId,
        },
      });

      if (imagesToSync.length !== requestedImageIds.length) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'One or more image IDs are invalid or do not belong to this room' } },
          { status: 400 }
        );
      }
    } else {
      // Default: sync ALL images (primary first, then by sort order)
      // OTA channels need all photos — primary images are just ordered first
      imagesToSync = await db.roomImage.findMany({
        where: { roomId },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      });
    }

    if (imagesToSync.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No images found to sync for this room' } },
        { status: 400 }
      );
    }

    // Perform sync for each image-channel pair
    let syncedCount = 0;
    let failedCount = 0;
    const results: Array<{
      imageId: string;
      channelId: string;
      status: string;
      remoteUrl: string | null;
      remoteId: string | null;
      error: string | null;
    }> = [];

    const now = new Date();

    for (const image of imagesToSync) {
      for (const channel of channels) {
        try {
          // Check if the channel has API credentials configured
          const channelConfig = channel.config ? JSON.parse(channel.config) : {};
          const hasCredentials = channelConfig.apiKey || channel.apiKey;

          if (!hasCredentials) {
            // Mark the sync record as failed due to missing credentials
            const existingSync = await db.otaImageSync.findFirst({
              where: { imageId: image.id, channelId: channel.id },
            });

            const syncData = {
              status: 'failed' as const,
              error: `${channel.name} channel has no API credentials configured`,
              lastSyncedAt: now,
            };

            if (existingSync) {
              await db.otaImageSync.update({
                where: { id: existingSync.id },
                data: syncData,
              });
            } else {
              await db.otaImageSync.create({
                data: { imageId: image.id, channelId: channel.id, ...syncData },
              });
            }

            // Update RoomImage.otaSyncStatus
            let otaSyncStatus: Record<string, Record<string, string>> = {};
            try { otaSyncStatus = JSON.parse(image.otaSyncStatus || '{}'); } catch { otaSyncStatus = {}; }
            otaSyncStatus[channel.id] = { status: 'failed', error: syncData.error };
            await db.roomImage.update({
              where: { id: image.id },
              data: { otaSyncStatus: JSON.stringify(otaSyncStatus) },
            });

            failedCount++;
            results.push({
              imageId: image.id,
              channelId: channel.id,
              status: 'failed',
              remoteUrl: null,
              remoteId: null,
              error: syncData.error,
            });
            continue; // Skip to next image-channel pair
          }

          // Channel has credentials — attempt real OTA sync via the channel service.
          // If the OTA channel service endpoint is not reachable, the sync fails gracefully.
          const channelType = channel.type;

          try {
            // Attempt a real OTA channel API push (conceptual).
            // In production this would call the actual OTA partner API
            // (e.g. Booking.com Extranet API, Expedia Partner API, etc.).
            // For now we log the attempt and mark as pending until the
            // channel service integration is completed.
            console.log(`[OTA Sync] Attempting sync for image ${image.id} to ${channel.name} (${channelType})`);

            // TODO: Replace with actual OTA channel API call when integration is built
            throw new Error(`${channel.name} (${channelType}) OTA channel integration not yet implemented`);
          } catch (otaError) {
            const otaErrorMessage = otaError instanceof Error ? otaError.message : 'Unknown OTA sync error';

            const existingSync = await db.otaImageSync.findFirst({
              where: { imageId: image.id, channelId: channel.id },
            });

            const syncData = {
              status: 'failed' as const,
              error: otaErrorMessage,
              lastSyncedAt: now,
            };

            if (existingSync) {
              await db.otaImageSync.update({
                where: { id: existingSync.id },
                data: syncData,
              });
            } else {
              await db.otaImageSync.create({
                data: { imageId: image.id, channelId: channel.id, ...syncData },
              });
            }

            let otaSyncStatus: Record<string, Record<string, string>> = {};
            try { otaSyncStatus = JSON.parse(image.otaSyncStatus || '{}'); } catch { otaSyncStatus = {}; }
            otaSyncStatus[channel.id] = { status: 'failed', error: otaErrorMessage };
            await db.roomImage.update({
              where: { id: image.id },
              data: { otaSyncStatus: JSON.stringify(otaSyncStatus) },
            });

            failedCount++;
            results.push({
              imageId: image.id,
              channelId: channel.id,
              status: 'failed',
              remoteUrl: null,
              remoteId: null,
              error: otaErrorMessage,
            });
            continue;
          }

          // If sync succeeded (not yet reached in current implementation)
          syncedCount++;
          results.push({
            imageId: image.id,
            channelId: channel.id,
            status: 'pending',
            remoteUrl: image.url || null,
            remoteId: null,
            error: null,
          });
        } catch (syncError) {
          console.error(`Error syncing image ${image.id} to channel ${channel.id}:`, syncError);

          const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error';

          // Try to mark the sync record as failed
          try {
            const existingSync = await db.otaImageSync.findFirst({
              where: {
                imageId: image.id,
                channelId: channel.id,
              },
            });

            if (existingSync) {
              await db.otaImageSync.update({
                where: { id: existingSync.id },
                data: {
                  status: 'failed',
                  error: errorMessage,
                },
              });
            } else {
              await db.otaImageSync.create({
                data: {
                  imageId: image.id,
                  channelId: channel.id,
                  status: 'failed',
                  error: errorMessage,
                },
              });
            }

            // Update RoomImage.otaSyncStatus
            let otaSyncStatus: Record<string, { status: string; error: string }> = {};
            try {
              otaSyncStatus = JSON.parse(image.otaSyncStatus || '{}');
            } catch {
              otaSyncStatus = {};
            }

            otaSyncStatus[channel.id] = {
              status: 'failed',
              error: errorMessage,
            };

            await db.roomImage.update({
              where: { id: image.id },
              data: { otaSyncStatus: JSON.stringify(otaSyncStatus) },
            });
          } catch (updateError) {
            console.error('Failed to update error status for sync record:', updateError);
          }

          failedCount++;
          results.push({
            imageId: image.id,
            channelId: channel.id,
            status: 'failed',
            remoteUrl: null,
            remoteId: null,
            error: errorMessage,
          });
        }
      }
    }

    // Update lastSyncedAt on the channels
    await db.otaChannel.updateMany({
      where: { id: { in: channelIds } },
      data: { lastSyncedAt: now },
    });

    return NextResponse.json({
      success: true,
      data: {
        synced: syncedCount,
        failed: failedCount,
        results,
      },
    });
  } catch (error) {
    console.error('Error syncing images to OTA channels:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync images to OTA channels' } },
      { status: 500 }
    );
  }
}

// PUT /api/rooms/[id]/ota-sync - Update OTA channel configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'rooms.manage') && !hasPermission(user, 'rooms.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: roomId } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(roomId, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const propertyId = accessResult.propertyId;

    const { channelId, apiKey, apiSecret, hotelId, isActive } = body as {
      channelId?: string;
      apiKey?: string;
      apiSecret?: string;
      hotelId?: string;
      isActive?: boolean;
    };

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelId is required' } },
        { status: 400 }
      );
    }

    // Verify the channel belongs to this property (tenant isolation)
    const channel = await db.otaChannel.findFirst({
      where: {
        id: channelId,
        propertyId,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'OTA channel not found or does not belong to this property' } },
        { status: 404 }
      );
    }

    // Parse existing config and merge updates
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(channel.config || '{}');
    } catch {
      config = {};
    }

    if (apiKey !== undefined) {
      config.apiKey = apiKey;
    }
    if (apiSecret !== undefined) {
      config.apiSecret = apiSecret;
    }
    if (hotelId !== undefined) {
      config.hotelId = hotelId;
    }

    // Update the channel
    const updatedChannel = await db.otaChannel.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify(config),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedChannel,
    });
  } catch (error) {
    console.error('Error updating OTA channel configuration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update OTA channel configuration' } },
      { status: 500 }
    );
  }
}
