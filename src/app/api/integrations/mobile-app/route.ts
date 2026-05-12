import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/integrations/mobile-app - Mobile App
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view mobile app data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // Mock app stats
    const appStats = {
      downloads: {
        total: 185420,
        ios: 98340,
        android: 87080,
        thisMonth: 4280,
        lastMonth: 3890,
        growthRate: 10.0,
      },
      activeUsers: {
        dau: 3420,
        wau: 12400,
        mau: 28600,
        dauVsMau: 11.96,
        avgSessionDuration: '8m 24s',
        avgSessionsPerDay: 2.3,
      },
      ratings: {
        ios: { average: 4.6, total: 4520, breakdown: { 5: 2890, 4: 1020, 3: 380, 2: 130, 1: 100 } },
        android: { average: 4.4, total: 3980, breakdown: { 5: 2310, 4: 920, 3: 410, 2: 200, 1: 140 } },
      },
      engagement: {
        mobileCheckins: 842,
        mobileCheckouts: 790,
        digitalKeysUsed: 2340,
        inAppPurchases: 1250,
        featureUsageRanking: [
          { feature: 'Digital Key', usage: 45 },
          { feature: 'Room Service', usage: 28 },
          { feature: 'Housekeeping Requests', usage: 18 },
          { feature: 'Spa Booking', usage: 14 },
          { feature: 'Concierge Chat', usage: 12 },
          { feature: 'Bill Review', usage: 9 },
          { feature: 'Feedback', usage: 7 },
        ],
      },
      performance: {
        avgCrashRate: 0.12,
        avgLoadTime: '1.8s',
        apiErrorRate: 0.03,
        pushDeliveryRate: 97.2,
      },
      dailyTrend: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (29 - i)).toISOString().split('T')[0],
        downloads: Math.floor(100 + Math.random() * 80),
        activeUsers: Math.floor(2800 + Math.random() * 800),
        sessions: Math.floor(6000 + Math.random() * 2000),
        checkins: Math.floor(20 + Math.random() * 15),
      })),
    };

    // Mock features
    const features = [
      { id: 'feat-001', name: 'Digital Key', description: 'Unlock room door via Bluetooth', platform: ['ios', 'android'], status: 'active', version: '2.1.0', enabled: true, usageCount: 2340, crashRate: 0.08, icon: 'key-round' },
      { id: 'feat-002', name: 'Mobile Check-in', description: 'Complete check-in from phone before arrival', platform: ['ios', 'android'], status: 'active', version: '2.3.0', enabled: true, usageCount: 842, crashRate: 0.05, icon: 'log-in' },
      { id: 'feat-003', name: 'Mobile Check-out', description: 'Express check-out from phone', platform: ['ios', 'android'], status: 'active', version: '2.3.0', enabled: true, usageCount: 790, crashRate: 0.04, icon: 'log-out' },
      { id: 'feat-004', name: 'Room Service', description: 'Order food and beverages to room', platform: ['ios', 'android'], status: 'active', version: '1.8.0', enabled: true, usageCount: 1250, crashRate: 0.15, icon: 'utensils-crossed' },
      { id: 'feat-005', name: 'Housekeeping Requests', description: 'Request towels, cleaning, amenities', platform: ['ios', 'android'], status: 'active', version: '1.5.0', enabled: true, usageCount: 1890, crashRate: 0.06, icon: 'sparkles' },
      { id: 'feat-006', name: 'Spa & Wellness Booking', description: 'Browse and book spa treatments', platform: ['ios', 'android'], status: 'active', version: '1.2.0', enabled: true, usageCount: 620, crashRate: 0.10, icon: 'heart' },
      { id: 'feat-007', name: 'Concierge Chat', description: 'Real-time chat with hotel staff', platform: ['ios', 'android'], status: 'active', version: '2.0.0', enabled: true, usageCount: 1450, crashRate: 0.12, icon: 'message-circle' },
      { id: 'feat-008', name: 'Bill Review & Payment', description: 'View folio and make payments', platform: ['ios', 'android'], status: 'active', version: '1.6.0', enabled: true, usageCount: 980, crashRate: 0.07, icon: 'receipt' },
      { id: 'feat-009', name: 'Local Experiences', description: 'Discover nearby attractions and tours', platform: ['ios', 'android'], status: 'active', version: '1.0.0', enabled: true, usageCount: 430, crashRate: 0.09, icon: 'map-pin' },
      { id: 'feat-010', name: 'AR Room Navigator', description: 'Augmented reality indoor navigation', platform: ['ios'], status: 'beta', version: '0.9.0', enabled: false, usageCount: 85, crashRate: 0.45, icon: 'scan' },
      { id: 'feat-011', name: 'Voice Assistant', description: 'Voice-activated room controls', platform: ['ios', 'android'], status: 'planned', version: null, enabled: false, usageCount: 0, crashRate: 0, icon: 'mic' },
      { id: 'feat-012', name: 'Loyalty Wallet', description: 'Points balance, rewards, tier status', platform: ['ios', 'android'], status: 'active', version: '1.4.0', enabled: true, usageCount: 3200, crashRate: 0.03, icon: 'award' },
    ];

    // Mock device list
    const devices = [
      { id: 'dev-001', platform: 'iOS', osVersion: 'iOS 17.5', deviceModel: 'iPhone 15 Pro Max', appVersion: '3.2.1', lastActive: new Date(Date.now() - 1000 * 60 * 2).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'en', location: 'in_app' },
      { id: 'dev-002', platform: 'Android', osVersion: 'Android 14', deviceModel: 'Samsung Galaxy S24 Ultra', appVersion: '3.2.1', lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'en', location: 'in_app' },
      { id: 'dev-003', platform: 'iOS', osVersion: 'iOS 17.4', deviceModel: 'iPhone 14', appVersion: '3.2.0', lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(), pushEnabled: true, biometricEnabled: false, language: 'hi', location: 'background' },
      { id: 'dev-004', platform: 'Android', osVersion: 'Android 13', deviceModel: 'Google Pixel 8', appVersion: '3.1.8', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), pushEnabled: false, biometricEnabled: true, language: 'en', location: 'background' },
      { id: 'dev-005', platform: 'iOS', osVersion: 'iOS 16.7', deviceModel: 'iPhone 12', appVersion: '3.0.5', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'en', location: 'inactive' },
      { id: 'dev-006', platform: 'Android', osVersion: 'Android 14', deviceModel: 'OnePlus 12', appVersion: '3.2.1', lastActive: new Date(Date.now() - 1000 * 60 * 10).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'en', location: 'in_app' },
      { id: 'dev-007', platform: 'iOS', osVersion: 'iOS 17.5', deviceModel: 'iPad Pro (M4)', appVersion: '3.2.1', lastActive: new Date(Date.now() - 1000 * 60 * 15).toISOString(), pushEnabled: true, biometricEnabled: false, language: 'en', location: 'background' },
      { id: 'dev-008', platform: 'Android', osVersion: 'Android 14', deviceModel: 'Xiaomi 14 Ultra', appVersion: '3.2.0', lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'zh', location: 'background' },
      { id: 'dev-009', platform: 'iOS', osVersion: 'iOS 17.3', deviceModel: 'iPhone 15', appVersion: '3.2.1', lastActive: new Date(Date.now() - 1000 * 60 * 8).toISOString(), pushEnabled: true, biometricEnabled: true, language: 'ja', location: 'in_app' },
      { id: 'dev-010', platform: 'Android', osVersion: 'Android 12', deviceModel: 'Samsung Galaxy A54', appVersion: '3.0.2', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), pushEnabled: true, biometricEnabled: false, language: 'en', location: 'inactive' },
    ];

    // Mock push notifications
    const pushNotifications = [
      { id: 'push-001', title: 'Welcome to Royal Stay!', message: 'Your room 101 is ready. Use your digital key to check in.', type: 'checkin_reminder', targetSegment: 'all', sentCount: 142, openRate: 78.5, deliveryRate: 99.2, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      { id: 'push-002', title: 'Spa Special - 20% Off', message: 'Book a relaxing treatment today and enjoy 20% off. Limited slots!', type: 'promotional', targetSegment: 'in_house', sentCount: 87, openRate: 42.3, deliveryRate: 98.8, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { id: 'push-003', title: 'Express Check-out', message: 'Fast-track your departure with mobile check-out. Review your bill now.', type: 'checkout_reminder', targetSegment: 'departing_tomorrow', sentCount: 35, openRate: 65.7, deliveryRate: 100.0, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
      { id: 'push-004', title: 'Room Service is here!', message: 'Order your favorite dishes directly to your room. Browse the menu.', type: 'feature_highlight', targetSegment: 'checked_in', sentCount: 120, openRate: 31.2, deliveryRate: 97.5, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      { id: 'push-005', title: 'Rate Your Stay', message: 'How was your experience? Share your feedback and earn 500 loyalty points.', type: 'feedback_request', targetSegment: 'checked_out_24h', sentCount: 52, openRate: 55.1, deliveryRate: 96.3, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString() },
      { id: 'push-006', title: 'Key Battery Low', message: 'Your door lock battery is low. We\'ll send maintenance to replace it.', type: 'maintenance_alert', targetSegment: 'specific_room', sentCount: 1, openRate: 100.0, deliveryRate: 100.0, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() },
      { id: 'push-007', title: 'Happy Hour at Skyline Bar!', message: 'Enjoy 50% off cocktails from 5-7 PM today. Show this notification.', type: 'promotional', targetSegment: 'in_house', sentCount: 95, openRate: 38.9, deliveryRate: 98.1, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    ];

    // Mock versions
    const versions = [
      { version: '3.2.1', build: '4821', platform: 'both', releaseDate: '2026-05-28', status: 'current', changes: ['Fixed BLE connection stability for digital key', 'Improved push notification delivery', 'Added AR Room Navigator beta', 'Performance optimizations for Android 14'], mandatory: false, minOsVersion: 'iOS 16.0 / Android 12' },
      { version: '3.2.0', build: '4790', platform: 'both', releaseDate: '2026-05-10', status: 'previous', changes: ['New concierge chat with AI suggestions', 'Redesigned room service menu', 'Added local experiences feature', 'Bug fixes and performance improvements'], mandatory: false, minOsVersion: 'iOS 16.0 / Android 12' },
      { version: '3.1.8', build: '4755', platform: 'android', releaseDate: '2026-04-22', status: 'deprecated', changes: ['Critical security patch', 'Android 14 compatibility fix'], mandatory: true, minOsVersion: 'Android 12' },
      { version: '3.0.5', build: '4601', platform: 'ios', releaseDate: '2026-03-15', status: 'deprecated', changes: ['iOS 17.4 compatibility', 'Fixed biometric auth on older devices'], mandatory: false, minOsVersion: 'iOS 16.0' },
      { version: '3.2.2', build: '4850', platform: 'both', releaseDate: null, status: 'beta', changes: ['Voice assistant integration (planned)', 'Enhanced loyalty wallet with tier benefits', 'Multi-language support for 12 languages'], mandatory: false, minOsVersion: 'iOS 16.0 / Android 12' },
    ];

    const stats = {
      totalDownloads: appStats.downloads.total,
      monthlyActiveUsers: appStats.activeUsers.mau,
      dailyActiveUsers: appStats.activeUsers.dau,
      avgRating: ((appStats.ratings.ios.average + appStats.ratings.android.average) / 2).toFixed(1),
      pushDeliveryRate: appStats.performance.pushDeliveryRate,
      crashRate: appStats.performance.avgCrashRate,
      activeFeatures: features.filter(f => f.status === 'active').length,
      totalFeatures: features.length,
      registeredDevices: devices.length,
      pushCampaigns: pushNotifications.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        stats: appStats,
        features,
        devices,
        pushNotifications,
        versions,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching mobile app data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch mobile app data' } },
      { status: 500 }
    );
  }
}
