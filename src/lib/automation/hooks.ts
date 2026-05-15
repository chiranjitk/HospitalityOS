/**
 * Automation Hooks — Convenience functions for wiring events into existing API routes.
 *
 * Import these from your route handlers and call them when the corresponding
 * event occurs. They are fire-and-forget — they emit the event asynchronously
 * without blocking the API response.
 *
 * @example
 * ```ts
 * import { onBookingCreated } from '@/lib/automation/hooks';
 *
 * // After creating a booking in your POST handler:
 * onBookingCreated(booking, booking.tenantId);
 * ```
 *
 * The event names are aligned with the trigger events defined in the
 * automation rules UI and the `AutomationRule.triggerEvent` values.
 */

import { emitEvent } from './event-bus';

// ── Booking Events ──

/**
 * Emit a `booking.created` event.
 * Call after a new booking is successfully created.
 *
 * @param booking - The booking record (or at minimum { id, propertyId, ... })
 * @param tenantId - The tenant that owns this booking
 */
export function onBookingCreated(
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('booking.created', tenantId, { booking });
}

/**
 * Emit a `booking.confirmed` event.
 * Call after a booking status changes to confirmed.
 */
export function onBookingConfirmed(
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('booking.confirmed', tenantId, { booking });
}

/**
 * Emit a `booking.cancelled` event.
 * Call after a booking is cancelled.
 */
export function onBookingCancelled(
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('booking.cancelled', tenantId, { booking });
}

/**
 * Emit a `booking.modified` event.
 * Call after a booking is updated (e.g., dates, rooms, guests changed).
 */
export function onBookingModified(
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('booking.modified', tenantId, { booking });
}

// ── Guest Events ──

/**
 * Emit a `guest.checked_in` event.
 * Call after a guest checks in.
 *
 * @param guest - The guest record
 * @param booking - The associated booking record
 * @param tenantId - The tenant ID
 */
export function onGuestCheckIn(
  guest: Record<string, unknown>,
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('guest.check_in', tenantId, { guest, booking });
}

/**
 * Emit a `guest.checked_out` event.
 * Call after a guest checks out.
 */
export function onGuestCheckOut(
  guest: Record<string, unknown>,
  booking: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('guest.check_out', tenantId, { guest, booking });
}

/**
 * Emit a `guest.created` event.
 * Call after a new guest profile is created.
 */
export function onGuestCreated(
  guest: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('guest.created', tenantId, { guest });
}

/**
 * Emit a `guest.birthday` event.
 * Call when it's a guest's birthday (typically from a scheduled job).
 */
export function onGuestBirthday(
  guest: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('guest.birthday', tenantId, { guest });
}

// ── Payment Events ──

/**
 * Emit a `payment.received` event.
 * Call after a payment is successfully processed.
 */
export function onPaymentReceived(
  payment: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('payment.received', tenantId, { payment });
}

/**
 * Emit a `payment.failed` event.
 * Call when a payment attempt fails.
 */
export function onPaymentFailed(
  payment: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('payment.failed', tenantId, { payment });
}

// ── Feedback & Review Events ──

/**
 * Emit a `feedback.received` event.
 * Call when a guest submits feedback.
 */
export function onFeedbackReceived(
  feedback: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('feedback.received', tenantId, { feedback });
}

/**
 * Emit a `review.submitted` event.
 * Call when a guest submits a review.
 */
export function onReviewSubmitted(
  review: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('review.submitted', tenantId, { review });
}

// ── Loyalty Events ──

/**
 * Emit a `loyalty.tier_upgraded` event.
 * Call when a guest's loyalty tier increases.
 */
export function onLoyaltyTierUpgraded(
  guest: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('loyalty.tier_upgraded', tenantId, { guest });
}

// ── Task Events ──

/**
 * Emit a `task.completed` event.
 * Call when a task is marked as completed.
 */
export function onTaskCompleted(
  task: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('task.completed', tenantId, { task });
}

/**
 * Emit a `task.overdue` event.
 * Call when a task becomes overdue (typically from a scheduled job).
 */
export function onTaskOverdue(
  task: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('task.overdue', tenantId, { task });
}

// ── Room Events ──

/**
 * Emit a `room.status_changed` event.
 * Call when a room's status changes (e.g., dirty → clean, occupied → vacant).
 */
export function onRoomStatusChanged(
  room: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('room.status_changed', tenantId, { room });
}

// ── WiFi Events ──

/**
 * Emit a `wifi.session_started` event.
 * Call when a guest starts a WiFi session.
 */
export function onWifiSessionStarted(
  session: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('wifi.session_started', tenantId, { session });
}

// ── Service Request Events ──

/**
 * Emit a `service_request.created` event.
 * Call when a guest creates a service request (room service, maintenance, etc.).
 */
export function onServiceRequestCreated(
  request: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent('service_request.created', tenantId, { request });
}

// ── Generic Event Emitter ──

/**
 * Emit a custom event with any name.
 * Use for events not covered by the predefined hooks.
 *
 * @param event - The event name (will be used as `triggerEvent` in rule matching)
 * @param payload - The event data
 * @param tenantId - The tenant ID
 */
export function onCustomEvent(
  event: string,
  payload: Record<string, unknown>,
  tenantId: string,
): void {
  emitEvent(event, tenantId, payload);
}
