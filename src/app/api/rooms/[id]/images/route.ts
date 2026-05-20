export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || /*turbopackIgnore: true*/ path.join(process.cwd(), 'upload');

/**
 * Sync the Room.images JSON field for backward compatibility.
 * Collects all image URLs for a room (primary first, then by sortOrder)
 * and writes them as a JSON string array to Room.images.
 */
async function syncRoomImagesJson(roomId: string) {
  const images = await db.roomImage.findMany({
    where: { roomId },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: { url: true },
  });
  await db.room.update({
    where: { id: roomId },
    data: { images: JSON.stringify(images.map((i) => i.url)) },
  });
}

/**
 * Verify that the room exists and belongs to the user's tenant.
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

/**
 * Delete a file from disk using the same logic as /api/upload DELETE.
 * Silently ignores failures (file may not exist on disk if stored externally).
 */
function deleteFileFromDisk(fileUrl: string) {
  try {
    if (!fileUrl.startsWith('/api/files/')) {
      return; // Not a locally stored file
    }

    const relativePath = fileUrl.replace('/api/files/', '');
    const parts = relativePath.split('/');

    // Validate: must be exactly folder/filename with no traversal
    if (parts.length !== 2 || parts.some((p) => p.includes('..') || p.length === 0)) {
      return;
    }

    const filePath = path.join(UPLOAD_DIR, relativePath);
    const resolvedFilePath = path.resolve(filePath);

    // Security: ensure resolved path is within UPLOAD_DIR
    const normalizedUploadDir = path.resolve(UPLOAD_DIR);
    if (
      !resolvedFilePath.startsWith(normalizedUploadDir + path.sep) &&
      resolvedFilePath !== normalizedUploadDir
    ) {
      return;
    }

    if (fs.existsSync(resolvedFilePath)) {
      const stat = fs.statSync(resolvedFilePath);
      if (stat.isFile()) {
        fs.unlinkSync(resolvedFilePath);
      }
    }
  } catch (error) {
    console.error('Failed to delete file from disk:', error);
    // Non-blocking — don't fail the request if file cleanup fails
  }
}

// GET /api/rooms/[id]/images - List all images for a room
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

    const { id } = await params;

    const accessResult = await verifyRoomAccess(id, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const images = await db.roomImage.findMany({
      where: { roomId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: images });
  } catch (error) {
    console.error('Error fetching room images:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room images' } },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[id]/images - Add a new image record
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

    const { id } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(id, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { url, thumbnailUrl, caption, category, isPrimary, sortOrder, width, height, fileSize, mimeType } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'url is required' } },
        { status: 400 }
      );
    }

    // If isPrimary is true, unset isPrimary on all other images for this room
    if (isPrimary) {
      await db.roomImage.updateMany({
        where: { roomId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const image = await db.roomImage.create({
      data: {
        roomId: id,
        url,
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(caption !== undefined && { caption }),
        ...(category !== undefined && { category }),
        ...(isPrimary !== undefined && { isPrimary }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(fileSize !== undefined && { fileSize }),
        ...(mimeType !== undefined && { mimeType }),
      },
    });

    // Sync Room.images JSON field for backward compatibility
    await syncRoomImagesJson(id);

    return NextResponse.json({ success: true, data: image }, { status: 201 });
  } catch (error) {
    console.error('Error adding room image:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add room image' } },
      { status: 500 }
    );
  }
}

// PUT /api/rooms/[id]/images - Bulk update image metadata
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

    const { id } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(id, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'images array is required and must not be empty' } },
        { status: 400 }
      );
    }

    // Check if any image is being set as primary
    const hasNewPrimary = images.some((img: { isPrimary?: boolean }) => img.isPrimary === true);

    // If a new primary is being set, unset all existing primaries first
    if (hasNewPrimary) {
      await db.roomImage.updateMany({
        where: { roomId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Update each image in the bulk request
    const updatedImages = await db.$transaction(
      images.map((img: { id: string; caption?: string; category?: string; isPrimary?: boolean; sortOrder?: number }) => {
        const { id: imageId, caption, category, isPrimary, sortOrder } = img;

        if (!imageId) {
          throw new Error('Each image must have an id');
        }

        return db.roomImage.update({
          where: { id: imageId, roomId: id },
          data: {
            ...(caption !== undefined && { caption }),
            ...(category !== undefined && { category }),
            ...(isPrimary !== undefined && { isPrimary }),
            ...(sortOrder !== undefined && { sortOrder }),
          },
        });
      })
    );

    // Sync Room.images JSON field for backward compatibility
    await syncRoomImagesJson(id);

    return NextResponse.json({ success: true, data: updatedImages });
  } catch (error) {
    console.error('Error bulk updating room images:', error);

    // Handle Prisma record not found (image id doesn't belong to this room)
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'One or more images not found for this room' } },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'Each image must have an id') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to bulk update room images' } },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[id]/images - Update a single image
export async function PATCH(
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

    const { id } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(id, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { imageId, caption, category, isPrimary, sortOrder } = body;

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'imageId is required' } },
        { status: 400 }
      );
    }

    // If setting as primary, unset all other primaries for this room
    if (isPrimary) {
      await db.roomImage.updateMany({
        where: { roomId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updatedImage = await db.roomImage.update({
      where: { id: imageId, roomId: id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(category !== undefined && { category }),
        ...(isPrimary !== undefined && { isPrimary }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    // Sync Room.images JSON field for backward compatibility
    await syncRoomImagesJson(id);

    return NextResponse.json({ success: true, data: updatedImage });
  } catch (error) {
    console.error('Error updating room image:', error);

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Image not found for this room' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update room image' } },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[id]/images - Delete an image
export async function DELETE(
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

    const { id } = await params;
    const body = await request.json();

    const accessResult = await verifyRoomAccess(id, user.tenantId);
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'imageId is required' } },
        { status: 400 }
      );
    }

    // Find the image to get its URL for file deletion
    const image = await db.roomImage.findUnique({
      where: { id: imageId, roomId: id },
    });

    if (!image) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Image not found for this room' } },
        { status: 404 }
      );
    }

    // Delete the image record from the database
    await db.roomImage.delete({
      where: { id: imageId },
    });

    // Delete the file from disk (non-blocking)
    deleteFileFromDisk(image.url);

    // Also attempt to delete the thumbnail if it exists
    if (image.thumbnailUrl) {
      deleteFileFromDisk(image.thumbnailUrl);
    }

    // Sync Room.images JSON field for backward compatibility
    await syncRoomImagesJson(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting room image:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete room image' } },
      { status: 500 }
    );
  }
}
