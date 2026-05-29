import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Default heartbeat timeout in minutes — cameras that haven't pinged within this
// window will be marked as offline automatically.
const HEARTBEAT_TIMEOUT_MINUTES = 5;

// GET /api/security/cameras/heartbeat?cameraId=X — Camera heartbeat endpoint
// Cameras ping this to confirm they are alive. The server updates the camera
// status to 'online' and records a heartbeat event for audit trail.
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'security.update') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const cameraId = searchParams.get('cameraId');

    if (!cameraId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'cameraId is required' } },
        { status: 400 },
      );
    }

    // Verify camera belongs to tenant
    const camera = await db.camera.findFirst({
      where: { id: cameraId },
      include: { property: { select: { tenantId: true } } },
    });

    if (!camera || camera.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Camera not found' } },
        { status: 404 },
      );
    }

    // Update camera status to online
    const updatedCamera = await db.camera.update({
      where: { id: cameraId },
      data: { status: 'online' },
    });

    // Create a heartbeat event for audit trail
    await db.cameraEvent.create({
      data: {
        tenantId: user.tenantId,
        cameraId: camera.id,
        type: 'heartbeat',
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        cameraId: updatedCamera.id,
        status: updatedCamera.status,
        heartbeatAt: new Date().toISOString(),
        message: 'Heartbeat received',
      },
    });
  } catch (error) {
    console.error('Error processing camera heartbeat:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process heartbeat' } },
      { status: 500 },
    );
  }
}

// POST /api/security/cameras/heartbeat — Batch heartbeat for multiple cameras
// Accepts { cameraIds: string[], propertyId?: string } and marks stale cameras offline.
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'security.update') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { cameraIds, propertyId } = body as {
      cameraIds?: string[];
      propertyId?: string;
    };

    if (!cameraIds || !Array.isArray(cameraIds) || cameraIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'cameraIds array is required' } },
        { status: 400 },
      );
    }

    if (cameraIds.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 cameras per heartbeat batch' } },
        { status: 400 },
      );
    }

    // Verify all cameras belong to tenant
    const cameras = await db.camera.findMany({
      where: { id: { in: cameraIds } },
      include: { property: { select: { tenantId: true } } },
    });

    const validCameraIds = cameras
      .filter(c => c.property.tenantId === user.tenantId)
      .map(c => c.id);

    // Batch update all valid cameras to online
    const result = await db.camera.updateMany({
      where: { id: { in: validCameraIds } },
      data: { status: 'online' },
    });

    // Mark stale cameras as offline (cameras not in the heartbeat batch
    // that haven't pinged within the timeout window)
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000);
    const staleResult = await db.camera.updateMany({
      where: {
        id: { notIn: validCameraIds },
        propertyId: propertyId || undefined,
        status: 'online',
        updatedAt: { lt: cutoff },
        property: { tenantId: user.tenantId },
      },
      data: { status: 'offline' },
    });

    return NextResponse.json({
      success: true,
      data: {
        updated: result.count,
        staleMarkedOffline: staleResult.count,
        processedIds: validCameraIds,
        message: `Heartbeat processed for ${validCameraIds.length} cameras`,
      },
    });
  } catch (error) {
    console.error('Error processing batch camera heartbeat:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process heartbeat' } },
      { status: 500 },
    );
  }
}
