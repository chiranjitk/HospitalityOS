import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/integrations/smart-locks - Smart Locks
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'integrations.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view smart lock data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const floor = searchParams.get('floor');
    const status = searchParams.get('status');

    // Mock lock providers
    const providers = [
      { id: 'prov-assa', name: 'ASSA ABLOY', model: 'Visionline V2', protocol: 'BLE + NFC', totalLocks: 48, onlineLocks: 45, firmware: '3.2.1', apiVersion: 'v2.4', status: 'connected', lastHeartbeat: new Date(Date.now() - 1000 * 30).toISOString() },
      { id: 'prov-salto', name: 'SALTO KS', model: 'SALTO Neo', protocol: 'BLE + RFID', totalLocks: 32, onlineLocks: 30, firmware: '5.1.0', apiVersion: 'v3.1', status: 'connected', lastHeartbeat: new Date(Date.now() - 1000 * 45).toISOString() },
      { id: 'prov-dormakaba', name: 'Dormakaba', model: 'Guardian L100', protocol: 'NFC + RFID', totalLocks: 20, onlineLocks: 18, firmware: '2.8.4', apiVersion: 'v1.7', status: 'connected', lastHeartbeat: new Date(Date.now() - 1000 * 60).toISOString() },
    ];

    // Mock room lock statuses
    const roomLocks = [
      { id: 'lock-001', roomId: 'RM-101', roomNumber: '101', floor: 1, provider: 'ASSA ABLOY', lockId: 'ASSA-FL1-001', batteryLevel: 85, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 5).toISOString(), firmwareVersion: '3.2.1', signalStrength: -45, guestAssigned: true, guestName: 'James Richardson' },
      { id: 'lock-002', roomId: 'RM-102', roomNumber: '102', floor: 1, provider: 'ASSA ABLOY', lockId: 'ASSA-FL1-002', batteryLevel: 72, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 15).toISOString(), firmwareVersion: '3.2.1', signalStrength: -52, guestAssigned: true, guestName: 'Sarah Chen' },
      { id: 'lock-003', roomId: 'RM-201', roomNumber: '201', floor: 2, provider: 'ASSA ABLOY', lockId: 'ASSA-FL2-001', batteryLevel: 15, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString(), firmwareVersion: '3.2.0', signalStrength: -61, guestAssigned: false, guestName: null },
      { id: 'lock-004', roomId: 'RM-202', roomNumber: '202', floor: 2, provider: 'ASSA ABLOY', lockId: 'ASSA-FL2-002', batteryLevel: 94, status: 'unlocked', doorStatus: 'open', lastActivity: new Date(Date.now() - 1000 * 60 * 2).toISOString(), firmwareVersion: '3.2.1', signalStrength: -38, guestAssigned: true, guestName: 'Yuki Tanaka' },
      { id: 'lock-005', roomId: 'RM-301', roomNumber: '301', floor: 3, provider: 'SALTO KS', lockId: 'SALTO-FL3-001', batteryLevel: 67, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 8).toISOString(), firmwareVersion: '5.1.0', signalStrength: -48, guestAssigned: true, guestName: 'Michael O\'Brien' },
      { id: 'lock-006', roomId: 'RM-302', roomNumber: '302', floor: 3, provider: 'SALTO KS', lockId: 'SALTO-FL3-002', batteryLevel: 43, status: 'offline', doorStatus: 'unknown', lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), firmwareVersion: '5.0.2', signalStrength: -88, guestAssigned: false, guestName: null },
      { id: 'lock-007', roomId: 'RM-401', roomNumber: '401', floor: 4, provider: 'SALTO KS', lockId: 'SALTO-FL4-001', batteryLevel: 81, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 12).toISOString(), firmwareVersion: '5.1.0', signalStrength: -42, guestAssigned: true, guestName: 'Elena Popova' },
      { id: 'lock-008', roomId: 'RM-501', roomNumber: '501', floor: 5, provider: 'Dormakaba', lockId: 'DKBA-FL5-001', batteryLevel: 56, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 20).toISOString(), firmwareVersion: '2.8.4', signalStrength: -55, guestAssigned: true, guestName: 'Priya Sharma' },
      { id: 'lock-009', roomId: 'RM-502', roomNumber: '502', floor: 5, provider: 'Dormakaba', lockId: 'DKBA-FL5-002', batteryLevel: 89, status: 'locked', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 45).toISOString(), firmwareVersion: '2.8.4', signalStrength: -40, guestAssigned: false, guestName: null },
      { id: 'lock-010', roomId: 'RM-103', roomNumber: '103', floor: 1, provider: 'ASSA ABLOY', lockId: 'ASSA-FL1-003', batteryLevel: 8, status: 'low_battery', doorStatus: 'closed', lastActivity: new Date(Date.now() - 1000 * 60 * 10).toISOString(), firmwareVersion: '3.2.1', signalStrength: -47, guestAssigned: true, guestName: 'David Kim' },
    ];

    // Filter by floor and status
    let filteredLocks = roomLocks;
    if (floor) filteredLocks = filteredLocks.filter(l => l.floor === parseInt(floor));
    if (status) filteredLocks = filteredLocks.filter(l => l.status === status);

    // Mock access logs
    const accessLogs = [
      { id: 'log-001', lockId: 'ASSA-FL1-001', roomNumber: '101', accessType: 'mobile_key', userId: 'guest-james', userName: 'James Richardson', method: 'BLE', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), result: 'granted' },
      { id: 'log-002', lockId: 'ASSA-FL1-002', roomNumber: '102', accessType: 'mobile_key', userId: 'guest-sarah', userName: 'Sarah Chen', method: 'NFC', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), result: 'granted' },
      { id: 'log-003', lockId: 'ASSA-FL2-002', roomNumber: '202', accessType: 'mobile_key', userId: 'guest-yuki', userName: 'Yuki Tanaka', method: 'BLE', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), result: 'granted' },
      { id: 'log-004', lockId: 'SALTO-FL3-001', roomNumber: '301', accessType: 'staff_override', userId: 'staff-housekeeping', userName: 'Raj Kumar (HK)', method: 'Staff Card', timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(), result: 'granted' },
      { id: 'log-005', lockId: 'DKBA-FL5-001', roomNumber: '501', accessType: 'key_card', userId: 'guest-priya', userName: 'Priya Sharma', method: 'RFID', timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(), result: 'granted' },
      { id: 'log-006', lockId: 'ASSA-FL1-001', roomNumber: '101', accessType: 'mobile_key', userId: 'unknown-user', userName: 'Unknown', method: 'BLE', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), result: 'denied' },
      { id: 'log-007', lockId: 'SALTO-FL3-002', roomNumber: '302', accessType: 'staff_override', userId: 'staff-maintenance', userName: 'Arun Singh (MNT)', method: 'Master Key', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), result: 'granted' },
      { id: 'log-008', lockId: 'SALTO-FL4-001', roomNumber: '401', accessType: 'mobile_key', userId: 'guest-elena', userName: 'Elena Popova', method: 'BLE', timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), result: 'granted' },
      { id: 'log-009', lockId: 'ASSA-FL2-001', roomNumber: '201', accessType: 'master_key', userId: 'staff-frontdesk', userName: 'Anita Verma (FD)', method: 'Master Key', timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(), result: 'granted' },
      { id: 'log-010', lockId: 'DKBA-FL5-002', roomNumber: '502', accessType: 'key_card', userId: 'staff-inspector', userName: 'Vikram Joshi (QA)', method: 'Inspector Card', timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(), result: 'granted' },
    ];

    // Mock key cards
    const keyCards = [
      { id: 'kc-001', cardNumber: '****-****-****-3847', type: 'guest', status: 'active', assignedTo: 'James Richardson', roomNumber: '101', issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), accessLevels: ['room', 'gym', 'pool'] },
      { id: 'kc-002', cardNumber: '****-****-****-9201', type: 'guest', status: 'active', assignedTo: 'Sarah Chen', roomNumber: '102', issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), accessLevels: ['room', 'gym'] },
      { id: 'kc-003', cardNumber: '****-****-****-5563', type: 'guest', status: 'expired', assignedTo: 'Rahul Mehta', roomNumber: '205', issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), accessLevels: ['room'] },
      { id: 'kc-004', cardNumber: '****-****-****-7782', type: 'staff', status: 'active', assignedTo: 'Raj Kumar (Housekeeping)', roomNumber: null, issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), expiresAt: null, accessLevels: ['all_rooms', 'housekeeping', 'laundry'] },
      { id: 'kc-005', cardNumber: '****-****-****-1100', type: 'master', status: 'active', assignedTo: 'Front Desk - Shift A', roomNumber: null, issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(), expiresAt: null, accessLevels: ['all_rooms', 'all_areas'] },
      { id: 'kc-006', cardNumber: '****-****-****-2200', type: 'master', status: 'active', assignedTo: 'Front Desk - Shift B', roomNumber: null, issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(), expiresAt: null, accessLevels: ['all_rooms', 'all_areas'] },
      { id: 'kc-007', cardNumber: '****-****-****-4400', type: 'staff', status: 'active', assignedTo: 'Arun Singh (Maintenance)', roomNumber: null, issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), expiresAt: null, accessLevels: ['all_rooms', 'maintenance', 'boiler_room'] },
      { id: 'kc-008', cardNumber: '****-****-****-6612', type: 'guest', status: 'lost', assignedTo: 'Alex Turner', roomNumber: '303', issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), accessLevels: ['room', 'gym', 'pool'] },
      { id: 'kc-009', cardNumber: '****-****-****-8834', type: 'guest', status: 'active', assignedTo: 'Yuki Tanaka', roomNumber: '202', issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(), accessLevels: ['room', 'spa', 'gym'] },
      { id: 'kc-010', cardNumber: '****-****-****-9901', type: 'emergency', status: 'active', assignedTo: 'Security - All Access', roomNumber: null, issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(), expiresAt: null, accessLevels: ['all_rooms', 'all_areas', 'safe_room', 'server_room'] },
    ];

    const stats = {
      totalLocks: providers.reduce((sum, p) => sum + p.totalLocks, 0),
      onlineLocks: providers.reduce((sum, p) => sum + p.onlineLocks, 0),
      offlineLocks: providers.reduce((sum, p) => sum + (p.totalLocks - p.onlineLocks), 0),
      lowBatteryLocks: roomLocks.filter(l => l.batteryLevel <= 15).length,
      criticalBatteryLocks: roomLocks.filter(l => l.batteryLevel <= 8).length,
      totalProviders: providers.length,
      activeKeyCards: keyCards.filter(k => k.status === 'active').length,
      totalAccessEvents: accessLogs.length,
      deniedAccessToday: accessLogs.filter(l => l.result === 'denied').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        providers,
        roomLocks: filteredLocks,
        accessLogs,
        keyCards,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching smart lock data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch smart lock data' } },
      { status: 500 }
    );
  }
}
