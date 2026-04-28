// StaySuite Notification Trigger Utility — server-side, fire-and-forget.
// Constructs NotificationData payloads and fires via notificationService.send()
// without awaiting. Errors are caught/logged so callers are never blocked.
import { notificationService, NotificationData } from '@/lib/services/notification-service';

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatDateRange = (ci: string | Date, co: string | Date) => `${fmtDate(ci)} – ${fmtDate(co)}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Fire-and-forget: never blocks caller, never throws. */
function fire(data: NotificationData): void {
  notificationService.send(data).catch(err =>
    console.error('[Notify] Failed to send notification:', err)
  );
}

// -- Booking ---------------------------------------------------------------

export function notifyBookingCreated(p: {
  tenantId: string; userId: string; bookingId: string; confirmationCode: string;
  guestName: string; checkIn: string | Date; checkOut: string | Date;
  totalAmount: number | string; currency: string; propertyId?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'booking', category: 'info',
    title: `New Booking ${p.confirmationCode}`,
    message: `${p.guestName} booked for ${formatDateRange(p.checkIn, p.checkOut)} • ${p.currency}${p.totalAmount}`,
    link: '/#bookings', icon: 'CalendarCheck', actionType: 'view_booking',
    data: { bookingId: p.bookingId, confirmationCode: p.confirmationCode, propertyId: p.propertyId },
  });
}

export function notifyBookingConfirmed(p: {
  tenantId: string; userId: string; confirmationCode: string; guestName: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'booking', category: 'success',
    title: 'Booking Confirmed',
    message: `${p.confirmationCode} — ${p.guestName}'s booking has been confirmed`,
    actionType: 'view_booking', data: { confirmationCode: p.confirmationCode },
  });
}
export function notifyBookingCancelled(p: {
  tenantId: string; userId: string; confirmationCode: string; guestName: string; reason?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'booking', category: 'warning',
    title: 'Booking Cancelled',
    message: `${p.confirmationCode} — ${p.guestName}'s booking was cancelled${p.reason ? `: ${p.reason}` : ''}`,
    actionType: 'view_booking', data: { confirmationCode: p.confirmationCode },
  });
}
export function notifyGuestCheckedIn(p: {
  tenantId: string; userId: string; bookingId: string; guestName: string;
  roomNumber?: string; confirmationCode: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'booking', category: 'success',
    title: 'Guest Checked In',
    message: `${p.guestName} has checked in${p.roomNumber ? ` — Room ${p.roomNumber}` : ''} (${p.confirmationCode})`,
    icon: 'LogIn', actionType: 'view_booking',
    data: { bookingId: p.bookingId, confirmationCode: p.confirmationCode, roomNumber: p.roomNumber },
  });
}
export function notifyGuestCheckedOut(p: {
  tenantId: string; userId: string; bookingId: string; guestName: string;
  roomNumber?: string; confirmationCode: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'booking', category: 'info',
    title: 'Guest Checked Out',
    message: `${p.guestName} has checked out${p.roomNumber ? ` — Room ${p.roomNumber}` : ''} (${p.confirmationCode})`,
    actionType: 'view_booking',
    data: { bookingId: p.bookingId, confirmationCode: p.confirmationCode },
  });
}

// -- Payments ---------------------------------------------------------------

export function notifyPaymentReceived(p: {
  tenantId: string; userId: string; amount: number | string; currency: string;
  method: string; confirmationCode?: string; orderNumber?: string; folioNumber?: string;
}): void {
  const suffix = p.confirmationCode
    ? ` for ${p.confirmationCode}`
    : p.orderNumber ? ` for Order #${p.orderNumber}` : '';
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'payment', category: 'success',
    title: 'Payment Received',
    message: `${p.currency}${p.amount} received via ${p.method}${suffix}`,
    actionType: 'view_payment',
    data: { folioNumber: p.folioNumber, confirmationCode: p.confirmationCode, orderNumber: p.orderNumber },
  });
}
export function notifyPaymentFailed(p: {
  tenantId: string; userId: string; amount: number | string; currency: string;
  method: string; reason?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'payment', category: 'error',
    title: 'Payment Failed',
    message: `${p.currency}${p.amount} ${p.method} payment failed${p.reason ? `: ${p.reason}` : ''}`,
    actionType: 'view_payment', data: {},
  });
}

// -- Housekeeping -----------------------------------------------------------

export function notifyTaskAssigned(p: {
  tenantId: string; assigneeUserId: string; taskTitle: string; taskPriority: string;
  roomNumber?: string; assignedBy?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.assigneeUserId, type: 'housekeeping', category: 'info',
    title: 'New Task Assigned',
    message: `${p.taskTitle}${p.roomNumber ? ` — Room ${p.roomNumber}` : ''} (${p.taskPriority} priority)`,
    actionType: 'view_task', data: { assignedBy: p.assignedBy },
  });
}
export function notifyTaskCompleted(p: {
  tenantId: string; userId: string; taskTitle: string; roomNumber?: string; completedBy?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'housekeeping', category: 'success',
    title: 'Task Completed',
    message: `${p.taskTitle}${p.roomNumber ? ` — Room ${p.roomNumber}` : ''} marked as done`,
    actionType: 'view_task', data: { completedBy: p.completedBy },
  });
}

// -- Maintenance / Rooms ---------------------------------------------------

export function notifyRoomMaintenance(p: {
  tenantId: string; userId: string; roomNumber: string; previousStatus: string; propertyId?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'maintenance', category: 'warning',
    title: `Room ${p.roomNumber} Needs Maintenance`,
    message: `Room status changed from ${p.previousStatus} to maintenance`,
    link: '/#rooms', actionType: 'view_room',
    data: { roomNumber: p.roomNumber, previousStatus: p.previousStatus, propertyId: p.propertyId },
  });
}
export function notifyRoomStatusChange(p: {
  tenantId: string; userId: string; roomNumber: string; newStatus: string; previousStatus: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'maintenance', category: 'info',
    title: `Room ${p.roomNumber} — ${capitalize(p.newStatus)}`,
    message: `Status changed from ${p.previousStatus} to ${p.newStatus}`,
    actionType: 'view_room',
    data: { roomNumber: p.roomNumber, newStatus: p.newStatus, previousStatus: p.previousStatus },
  });
}

// -- Inventory -------------------------------------------------------------

export function notifyInventoryAlert(p: {
  tenantId: string; userId: string; itemName: string; currentStock: number;
  threshold: number; status: 'low_stock' | 'out_of_stock';
}): void {
  const isOut = p.status === 'out_of_stock';
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'inventory', category: 'warning',
    title: isOut ? `${p.itemName} Out of Stock` : `${p.itemName} Running Low`,
    message: isOut
      ? 'No stock remaining — reorder immediately'
      : `${p.currentStock} units remaining (threshold: ${p.threshold})`,
    priority: isOut ? 'urgent' : 'high',
    actionType: 'view_inventory',
    data: { itemName: p.itemName, currentStock: p.currentStock, threshold: p.threshold, status: p.status },
  });
}

// -- CRM & Alerts -----------------------------------------------------------

export function notifyGuestReview(p: {
  tenantId: string; userId: string; guestName: string; rating: number; reviewText?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'crm', category: 'info',
    title: 'New Guest Review',
    message: `${p.guestName} left a ${p.rating}-star review${p.reviewText ? `: "${p.reviewText.slice(0, 80)}"` : ''}`,
    actionType: 'view_review', data: { guestName: p.guestName, rating: p.rating },
  });
}
export function notifyServiceRequestCreated(p: {
  tenantId: string; userId: string; requestType: string; roomNumber?: string; guestName?: string;
}): void {
  fire({
    tenantId: p.tenantId, userId: p.userId, type: 'alerts', category: 'info',
    title: 'New Service Request',
    message: `${p.requestType} request${p.roomNumber ? ` from Room ${p.roomNumber}` : ''}${p.guestName ? ` by ${p.guestName}` : ''}`,
    actionType: 'view_service_request',
    data: { requestType: p.requestType, roomNumber: p.roomNumber, guestName: p.guestName },
  });
}
