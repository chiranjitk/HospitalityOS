import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// Default parking rates (can be overridden per request or via tenant settings)
const DEFAULT_HOURLY_RATE = 50;
const DEFAULT_DAILY_MAX_RATE = 500;

// Helper function to calculate parking fee
function calculateParkingFee(
  entryTime: Date,
  exitTime: Date,
  hourlyRate: number = DEFAULT_HOURLY_RATE,
  dailyMaxRate: number = DEFAULT_DAILY_MAX_RATE
): number {
  const durationMs = exitTime.getTime() - entryTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = Math.ceil(durationHours / 24);

  // If parked for less than a day, calculate hourly
  if (durationHours <= 24) {
    const fee = Math.ceil(durationHours) * hourlyRate;
    return Math.min(fee, dailyMaxRate); // Cap at daily max
  }

  // For multi-day parking, charge daily max per day
  return durationDays * dailyMaxRate;
}

// Helper to format duration
function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(' ');
}

// GET /api/parking/billing - Get parking billing records
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.view', 'parking.manage', 'billing.view', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const vehicleId = searchParams.get('vehicleId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status'); // paid, unpaid
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit to prevent memory issues
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = { tenantId };

    if (vehicleId) {
      where.id = vehicleId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (status === 'paid') {
      where.isPaid = true;
    } else if (status === 'unpaid') {
      where.isPaid = false;
    }

    if (startDate || endDate) {
      where.entryTime = {};
      if (startDate) {
        (where.entryTime as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.entryTime as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const vehicles = await db.vehicle.findMany({
      where,
      include: {
        slot: {
          select: {
            id: true,
            number: true,
            floor: true,
            type: true,
          },
        },
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { entryTime: 'desc' },
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.vehicle.count({ where });

    // Calculate billing summary
    const totalFees = vehicles.reduce((sum, v) => sum + (v.parkingFee || 0), 0);
    const paidFees = vehicles.filter(v => v.isPaid).reduce((sum, v) => sum + (v.parkingFee || 0), 0);
    const unpaidFees = vehicles.filter(v => !v.isPaid).reduce((sum, v) => sum + (v.parkingFee || 0), 0);

    // Get payment status breakdown
    const paidCount = vehicles.filter(v => v.isPaid).length;
    const unpaidCount = vehicles.filter(v => !v.isPaid).length;

    // Calculate duration for each vehicle
    const billingRecords = vehicles.map(vehicle => {
      let duration = 0;
      let calculatedFee = vehicle.parkingFee;

      if (vehicle.entryTime) {
        const endTime = vehicle.exitTime || new Date();
        duration = Math.round((endTime.getTime() - new Date(vehicle.entryTime).getTime()) / (1000 * 60)); // minutes

        // Recalculate fee if vehicle is still parked or fee wasn't set
        if (!vehicle.exitTime || !vehicle.parkingFee) {
          calculatedFee = calculateParkingFee(new Date(vehicle.entryTime), endTime);
        }
      }

      return {
        ...vehicle,
        durationMinutes: duration,
        durationFormatted: formatDuration(duration),
        calculatedFee,
      };
    });

    return NextResponse.json({
      success: true,
      data: billingRecords,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalVehicles: total,
        paidCount,
        unpaidCount,
        totalFees,
        paidFees,
        unpaidFees,
      },
    });
  } catch (error) {
    console.error('Error fetching parking billing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch parking billing' } },
      { status: 500 }
    );
  }
}

// POST /api/parking/billing - Create parking billing record (check-in vehicle)
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.manage', 'billing.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();
    const {
      guestId,
      bookingId,
      licensePlate,
      make,
      model,
      color,
      year,
      slotId,
      hourlyRate = DEFAULT_HOURLY_RATE,
      dailyMaxRate = DEFAULT_DAILY_MAX_RATE,
    } = body;

    // Validate required fields
    if (!licensePlate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'License plate is required' } },
        { status: 400 }
      );
    }

    // Validate license plate format (basic check)
    if (typeof licensePlate !== 'string' || licensePlate.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid license plate format' } },
        { status: 400 }
      );
    }

    // Validate rates
    if (hourlyRate !== undefined && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Hourly rate must be a non-negative number' } },
        { status: 400 }
      );
    }

    if (dailyMaxRate !== undefined && (typeof dailyMaxRate !== 'number' || dailyMaxRate < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Daily max rate must be a non-negative number' } },
        { status: 400 }
      );
    }

    // Validate year if provided
    if (year !== undefined && year !== null) {
      const yearNum = parseInt(year, 10);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid vehicle year' } },
          { status: 400 }
        );
      }
    }

    // Validate guest belongs to same tenant if provided
    if (guestId) {
      const guest = await db.guest.findFirst({
        where: { id: guestId, tenantId },
      });
      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GUEST', message: 'Guest not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Validate booking belongs to same tenant if provided
    if (bookingId) {
      const booking = await db.booking.findFirst({
        where: { id: bookingId, tenantId },
      });
      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_BOOKING', message: 'Booking not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Check if vehicle already exists and is parked
    const existingVehicle = await db.vehicle.findFirst({
      where: {
        tenantId,
        licensePlate: licensePlate.toUpperCase().trim(),
        status: 'parked',
      },
    });

    if (existingVehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'VEHICLE_PARKED', message: 'Vehicle is already parked' } },
        { status: 400 }
      );
    }

    // If slot is specified, check availability
    if (slotId) {
      const slot = await db.parkingSlot.findFirst({
        where: { id: slotId, tenantId },
      });

      if (!slot) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Parking slot not found' } },
          { status: 404 }
        );
      }

      if (slot.status !== 'available') {
        return NextResponse.json(
          { success: false, error: { code: 'SLOT_UNAVAILABLE', message: 'Parking slot is not available' } },
          { status: 400 }
        );
      }
    }

    const vehicle = await db.vehicle.create({
      data: {
        tenantId,
        guestId,
        bookingId,
        licensePlate: licensePlate.toUpperCase().trim(),
        make,
        model,
        color,
        year: year ? parseInt(year, 10) : null,
        slotId,
        entryTime: new Date(),
        parkingFee: 0,
        isPaid: false,
        status: 'parked',
      },
      include: {
        slot: true,
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update slot status if assigned
    if (slotId) {
      await db.parkingSlot.update({
        where: { id: slotId },
        data: { status: 'occupied' },
      });
    }

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'check_in',
          entityType: 'vehicle',
          entityId: vehicle.id,
          newValue: JSON.stringify({
            licensePlate: vehicle.licensePlate,
            slotId: vehicle.slotId,
            guestId: vehicle.guestId,
            hourlyRate,
            dailyMaxRate,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      data: {
        ...vehicle,
        hourlyRate,
        dailyMaxRate,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating parking billing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create parking billing' } },
      { status: 500 }
    );
  }
}

// PUT /api/parking/billing - Update parking billing (checkout, mark paid, etc.)
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.manage', 'billing.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();
    const {
      id,
      action, // 'checkout', 'pay', 'update'
      slotId,
      hourlyRate = DEFAULT_HOURLY_RATE,
      dailyMaxRate = DEFAULT_DAILY_MAX_RATE,
      paymentMethod,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vehicle ID is required' } },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['checkout', 'pay', 'update'];
    if (action && !validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
        { status: 400 }
      );
    }

    const vehicle = await db.vehicle.findFirst({
      where: { id, tenantId },
      include: { slot: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    if (action === 'checkout') {
      // Calculate final fee
      const exitTime = new Date();
      const entryTime = vehicle.entryTime ? new Date(vehicle.entryTime) : exitTime;
      const calculatedFee = calculateParkingFee(entryTime, exitTime, hourlyRate, dailyMaxRate);

      updateData = {
        exitTime,
        parkingFee: calculatedFee,
        status: 'exited',
      };

      // Post parking fees to booking folio if vehicle is linked to a booking
      // Wrap vehicle update + slot update + folio posting in a single transaction
      if (vehicle.bookingId && calculatedFee > 0) {
        try {
          await db.$transaction(async (tx) => {
            // Update vehicle status
            await tx.vehicle.update({
              where: { id },
              data: updateData,
            });

            // Free up the parking slot
            if (vehicle.slotId) {
              await tx.parkingSlot.update({
                where: { id: vehicle.slotId },
                data: { status: 'available' },
              });
            }

            const folio = await tx.folio.findFirst({
              where: {
                bookingId: vehicle.bookingId,
                status: { in: ['open', 'partially_paid'] },
                tenantId,
              },
            });

            if (!folio) {
              console.log(`[Parking] No open folio found for booking ${vehicle.bookingId}, skipping auto-post.`);
              return;
            }

            // Calculate tax from property tax settings
            let taxRate = 0;
            const prop = await tx.property.findFirst({
              where: { id: folio.propertyId },
              select: { defaultTaxRate: true, taxComponents: true },
            });
            if (prop) {
              try {
                const tc = JSON.parse(prop.taxComponents || '[]');
                if (Array.isArray(tc) && tc.length > 0) {
                  taxRate = tc.reduce((sum: number, c: { rate: number }) => sum + (c.rate || 0), 0) / 100;
                } else {
                  taxRate = (prop.defaultTaxRate || 0) / 100;
                }
              } catch { taxRate = (prop.defaultTaxRate || 0) / 100; }
            }
            const taxAmount = Math.round(calculatedFee * taxRate * 100) / 100;

            // Create folio line item with correct category 'parking'
            await tx.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: `Parking fee - ${vehicle.licensePlate}${vehicle.slotId ? ` (Slot ${vehicle.slotId})` : ''}`,
                category: 'parking',
                quantity: 1,
                unitPrice: calculatedFee,
                totalAmount: calculatedFee,
                taxRate: taxRate * 100,
                taxAmount,
                serviceDate: new Date(),
                referenceType: 'parking_checkout',
                referenceId: id,
                postedBy: currentUser.id,
              },
            });

            // Recalculate folio totals from ALL line items (consistent pattern)
            const allLineItems = await tx.folioLineItem.findMany({
              where: { folioId: folio.id },
              select: { totalAmount: true, taxAmount: true },
            });
            const newSubtotal = allLineItems.reduce((s, li) => s + li.totalAmount, 0);
            const newTaxes = allLineItems.reduce((s, li) => s + (li.taxAmount || 0), 0);
            const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

            await tx.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance: newTotal - (folio.paidAmount || 0),
              },
            });

            console.log(`[Parking] Posted parking fee of ${calculatedFee} (tax: ${taxAmount}) to folio ${folio.id} for vehicle ${id}`);
          });
        } catch (folioError) {
          console.error('Failed to post parking fees to folio:', folioError);
          // Don't fail the checkout if folio posting fails — update vehicle separately
          await db.vehicle.update({ where: { id }, data: updateData });
        }
      } else {
        // No booking linked — just update vehicle and free slot
        await db.vehicle.update({ where: { id }, data: updateData });

        // Free up the parking slot
        if (vehicle.slotId) {
          await db.parkingSlot.update({
            where: { id: vehicle.slotId },
            data: { status: 'available' },
          });
        }
      }
    } else if (action === 'pay') {
      if (!paymentMethod) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment method is required' } },
          { status: 400 }
        );
      }

      // Validate payment method
      const validPaymentMethods = ['cash', 'card', 'folio', 'wallet', 'other'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}` } },
          { status: 400 }
        );
      }

      // Calculate fee if not already set
      let fee = vehicle.parkingFee;
      if (!fee && vehicle.entryTime) {
        const exitTime = vehicle.exitTime || new Date();
        fee = calculateParkingFee(new Date(vehicle.entryTime), exitTime, hourlyRate, dailyMaxRate);
      }

      updateData = {
        isPaid: true,
        parkingFee: fee,
      };

      // Create audit log for payment
      try {
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'parking',
            action: 'payment',
            entityType: 'vehicle',
            entityId: id,
            newValue: JSON.stringify({
              parkingFee: fee,
              paymentMethod,
            }),
          },
        });
      } catch {
        // Ignore audit log errors
      }
    } else if (action === 'update') {
      // General update
      if (slotId !== undefined) updateData.slotId = slotId;
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action. Use: checkout, pay, or update' } },
        { status: 400 }
      );
    }

    const updatedVehicle = await db.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        slot: true,
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedVehicle });
  } catch (error) {
    console.error('Error updating parking billing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update parking billing' } },
      { status: 500 }
    );
  }
}

// DELETE /api/parking/billing - Delete parking billing record
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - requires manage permission
    if (!hasAnyPermission(currentUser, ['parking.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vehicle ID is required' } },
        { status: 400 }
      );
    }

    const vehicle = await db.vehicle.findFirst({
      where: { id, tenantId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } },
        { status: 404 }
      );
    }

    // Status guard: Cannot delete a vehicle record that has already been paid
    if (vehicle.isPaid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Cannot delete a vehicle record that has already been paid. Create a credit adjustment instead.' } },
        { status: 400 }
      );
    }

    // If vehicle has a bookingId with a fee, attempt to reverse any posted folio line items
    if (vehicle.bookingId && vehicle.parkingFee && vehicle.parkingFee > 0) {
      try {
        await db.$transaction(async (tx) => {
          const folio = await tx.folio.findFirst({
            where: {
              bookingId: vehicle.bookingId,
              status: { in: ['open', 'partially_paid'] },
              tenantId,
            },
          });

          if (folio) {
            // Check if there's a posted line item for this vehicle
            const existingLineItem = await tx.folioLineItem.findFirst({
              where: {
                folioId: folio.id,
                referenceType: 'parking_checkout',
                referenceId: vehicle.id,
              },
            });

            if (existingLineItem) {
              // Create a negative adjustment to reverse the charge
              await tx.folioLineItem.create({
                data: {
                  folioId: folio.id,
                  description: `Cancellation - Parking fee (${vehicle.licensePlate})`,
                  category: 'parking',
                  quantity: 1,
                  unitPrice: -existingLineItem.totalAmount,
                  totalAmount: -existingLineItem.totalAmount,
                  taxRate: existingLineItem.taxRate,
                  taxAmount: -(existingLineItem.taxAmount || 0),
                  serviceDate: new Date(),
                  referenceType: 'parking_cancellation',
                  referenceId: vehicle.id,
                  postedBy: currentUser.id,
                },
              });

              // Recalculate folio totals from ALL line items (consistent pattern)
              const allLineItems = await tx.folioLineItem.findMany({
                where: { folioId: folio.id },
                select: { totalAmount: true, taxAmount: true },
              });
              const newSubtotal = allLineItems.reduce((s, li) => s + li.totalAmount, 0);
              const newTaxes = allLineItems.reduce((s, li) => s + (li.taxAmount || 0), 0);
              const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

              await tx.folio.update({
                where: { id: folio.id },
                data: {
                  subtotal: newSubtotal,
                  taxes: newTaxes,
                  totalAmount: newTotal,
                  balance: newTotal - (folio.paidAmount || 0),
                },
              });

              console.log(`[Parking DELETE] Reversed parking fee on folio ${folio.id} for vehicle ${id}`);
            }
          }
        });
      } catch (folioError) {
        console.error('[Parking DELETE] Folio reversal failed:', folioError);
        // Continue with delete even if folio reversal fails
      }
    }

    // Free up the slot if vehicle is parked
    if (vehicle.slotId && vehicle.status === 'parked') {
      await db.parkingSlot.update({
        where: { id: vehicle.slotId },
        data: { status: 'available' },
      });
    }

    await db.vehicle.delete({
      where: { id },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'delete',
          entityType: 'vehicle',
          entityId: id,
          oldValue: JSON.stringify(vehicle),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, message: 'Parking billing record deleted' });
  } catch (error) {
    console.error('Error deleting parking billing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete parking billing' } },
      { status: 500 }
    );
  }
}
