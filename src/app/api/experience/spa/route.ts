import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience/spa - Spa & Wellness
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experiences.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view spa data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Mock appointments
    const appointments = [
      { id: 'apt-001', treatmentId: 'trt-001', treatmentName: 'Swedish Massage (60 min)', therapistId: 'thp-001', therapistName: 'Ananya Iyer', guestId: 'guest-001', guestName: 'James Richardson', roomNumber: '101', date, startTime: '09:00', endTime: '10:00', duration: 60, status: 'confirmed', price: 3500, currency: 'INR', notes: 'Prefers medium pressure', location: 'Treatment Room 1', addons: [] },
      { id: 'apt-002', treatmentId: 'trt-004', treatmentName: 'Couples Retreat (90 min)', therapistId: 'thp-003', therapistName: 'Meera Patel', secondTherapistId: 'thp-005', secondTherapistName: 'Ritu Sharma', guestId: 'guest-002', guestName: 'Sarah Chen', roomNumber: '102', date, startTime: '10:30', endTime: '12:00', duration: 90, status: 'in_progress', price: 9000, currency: 'INR', notes: 'Anniversary celebration', location: 'Couples Suite', addons: [{ name: 'Champagne & Chocolates', price: 1500 }] },
      { id: 'apt-003', treatmentId: 'trt-006', treatmentName: 'Ayurvedic Abhyanga (75 min)', therapistId: 'thp-002', therapistName: 'Dr. Kavitha Nair', guestId: 'guest-003', guestName: 'Yuki Tanaka', roomNumber: '202', date, startTime: '14:00', endTime: '15:15', duration: 75, status: 'confirmed', price: 4500, currency: 'INR', notes: 'First time ayurvedic treatment', location: 'Ayurveda Room', addons: [{ name: 'Herbal Steam Bath', price: 800 }] },
      { id: 'apt-004', treatmentId: 'trt-002', treatmentName: 'Deep Tissue Massage (60 min)', therapistId: 'thp-004', therapistName: 'Arjun Menon', guestId: 'guest-004', guestName: 'Elena Popova', roomNumber: '401', date, startTime: '16:00', endTime: '17:00', duration: 60, status: 'confirmed', price: 4000, currency: 'INR', notes: 'Sports recovery, focus on shoulders', location: 'Treatment Room 2', addons: [] },
      { id: 'apt-005', treatmentId: 'trt-008', treatmentName: 'Facial Rejuvenation (90 min)', therapistId: 'thp-006', therapistName: 'Priya Desai', guestId: 'guest-005', guestName: 'Priya Sharma', roomNumber: '501', date, startTime: '11:00', endTime: '12:30', duration: 90, status: 'pending', price: 5500, currency: 'INR', notes: 'Sensitive skin', location: 'Beauty Suite', addons: [{ name: 'Eye Contour Treatment', price: 600 }] },
      { id: 'apt-006', treatmentId: 'trt-003', treatmentName: 'Hot Stone Therapy (75 min)', therapistId: 'thp-001', therapistName: 'Ananya Iyer', guestId: 'guest-007', guestName: 'David Kim', roomNumber: null, date, startTime: '13:00', endTime: '14:15', duration: 75, status: 'confirmed', price: 5000, currency: 'INR', notes: 'Walk-in guest', location: 'Treatment Room 1', addons: [] },
      { id: 'apt-007', treatmentId: 'trt-005', treatmentName: 'Yoga Private Session (60 min)', therapistId: 'thp-007', therapistName: 'Swami Ramesh', guestId: 'guest-008', guestName: 'Michael O\'Brien', roomNumber: '301', date, startTime: '07:00', endTime: '08:00', duration: 60, status: 'completed', price: 2500, currency: 'INR', notes: 'Beginner level, flexibility focus', location: 'Yoga Studio', addons: [] },
      { id: 'apt-008', treatmentId: 'trt-007', treatmentName: 'Hydrotherapy Session (45 min)', therapistId: 'thp-008', therapistName: 'Dr. Sunita Rao', guestId: 'guest-001', guestName: 'James Richardson', roomNumber: '101', date, startTime: '15:00', endTime: '15:45', duration: 45, status: 'confirmed', price: 3000, currency: 'INR', notes: '', location: 'Hydrotherapy Suite', addons: [] },
      { id: 'apt-009', treatmentId: 'trt-009', treatmentName: 'Reflexology (45 min)', therapistId: 'thp-004', therapistName: 'Arjun Menon', guestId: null, guestName: 'External Guest', roomNumber: null, date, startTime: '17:00', endTime: '17:45', duration: 45, status: 'no_show', price: 2000, currency: 'INR', notes: '', location: 'Treatment Room 2', addons: [] },
      { id: 'apt-010', treatmentId: 'trt-001', treatmentName: 'Swedish Massage (60 min)', therapistId: 'thp-005', therapistName: 'Ritu Sharma', guestId: 'guest-009', guestName: 'Alex Turner', roomNumber: '103', date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0], startTime: '10:00', endTime: '11:00', duration: 60, status: 'confirmed', price: 3500, currency: 'INR', notes: '', location: 'Treatment Room 1', addons: [] },
    ];

    const filteredAppointments = status
      ? appointments.filter(a => a.status === status)
      : appointments.filter(a => a.date === date);

    // Mock treatment catalog
    const treatments = [
      { id: 'trt-001', name: 'Swedish Massage', category: 'Massage', duration: 60, price: 3500, currency: 'INR', description: 'Classic full-body relaxation massage with long flowing strokes', popularity: 92, availability: 'high', imageUrl: null, status: 'active' },
      { id: 'trt-002', name: 'Deep Tissue Massage', category: 'Massage', duration: 60, price: 4000, currency: 'INR', description: 'Intense therapeutic massage targeting deep muscle layers', popularity: 78, availability: 'medium', imageUrl: null, status: 'active' },
      { id: 'trt-003', name: 'Hot Stone Therapy', category: 'Massage', duration: 75, price: 5000, currency: 'INR', description: 'Heated basalt stones combined with massage for deep relaxation', popularity: 85, availability: 'high', imageUrl: null, status: 'active' },
      { id: 'trt-004', name: 'Couples Retreat', category: 'Package', duration: 90, price: 9000, currency: 'INR', description: 'Side-by-side couples massage with aromatherapy in private suite', popularity: 88, availability: 'low', imageUrl: null, status: 'active' },
      { id: 'trt-005', name: 'Yoga Private Session', category: 'Wellness', duration: 60, price: 2500, currency: 'INR', description: 'One-on-one yoga session tailored to your level and goals', popularity: 65, availability: 'high', imageUrl: null, status: 'active' },
      { id: 'trt-006', name: 'Ayurvedic Abhyanga', category: 'Ayurveda', duration: 75, price: 4500, currency: 'INR', description: 'Traditional warm oil full-body massage based on Ayurvedic principles', popularity: 82, availability: 'medium', imageUrl: null, status: 'active' },
      { id: 'trt-007', name: 'Hydrotherapy Session', category: 'Wellness', duration: 45, price: 3000, currency: 'INR', description: 'Thermal water circuit with jets, bubbles, and contrast therapy', popularity: 70, availability: 'high', imageUrl: null, status: 'active' },
      { id: 'trt-008', name: 'Facial Rejuvenation', category: 'Beauty', duration: 90, price: 5500, currency: 'INR', description: 'Luxury anti-aging facial with collagen boost and LED therapy', popularity: 75, availability: 'medium', imageUrl: null, status: 'active' },
      { id: 'trt-009', name: 'Reflexology', category: 'Massage', duration: 45, price: 2000, currency: 'INR', description: 'Targeted foot and hand reflexology for whole-body wellness', popularity: 60, availability: 'high', imageUrl: null, status: 'active' },
      { id: 'trt-010', name: 'Panchakarma Detox', category: 'Ayurveda', duration: 180, price: 12000, currency: 'INR', description: 'Comprehensive Ayurvedic detox program with 5 cleansing therapies', popularity: 55, availability: 'low', imageUrl: null, status: 'active' },
      { id: 'trt-011', name: 'Scrubs & Wraps Combo', category: 'Beauty', duration: 90, price: 6500, currency: 'INR', description: 'Coffee body scrub followed by herbal body wrap', popularity: 68, availability: 'medium', imageUrl: null, status: 'active' },
      { id: 'trt-012', name: 'Meditation Session', category: 'Wellness', duration: 30, price: 1500, currency: 'INR', description: 'Guided meditation session in our tranquil zen garden', popularity: 58, availability: 'high', imageUrl: null, status: 'active' },
    ];

    // Mock therapists
    const therapists = [
      { id: 'thp-001', name: 'Ananya Iyer', specialization: ['Swedish', 'Hot Stone', 'Aromatherapy'], certifications: ['CIBTAC', 'ITEC'], experience: 8, rating: 4.9, totalSessions: 3240, status: 'on_duty', shiftStart: '09:00', shiftEnd: '18:00', avatar: null, languages: ['English', 'Hindi', 'Tamil'] },
      { id: 'thp-002', name: 'Dr. Kavitha Nair', specialization: ['Ayurveda', 'Panchakarma', 'Abhyanga'], certifications: ['BAMS', 'MD Ayurveda', 'CIBTAC'], experience: 15, rating: 4.95, totalSessions: 5890, status: 'on_duty', shiftStart: '08:00', shiftEnd: '17:00', avatar: null, languages: ['English', 'Hindi', 'Malayalam', 'Sanskrit'] },
      { id: 'thp-003', name: 'Meera Patel', specialization: ['Couples', 'Deep Tissue', 'Prenatal'], certifications: ['ITEC', 'CIBTAC'], experience: 6, rating: 4.8, totalSessions: 2100, status: 'busy', shiftStart: '09:00', shiftEnd: '18:00', avatar: null, languages: ['English', 'Hindi', 'Gujarati'] },
      { id: 'thp-004', name: 'Arjun Menon', specialization: ['Deep Tissue', 'Sports Massage', 'Reflexology'], certifications: ['CIBTAC', 'NSCA-CPT'], experience: 10, rating: 4.85, totalSessions: 4120, status: 'on_duty', shiftStart: '10:00', shiftEnd: '19:00', avatar: null, languages: ['English', 'Hindi', 'Malayalam'] },
      { id: 'thp-005', name: 'Ritu Sharma', specialization: ['Swedish', 'Couples', 'Aromatherapy'], certifications: ['ITEC', 'CIDESCO'], experience: 5, rating: 4.75, totalSessions: 1800, status: 'on_duty', shiftStart: '09:00', shiftEnd: '18:00', avatar: null, languages: ['English', 'Hindi', 'Marathi'] },
      { id: 'thp-006', name: 'Priya Desai', specialization: ['Facial', 'Beauty', 'Anti-aging'], certifications: ['CIDESCO', 'CIBTAC', 'Dermalogica Expert'], experience: 7, rating: 4.88, totalSessions: 2860, status: 'off_duty', shiftStart: '12:00', shiftEnd: '21:00', avatar: null, languages: ['English', 'Hindi', 'Kannada'] },
      { id: 'thp-007', name: 'Swami Ramesh', specialization: ['Yoga', 'Meditation', 'Pranayama'], certifications: ['RYT-500', 'Yoga Alliance'], experience: 20, rating: 4.92, totalSessions: 7200, status: 'on_duty', shiftStart: '06:00', shiftEnd: '12:00', avatar: null, languages: ['English', 'Hindi', 'Sanskrit'] },
      { id: 'thp-008', name: 'Dr. Sunita Rao', specialization: ['Hydrotherapy', 'Physiotherapy', 'Rehabilitation'], certifications: ['BPT', 'MPT', 'WATSU Level 2'], experience: 12, rating: 4.8, totalSessions: 3500, status: 'on_duty', shiftStart: '08:00', shiftEnd: '16:00', avatar: null, languages: ['English', 'Hindi', 'Telugu'] },
    ];

    // Mock revenue stats
    const revenueStats = {
      today: {
        bookings: 7,
        revenue: 36000,
        avgSpendPerGuest: 5143,
        occupancy: 78,
        topTreatment: 'Swedish Massage',
        noShows: 1,
        cancellations: 0,
      },
      thisWeek: {
        bookings: 42,
        revenue: 215000,
        avgSpendPerGuest: 5119,
        occupancy: 82,
        topTreatment: 'Couples Retreat',
        noShows: 3,
        cancellations: 2,
      },
      thisMonth: {
        bookings: 168,
        revenue: 860000,
        avgSpendPerGuest: 5119,
        occupancy: 79,
        topTreatment: 'Swedish Massage',
        noShows: 12,
        cancellations: 8,
        revenueVsLastMonth: 12.5,
      },
      byCategory: [
        { category: 'Massage', bookings: 72, revenue: 302000, percentage: 35.1 },
        { category: 'Ayurveda', bookings: 28, revenue: 142000, percentage: 16.5 },
        { category: 'Package', bookings: 18, revenue: 162000, percentage: 18.8 },
        { category: 'Wellness', bookings: 30, revenue: 85000, percentage: 9.9 },
        { category: 'Beauty', bookings: 20, revenue: 118000, percentage: 13.7 },
        { category: 'Add-ons', bookings: null, revenue: 51000, percentage: 5.9 },
      ],
      revenueTrend: Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (13 - i)).toISOString().split('T')[0],
        revenue: Math.floor(25000 + Math.random() * 20000),
        bookings: Math.floor(5 + Math.random() * 5),
        avgRating: parseFloat((4.7 + Math.random() * 0.25).toFixed(1)),
      })),
    };

    const stats = {
      todayBookings: revenueStats.today.bookings,
      todayRevenue: revenueStats.today.revenue,
      monthBookings: revenueStats.thisMonth.bookings,
      monthRevenue: revenueStats.thisMonth.revenue,
      totalTreatments: treatments.length,
      totalTherapists: therapists.length,
      onDutyTherapists: therapists.filter(t => t.status === 'on_duty' || t.status === 'busy').length,
      monthGrowth: revenueStats.thisMonth.revenueVsLastMonth,
    };

    return NextResponse.json({
      success: true,
      data: {
        appointments: filteredAppointments,
        treatments,
        therapists,
        revenueStats,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching spa data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch spa & wellness data' } },
      { status: 500 }
    );
  }
}
