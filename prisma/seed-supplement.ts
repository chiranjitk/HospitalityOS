import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Generate deterministic UUIDs from seed strings for PostgreSQL @db.Uuid compatibility.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31),
  ].join('-');
};

export async function seedSupplementData(prisma: PrismaClient) {
  const today = new Date();
  const tenantId = uuid('tenant-1');
  const propertyId = uuid('property-1');

  console.log('Starting supplemental seed data...');

  // ============================================================
  // CLEAN EXISTING SUPPLEMENT DATA (child tables first)
  // ============================================================
  console.log('Cleaning supplemental seed data...');
  await prisma.menuBoardItem.deleteMany({});
  await prisma.menuBoard.deleteMany({});
  await prisma.menuVariant.deleteMany({});
  await prisma.menuModifierOption.deleteMany({});
  await prisma.recipeIngredient.deleteMany({});
  await prisma.recipe.deleteMany({});
  await prisma.posTerminal.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.tableMerge.deleteMany({});
  await prisma.casinoTransaction.deleteMany({});
  await prisma.casinoTable.deleteMany({});
  await prisma.timeshareOwnership.deleteMany({});
  await prisma.timeshareUnit.deleteMany({});
  await prisma.golfMembership.deleteMany({});
  await prisma.golfTeeTime.deleteMany({});
  await prisma.golfCourse.deleteMany({});
  await prisma.bEOItem.deleteMany({});
  await prisma.banquetEventOrder.deleteMany({});
  await prisma.eventResource.deleteMany({});
  await prisma.spaAppointment.deleteMany({});
  await prisma.spaTherapist.deleteMany({});
  await prisma.spaTreatment.deleteMany({});
  await prisma.experienceFeedback.deleteMany({});
  await prisma.experienceBooking.deleteMany({});
  await prisma.experiencePricing.deleteMany({});
  await prisma.experienceVendor.deleteMany({});
  await prisma.experience.deleteMany({});
  console.log('Supplemental data cleaned.');

  // ============================================================
  // EXPERIENCE MODULE
  // ============================================================
  console.log('Seeding Experience module...');

  // 1. Experience - 6 experiences
  await prisma.experience.createMany({
    data: [
      {
        id: uuid('exp-1'),
        tenantId,
        propertyId,
        name: 'Kolkata City Tour',
        description: 'Guided tour through the historic streets of Kolkata covering Victoria Memorial, Howrah Bridge, and Park Street.',
        category: 'sightseeing',
        duration: 180,
        maxParticipants: 12,
        basePrice: 2500,
        status: 'active',
        tags: '["city","heritage","walking"]',
        highlights: 'Victoria Memorial, Howrah Bridge, Park Street, St. Paul\'s Cathedral',
        whatToBring: 'Comfortable shoes, camera, sunscreen',
        cancellationPolicy: 'Free cancellation up to 24 hours before the experience.',
        rating: 4.7,
        totalReviews: 34,
        totalBookings: 128,
      },
      {
        id: uuid('exp-2'),
        tenantId,
        propertyId,
        name: 'Bengali Cooking Class',
        description: 'Hands-on cooking class learning authentic Bengali recipes from our executive chef.',
        category: 'culinary',
        duration: 120,
        maxParticipants: 8,
        basePrice: 3000,
        status: 'active',
        tags: '["cooking","bengali","food"]',
        highlights: 'Learn to make Kosha Mangsho, Shorshe Ilish, and Mishti Doi',
        whatToBring: 'Apron provided, appetite!',
        cancellationPolicy: 'Free cancellation up to 12 hours before. 50% charge for late cancellations.',
        rating: 4.9,
        totalReviews: 56,
        totalBookings: 210,
      },
      {
        id: uuid('exp-3'),
        tenantId,
        propertyId,
        name: 'Sunrise Yoga Session',
        description: 'Morning yoga and meditation session on the rooftop with views of the Kolkata skyline.',
        category: 'wellness',
        duration: 60,
        maxParticipants: 15,
        basePrice: 800,
        status: 'active',
        tags: '["yoga","wellness","meditation"]',
        highlights: 'Hatha Yoga, Pranayama, Guided Meditation',
        whatToBring: 'Yoga mat provided, comfortable clothing',
        cancellationPolicy: 'Free cancellation up to 6 hours before.',
        rating: 4.8,
        totalReviews: 89,
        totalBookings: 340,
      },
      {
        id: uuid('exp-4'),
        tenantId,
        propertyId,
        name: 'Heritage Walk - North Kolkata',
        description: 'Explore the grand colonial mansions and narrow lanes of North Kolkata including Kumartuli pottery village.',
        category: 'heritage',
        duration: 150,
        maxParticipants: 10,
        basePrice: 1800,
        status: 'active',
        tags: '["heritage","walking","photography"]',
        highlights: 'Kumartuli, Jorasanko Thakur Bari, Marble Palace, College Street',
        whatToBring: 'Camera, comfortable shoes, water bottle',
        cancellationPolicy: 'Free cancellation up to 24 hours before.',
        rating: 4.6,
        totalReviews: 22,
        totalBookings: 76,
      },
      {
        id: uuid('exp-5'),
        tenantId,
        propertyId,
        name: 'Hooghly River Sunset Cruise',
        description: 'Scenic boat ride along the Hooghly River during sunset with snacks and beverages on board.',
        category: 'adventure',
        duration: 90,
        maxParticipants: 20,
        basePrice: 2000,
        status: 'active',
        tags: '["boat","sunset","river"]',
        highlights: 'Sunset views, river ghats, snacks and chai on board',
        whatToBring: 'Light jacket, camera',
        cancellationPolicy: 'Weather-dependent. Full refund for weather cancellations.',
        rating: 4.5,
        totalReviews: 41,
        totalBookings: 165,
      },
      {
        id: uuid('exp-6'),
        tenantId,
        propertyId,
        name: 'Kali Temple & Spiritual Tour',
        description: 'Visit the famous Kalighat Kali Temple and Dakshineswar Kali Temple with a spiritual guide.',
        category: 'spiritual',
        duration: 240,
        maxParticipants: 8,
        basePrice: 2200,
        status: 'active',
        tags: '["temple","spiritual","culture"]',
        highlights: 'Kalighat Kali Temple, Dakshineswar, Belur Math',
        whatToBring: 'Modest clothing covering shoulders and knees, remove shoes at temples',
        cancellationPolicy: 'Free cancellation up to 24 hours before.',
        rating: 4.8,
        totalReviews: 29,
        totalBookings: 95,
      },
    ],
  });

  // 2. ExperiencePricing - 12 pricing rules
  await prisma.experiencePricing.createMany({
    data: [
      // City Tour pricing
      { id: uuid('exprule-1'), tenantId, experienceId: uuid('exp-1'), type: 'rule', seasonName: 'Peak Season', startDate: new Date(today.getFullYear(), 9, 1), endDate: new Date(today.getFullYear(), 2, 31), priceMultiplier: 1.3, minGuests: 1, maxGuests: 12, isAvailable: true },
      { id: uuid('exprule-2'), tenantId, experienceId: uuid('exp-1'), type: 'rule', seasonName: 'Monsoon', startDate: new Date(today.getFullYear(), 5, 1), endDate: new Date(today.getFullYear(), 8, 30), priceMultiplier: 0.85, minGuests: 1, maxGuests: 12, isAvailable: true },
      { id: uuid('expslot-1'), tenantId, experienceId: uuid('exp-1'), type: 'slot', startTime: '09:00', endTime: '12:00', capacity: 12, isAvailable: true },
      { id: uuid('expslot-2'), tenantId, experienceId: uuid('exp-1'), type: 'slot', startTime: '14:00', endTime: '17:00', capacity: 12, isAvailable: true },
      // Cooking Class pricing
      { id: uuid('exprule-3'), tenantId, experienceId: uuid('exp-2'), type: 'rule', seasonName: 'Weekend Surcharge', startDate: new Date(today.getFullYear(), 0, 1), endDate: new Date(today.getFullYear(), 11, 31), priceMultiplier: 1.2, minGuests: 2, isAvailable: true },
      { id: uuid('expslot-3'), tenantId, experienceId: uuid('exp-2'), type: 'slot', startTime: '11:00', endTime: '13:00', capacity: 8, isAvailable: true },
      { id: uuid('expslot-4'), tenantId, experienceId: uuid('exp-2'), type: 'slot', startTime: '16:00', endTime: '18:00', capacity: 8, isAvailable: true },
      // Yoga pricing
      { id: uuid('exprule-4'), tenantId, experienceId: uuid('exp-3'), type: 'rule', priceMultiplier: 1.0, minGuests: 1, maxGuests: 15, isAvailable: true },
      { id: uuid('expslot-5'), tenantId, experienceId: uuid('exp-3'), type: 'slot', startTime: '06:00', endTime: '07:00', capacity: 15, isAvailable: true },
      { id: uuid('expslot-6'), tenantId, experienceId: uuid('exp-3'), type: 'slot', startTime: '07:00', endTime: '08:00', capacity: 15, isAvailable: true },
      // Heritage Walk
      { id: uuid('expslot-7'), tenantId, experienceId: uuid('exp-4'), type: 'slot', startTime: '07:30', endTime: '10:00', capacity: 10, isAvailable: true },
      // River Cruise
      { id: uuid('exprule-5'), tenantId, experienceId: uuid('exp-5'), type: 'rule', seasonName: 'Winter Premium', startDate: new Date(today.getFullYear(), 10, 1), endDate: new Date(today.getFullYear(), 1, 28), priceMultiplier: 1.4, minGuests: 1, isAvailable: true },
    ],
  });

  // 3. ExperienceBooking - 5 bookings linked to existing guests
  await prisma.experienceBooking.createMany({
    data: [
      {
        id: uuid('expbook-1'),
        tenantId,
        propertyId,
        experienceId: uuid('exp-1'),
        guestId: uuid('guest-1'),
        guestName: 'Amit Mukherjee',
        guestEmail: 'amit.m@email.com',
        guestPhone: '+91-9830012345',
        bookingDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        bookingTime: '09:00',
        numberOfGuests: 2,
        totalPrice: 5000,
        specialRequests: 'Please include a stop at the Indian Museum if possible.',
        status: 'confirmed',
        confirmedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('expbook-2'),
        tenantId,
        propertyId,
        experienceId: uuid('exp-2'),
        guestId: uuid('guest-3'),
        guestName: 'Rahul Banerjee',
        guestEmail: 'rahul.b@email.com',
        guestPhone: '+91-9830034567',
        bookingDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        bookingTime: '16:00',
        numberOfGuests: 1,
        totalPrice: 3600,
        specialRequests: 'Vegetarian dishes only. Interested in learning Shorshe Ilish.',
        status: 'confirmed',
        confirmedAt: new Date(today.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        id: uuid('expbook-3'),
        tenantId,
        propertyId,
        experienceId: uuid('exp-3'),
        guestId: uuid('guest-2'),
        guestName: 'Sneha Gupta',
        guestEmail: 'sneha.g@email.com',
        bookingDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        bookingTime: '06:00',
        numberOfGuests: 1,
        totalPrice: 800,
        status: 'confirmed',
        confirmedAt: new Date(today.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        id: uuid('expbook-4'),
        tenantId,
        propertyId,
        experienceId: uuid('exp-5'),
        guestId: uuid('guest-5'),
        guestName: 'Vikram Singh',
        guestEmail: 'vikram.s@email.com',
        guestPhone: '+91-9830056789',
        bookingDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        bookingTime: '17:00',
        numberOfGuests: 4,
        totalPrice: 8000,
        specialRequests: 'Anniversary celebration. Can we arrange a small cake on board?',
        status: 'pending',
      },
      {
        id: uuid('expbook-5'),
        tenantId,
        propertyId,
        experienceId: uuid('exp-4'),
        guestId: uuid('guest-6'),
        guestName: 'Rina Chatterjee',
        guestEmail: 'rina.c@email.com',
        bookingDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        bookingTime: '07:30',
        numberOfGuests: 2,
        totalPrice: 3600,
        status: 'completed',
        completedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 4. ExperienceVendor - 4 vendors
  await prisma.experienceVendor.createMany({
    data: [
      {
        id: uuid('expvendor-1'),
        tenantId,
        propertyId,
        companyName: 'Heritage Walks Kolkata',
        contactPerson: 'Subrata Das',
        email: 'subrata@heritagewalks.in',
        phone: '+91-9831012345',
        address: '12 College Street, Kolkata',
        category: 'tours',
        commissionRate: 15,
        bankAccountName: 'Heritage Walks Kolkata',
        bankAccountNumber: '1234567890123456',
        bankIfsc: 'HDFC0001234',
        status: 'active',
        notes: 'Reliable partner for city and heritage walks. Specializes in North Kolkata tours.',
      },
      {
        id: uuid('expvendor-2'),
        tenantId,
        propertyId,
        companyName: 'Ganga River Cruises',
        contactPerson: 'Pranab Ghosh',
        email: 'pranab@gangacruises.in',
        phone: '+91-9831023456',
        address: 'Outram Ghat, Kolkata',
        category: 'cruises',
        commissionRate: 20,
        bankAccountName: 'Ganga River Cruises Pvt Ltd',
        bankAccountNumber: '2345678901234567',
        bankIfsc: 'ICIC0005678',
        status: 'active',
        notes: 'Premium river cruise operator. Has both motorized and sail boats.',
      },
      {
        id: uuid('expvendor-3'),
        tenantId,
        propertyId,
        companyName: 'Yoga Wellness Studio',
        contactPerson: 'Dr. Ananya Sen',
        email: 'ananya@yogawellness.in',
        phone: '+91-9831034567',
        address: '45 Camac Street, Kolkata',
        category: 'wellness',
        commissionRate: 10,
        status: 'active',
        notes: 'Certified yoga instructors. Can conduct sessions in multiple languages.',
      },
      {
        id: uuid('expvendor-4'),
        tenantId,
        propertyId,
        companyName: 'Bengali Bhoj Culinary Academy',
        contactPerson: 'Chef Arup Saha',
        email: 'arup@bengalibhoj.in',
        phone: '+91-9831045678',
        address: '78 Ballygunge Circular Road, Kolkata',
        category: 'culinary',
        commissionRate: 12,
        status: 'active',
        notes: 'Renowned chef specializing in traditional Bengali cuisine. Published cookbook author.',
      },
    ],
  });

  // 5. ExperienceFeedback - 4 feedback entries
  await prisma.experienceFeedback.createMany({
    data: [
      {
        id: uuid('expfb-1'),
        tenantId,
        experienceBookingId: uuid('expbook-5'),
        experienceId: uuid('exp-4'),
        guestId: uuid('guest-6'),
        guestName: 'Rina Chatterjee',
        rating: 5,
        reviewText: 'Absolutely fantastic heritage walk! Our guide was incredibly knowledgeable about the history of each location. The visit to Kumartuli was the highlight. Highly recommended for anyone interested in Kolkata\'s rich culture.',
        category: 'heritage',
        staffResponse: 'Thank you for your wonderful review, Rina! We are delighted you enjoyed the North Kolkata Heritage Walk. Our guides take great pride in sharing the city\'s history. Hope to see you again!',
        status: 'published',
      },
      {
        id: uuid('expfb-2'),
        tenantId,
        experienceId: uuid('exp-2'),
        guestId: uuid('guest-1'),
        guestName: 'Amit Mukherjee',
        rating: 5,
        reviewText: 'Best cooking class I have ever attended! Chef Arup was patient and the recipes were easy to follow. The Shorshe Ilish turned out perfect. Already planning to book another session.',
        category: 'culinary',
        status: 'published',
      },
      {
        id: uuid('expfb-3'),
        tenantId,
        experienceId: uuid('exp-3'),
        guestId: uuid('guest-3'),
        guestName: 'Rahul Banerjee',
        rating: 4,
        reviewText: 'Very peaceful yoga session with a great view of the city. The instructor was excellent. Only suggestion: would be nice to have herbal tea after the session.',
        category: 'wellness',
        staffResponse: 'Thank you Rahul! Great suggestion about herbal tea — we will add complimentary herbal tea after all morning yoga sessions starting next week.',
        status: 'published',
      },
      {
        id: uuid('expfb-4'),
        tenantId,
        experienceId: uuid('exp-5'),
        guestId: uuid('guest-2'),
        guestName: 'Sneha Gupta',
        rating: 5,
        reviewText: 'The sunset cruise was magical! The view of the Howrah Bridge during golden hour was breathtaking. Snacks and chai on board were a lovely touch. Perfect for couples.',
        category: 'adventure',
        status: 'published',
      },
    ],
  });

  // ============================================================
  // SPA MODULE
  // ============================================================
  console.log('Seeding Spa module...');

  // 6. SpaTreatment - 8 treatments with INR pricing
  await prisma.spaTreatment.createMany({
    data: [
      {
        id: uuid('spa-1'),
        tenantId,
        propertyId,
        name: 'Swedish Massage',
        description: 'Full body relaxation massage using long flowing strokes to ease muscle tension and improve circulation.',
        category: 'massage',
        durationMinutes: 60,
        price: 3500,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: uuid('spa-2'),
        tenantId,
        propertyId,
        name: 'Ayurvedic Abhyanga',
        description: 'Traditional Ayurvedic warm oil full body massage using herbal oils customized to your dosha type.',
        category: 'massage',
        durationMinutes: 75,
        price: 4500,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 2,
      },
      {
        id: uuid('spa-3'),
        tenantId,
        propertyId,
        name: 'Deep Tissue Massage',
        description: 'Intense therapeutic massage targeting deep layers of muscle tissue for chronic pain relief.',
        category: 'massage',
        durationMinutes: 60,
        price: 4000,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 3,
      },
      {
        id: uuid('spa-4'),
        tenantId,
        propertyId,
        name: 'Balinese Massage',
        description: 'A combination of gentle stretches, acupressure, and aromatherapy oils for deep relaxation.',
        category: 'massage',
        durationMinutes: 90,
        price: 5500,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 4,
      },
      {
        id: uuid('spa-5'),
        tenantId,
        propertyId,
        name: 'Gold Facial',
        description: 'Luxury 24K gold-infused facial treatment for radiant, youthful skin. Includes cleansing, exfoliation, and gold mask.',
        category: 'facial',
        durationMinutes: 45,
        price: 3000,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 5,
      },
      {
        id: uuid('spa-6'),
        tenantId,
        propertyId,
        name: 'Aromatherapy Facial',
        description: 'Relaxing facial using essential oils tailored to your skin type for a natural glow.',
        category: 'facial',
        durationMinutes: 45,
        price: 2500,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 6,
      },
      {
        id: uuid('spa-7'),
        tenantId,
        propertyId,
        name: 'Coffee Body Scrub',
        description: 'Invigorating full body scrub using organic coffee grounds and coconut oil to exfoliate and rejuvenate skin.',
        category: 'body',
        durationMinutes: 45,
        price: 2800,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 7,
      },
      {
        id: uuid('spa-8'),
        tenantId,
        propertyId,
        name: 'Hot Stone Therapy',
        description: 'Heated basalt stones placed on key energy points combined with massage for ultimate relaxation and pain relief.',
        category: 'wellness',
        durationMinutes: 75,
        price: 5000,
        currency: 'INR',
        maxGuests: 1,
        isActive: true,
        sortOrder: 8,
      },
    ],
  });

  // 7. SpaTherapist - 3 therapists
  await prisma.spaTherapist.createMany({
    data: [
      {
        id: uuid('therapist-1'),
        tenantId,
        propertyId,
        name: 'Priyanka Mukherjee',
        phone: '+91-9832012345',
        email: 'priyanka.m@royalstay.in',
        specializations: JSON.stringify(['massage', 'wellness']),
        certifications: JSON.stringify(['CIDESCO Certified', 'Ayurveda Level 2']),
        commissionRate: 20,
        rating: 4.9,
        status: 'available',
      },
      {
        id: uuid('therapist-2'),
        tenantId,
        propertyId,
        name: 'Sourav Dey',
        phone: '+91-9832023456',
        email: 'sourav.d@royalstay.in',
        specializations: JSON.stringify(['massage', 'body']),
        certifications: JSON.stringify(['CIBTAC Diploma', 'Sports Massage Level 3']),
        commissionRate: 18,
        rating: 4.7,
        status: 'available',
      },
      {
        id: uuid('therapist-3'),
        tenantId,
        propertyId,
        name: 'Nandini Pal',
        phone: '+91-9832034567',
        email: 'nandini.p@royalstay.in',
        specializations: JSON.stringify(['facial', 'beauty', 'wellness']),
        certifications: JSON.stringify(['VLCC Certified', 'CIDESCO Esthetics']),
        commissionRate: 22,
        rating: 4.8,
        status: 'available',
      },
    ],
  });

  // 8. SpaAppointment - 5 appointments linked to guests/bookings
  await prisma.spaAppointment.createMany({
    data: [
      {
        id: uuid('spaapt-1'),
        tenantId,
        propertyId,
        treatmentId: uuid('spa-2'),
        therapistId: uuid('therapist-1'),
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        folioId: uuid('folio-1'),
        startTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 11.25 * 60 * 60 * 1000),
        status: 'confirmed',
        price: 4500,
        currency: 'INR',
        specialRequests: 'Guest prefers female therapist. Warm sesame oil only.',
      },
      {
        id: uuid('spaapt-2'),
        tenantId,
        propertyId,
        treatmentId: uuid('spa-5'),
        therapistId: uuid('therapist-3'),
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        startTime: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 14.75 * 60 * 60 * 1000),
        status: 'scheduled',
        price: 3000,
        currency: 'INR',
        specialRequests: 'Guest has sensitive skin. Use hypoallergenic products.',
      },
      {
        id: uuid('spaapt-3'),
        tenantId,
        propertyId,
        treatmentId: uuid('spa-8'),
        therapistId: uuid('therapist-2'),
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        folioId: uuid('folio-2'),
        startTime: new Date(today.getTime() + 0.5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 0.5 * 24 * 60 * 60 * 1000 + 17.25 * 60 * 60 * 1000),
        status: 'confirmed',
        price: 5000,
        currency: 'INR',
        notes: 'VIP Platinum guest. Complimentary herbal tea post-treatment.',
      },
      {
        id: uuid('spaapt-4'),
        tenantId,
        propertyId,
        treatmentId: uuid('spa-1'),
        therapistId: uuid('therapist-1'),
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        folioId: uuid('folio-4'),
        startTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        status: 'confirmed',
        price: 3500,
        currency: 'INR',
      },
      {
        id: uuid('spaapt-5'),
        tenantId,
        propertyId,
        treatmentId: uuid('spa-7'),
        therapistId: uuid('therapist-2'),
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 11.75 * 60 * 60 * 1000),
        status: 'completed',
        price: 2800,
        currency: 'INR',
        notes: 'Treatment completed. Guest was very satisfied.',
      },
    ],
  });

  // ============================================================
  // EVENTS MODULE
  // ============================================================
  console.log('Seeding Events module...');

  // 9. EventResource - 8 resources for existing events
  await prisma.eventResource.createMany({
    data: [
      // Durga Puja Gala Dinner resources
      { id: uuid('evres-1'), eventId: uuid('event-1'), name: 'Stage and Lighting Setup', category: 'av', description: 'LED stage with traditional Durga backdrop and ambient lighting', quantity: 1, unitPrice: 35000, totalAmount: 35000, vendorId: uuid('vendor-3'), vendorName: 'Tech Solutions India', status: 'confirmed', setupTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000), teardownTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000) },
      { id: uuid('evres-2'), eventId: uuid('event-1'), name: 'Sound System', category: 'av', description: 'Professional PA system with 8 speakers and wireless microphones', quantity: 1, unitPrice: 15000, totalAmount: 15000, vendorId: uuid('vendor-3'), vendorName: 'Tech Solutions India', status: 'confirmed', setupTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000) },
      { id: uuid('evres-3'), eventId: uuid('event-1'), name: 'Traditional Floor Seating (150 pax)', category: 'decoration', description: 'Individual mattress with cushions and covers for traditional Bengali floor seating', quantity: 150, unitPrice: 200, totalAmount: 30000, vendorName: 'Kolkata Decorators', status: 'confirmed' },
      // Corporate Workshop resources
      { id: uuid('evres-4'), eventId: uuid('event-2'), name: 'Projector and Screen', category: 'av', description: '4K projector with 120-inch motorized screen', quantity: 2, unitPrice: 5000, totalAmount: 10000, status: 'confirmed', setupTime: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000) },
      { id: uuid('evres-5'), eventId: uuid('event-2'), name: 'Classroom Setup (40 pax)', category: 'decoration', description: 'Tables and chairs in classroom arrangement with power strips', quantity: 40, unitPrice: 150, totalAmount: 6000, status: 'confirmed' },
      { id: uuid('evres-6'), eventId: uuid('event-2'), name: 'High-Speed WiFi Setup', category: 'av', description: 'Dedicated WiFi access point with 100 Mbps for workshop participants', quantity: 1, unitPrice: 8000, totalAmount: 8000, vendorId: uuid('vendor-3'), vendorName: 'Tech Solutions India', status: 'confirmed' },
      // Wedding Reception resources
      { id: uuid('evres-7'), eventId: uuid('event-3'), name: 'Mandap Decoration', category: 'decoration', description: 'Traditional Bengali wedding mandap with flowers and draping', quantity: 1, unitPrice: 85000, totalAmount: 85000, vendorName: 'Bengali Wedding Decorators', status: 'pending' },
      { id: uuid('evres-8'), eventId: uuid('event-3'), name: 'DJ and Live Band', category: 'av', description: 'DJ for cocktail hour and live Rabindra Sangeet band for reception', quantity: 1, unitPrice: 45000, totalAmount: 45000, vendorName: 'Kolkata Music Events', status: 'confirmed' },
    ],
  });

  // 10. BanquetEventOrder - 3 BEOs linked to existing events
  await prisma.banquetEventOrder.createMany({
    data: [
      {
        id: uuid('beo-1'),
        tenantId,
        propertyId,
        eventId: uuid('event-1'),
        orderNumber: 'BEO-2024-001',
        clientName: 'Royal Stay Events Team',
        clientContact: '+91-33-40012350',
        clientEmail: 'events@royalstay.in',
        eventType: 'banquet',
        setupStyle: 'banquet',
        expectedPax: 150,
        functionDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000),
        menuNotes: 'Traditional Bengali multi-course dinner. Include vegetarian and non-vegetarian options. No beef or pork.',
        beverageNotes: 'IMFL brands, premium whiskey, wine selection, and soft drinks. 3 cocktails on the house.',
        avRequirements: JSON.stringify({ projector: false, microphone: true, speakers: true, lighting: 'ambient+dj' }),
        specialInstructions: 'VIP table for hotel management near the stage. Flower arrangements with Rajanigandha and marigold.',
        status: 'confirmed',
        totalAmount: 120000,
        depositAmount: 25000,
        depositPaid: 25000,
        approvedBy: uuid('user-1'),
        approvedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('beo-2'),
        tenantId,
        propertyId,
        eventId: uuid('event-2'),
        orderNumber: 'BEO-2024-002',
        clientName: 'Amit Sharma - Tech Solutions',
        clientContact: '+91-33-24789012',
        clientEmail: 'amit@techsolutions.in',
        clientPhone: '+91-33-24789012',
        eventType: 'conference',
        setupStyle: 'classroom',
        expectedPax: 40,
        functionDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
        menuNotes: 'Buffet lunch with North Indian and Continental options. Chai and snacks during breaks.',
        beverageNotes: 'Tea, coffee, and mineral water. No alcohol.',
        avRequirements: JSON.stringify({ projector: 2, microphones: 4, whiteboards: 2, internet: '100Mbps' }),
        specialInstructions: 'Name badges for all participants. Registration desk near entrance. Notepads and pens on each desk.',
        status: 'confirmed',
        totalAmount: 48000,
        depositAmount: 12000,
        depositPaid: 12000,
        approvedBy: uuid('user-1'),
        approvedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: uuid('beo-3'),
        tenantId,
        propertyId,
        eventId: uuid('event-3'),
        orderNumber: 'BEO-2024-003',
        clientName: 'Debashis Banerjee',
        clientContact: '+91-9830098765',
        clientEmail: 'debashis.b@email.com',
        clientPhone: '+91-9830098765',
        eventType: 'wedding',
        setupStyle: 'banquet',
        expectedPax: 500,
        functionDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 60 * 1000),
        menuNotes: 'Traditional Bengali wedding feast - 12 item vegetarian and 16 item non-vegetarian spread. Must include Kosha Mangsho, Shorshe Ilish, and Mishti Doi.',
        beverageNotes: 'Premium bar with IMFL brands, single malt whiskey, wine, beer, and juices. 5 signature cocktails.',
        avRequirements: JSON.stringify({ projector: false, microphone: true, speakers: true, lighting: 'wedding', dj: true, live_band: true }),
        specialInstructions: 'Separate dining area for 100 VIP guests. Valet parking for all guests. Bridal suite available from noon.',
        status: 'draft',
        totalAmount: 750000,
        depositAmount: 200000,
        depositPaid: 200000,
      },
    ],
  });

  // 11. BEOItem - 12 items across the BEOs
  await prisma.bEOItem.createMany({
    data: [
      // BEO-1: Durga Puja Gala
      { id: uuid('beoitem-1'), orderId: uuid('beo-1'), category: 'food', description: 'Traditional Bengali Dinner Buffet (150 pax) - Veg & Non-Veg', quantity: 150, unitPrice: 500, totalPrice: 75000, sortOrder: 1 },
      { id: uuid('beoitem-2'), orderId: uuid('beo-1'), category: 'beverage', description: 'Premium IMFL Bar Package (150 pax)', quantity: 150, unitPrice: 200, totalPrice: 30000, sortOrder: 2 },
      { id: uuid('beoitem-3'), orderId: uuid('beo-1'), category: 'food', description: 'Welcome Drinks - Aam Pora Shorbot & Gondhoraj Mojito', quantity: 150, unitPrice: 50, totalPrice: 7500, sortOrder: 3 },
      { id: uuid('beoitem-4'), orderId: uuid('beo-1'), category: 'decoration', description: 'Floral Centerpieces - Rajanigandha & Marigold (20 tables)', quantity: 20, unitPrice: 375, totalPrice: 7500, sortOrder: 4 },
      // BEO-2: Corporate Workshop
      { id: uuid('beoitem-5'), orderId: uuid('beo-2'), category: 'food', description: 'Buffet Lunch - North Indian & Continental (40 pax)', quantity: 40, unitPrice: 600, totalPrice: 24000, sortOrder: 1 },
      { id: uuid('beoitem-6'), orderId: uuid('beo-2'), category: 'beverage', description: 'Tea, Coffee & Mineral Water - Full Day Package (40 pax)', quantity: 40, unitPrice: 100, totalPrice: 4000, sortOrder: 2 },
      { id: uuid('beoitem-7'), orderId: uuid('beo-2'), category: 'food', description: 'High Tea Snacks - Morning & Evening (40 pax)', quantity: 80, unitPrice: 75, totalPrice: 6000, sortOrder: 3 },
      { id: uuid('beoitem-8'), orderId: uuid('beo-2'), category: 'staffing', description: 'Wait Staff - 4 attendants for 8 hours', quantity: 4, unitPrice: 1500, totalPrice: 6000, sortOrder: 4 },
      { id: uuid('beoitem-9'), orderId: uuid('beo-2'), category: 'av', description: 'AV Technician - Full Day Support', quantity: 1, unitPrice: 4000, totalPrice: 4000, sortOrder: 5 },
      { id: uuid('beoitem-10'), orderId: uuid('beo-2'), category: 'decoration', description: 'Name Badges and Welcome Kits', quantity: 40, unitPrice: 100, totalPrice: 4000, sortOrder: 6 },
      // BEO-3: Wedding (draft items)
      { id: uuid('beoitem-11'), orderId: uuid('beo-3'), category: 'food', description: 'Traditional Bengali Wedding Feast (500 pax) - Full Spread', quantity: 500, unitPrice: 1200, totalPrice: 600000, sortOrder: 1, notes: 'Subject to final menu confirmation' },
      { id: uuid('beoitem-12'), orderId: uuid('beo-3'), category: 'beverage', description: 'Premium Bar Package (500 pax)', quantity: 500, unitPrice: 250, totalPrice: 125000, sortOrder: 2, notes: '5 signature cocktails included' },
    ],
  });

  // ============================================================
  // RESORT MODULE
  // ============================================================
  console.log('Seeding Resort module...');

  // 12. GolfCourse - 1 course
  await prisma.golfCourse.createMany({
    data: [
      {
        id: uuid('golf-1'),
        tenantId,
        propertyId,
        name: 'Royal Greens 18-Hole Championship Course',
        description: 'A beautifully manicured 18-hole championship golf course set amidst lush tropical greenery with water features. Designed to challenge golfers of all skill levels.',
        holes: 18,
        par: 72,
        yardage: 6850,
        difficulty: 'championship',
        facilities: JSON.stringify({ pro_shop: true, clubhouse: true, driving_range: true, putting_green: true, golf_cart_rental: true, locker_room: true, restaurant: true, swimming_pool: true }),
        isActive: true,
      },
    ],
  });

  // 13. GolfTeeTime - 5 tee times
  await prisma.golfTeeTime.createMany({
    data: [
      {
        id: uuid('tee-1'),
        tenantId,
        courseId: uuid('golf-1'),
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        players: 2,
        maxPlayers: 4,
        holes: 18,
        greenFee: 5000,
        cartFee: 1500,
        clubRentalFee: 1000,
        totalAmount: 7500,
        status: 'reserved',
        guestName: 'Rahul Banerjee',
        guestPhone: '+91-9830034567',
        notes: 'VIP Platinum guest. Complimentary golf cart upgrade.',
      },
      {
        id: uuid('tee-2'),
        tenantId,
        courseId: uuid('golf-1'),
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 7.5 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 11.5 * 60 * 60 * 1000),
        players: 4,
        maxPlayers: 4,
        holes: 18,
        greenFee: 5000,
        cartFee: 3000,
        clubRentalFee: 2000,
        totalAmount: 20000,
        status: 'reserved',
        guestName: 'Amit Mukherjee',
        guestPhone: '+91-9830012345',
      },
      {
        id: uuid('tee-3'),
        tenantId,
        courseId: uuid('golf-1'),
        date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        players: 0,
        maxPlayers: 4,
        holes: 18,
        greenFee: 5000,
        status: 'available',
      },
      {
        id: uuid('tee-4'),
        tenantId,
        courseId: uuid('golf-1'),
        guestId: uuid('guest-5'),
        date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000 + 6.5 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000),
        players: 3,
        maxPlayers: 4,
        holes: 18,
        greenFee: 5000,
        cartFee: 2250,
        totalAmount: 17250,
        status: 'reserved',
        guestName: 'Vikram Singh',
        guestPhone: '+91-9830056789',
      },
      {
        id: uuid('tee-5'),
        tenantId,
        courseId: uuid('golf-1'),
        date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000),
        endTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        players: 2,
        maxPlayers: 4,
        holes: 18,
        greenFee: 5000,
        cartFee: 1500,
        totalAmount: 6500,
        status: 'completed',
      },
    ],
  });

  // 14. GolfMembership - 2 memberships
  await prisma.golfMembership.createMany({
    data: [
      {
        id: uuid('golfmem-1'),
        tenantId,
        propertyId,
        guestId: uuid('guest-3'),
        membershipType: 'annual',
        name: 'Platinum Golf Membership',
        startDate: new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
        monthlyFee: 5000,
        joiningFee: 50000,
        totalPaid: 80000,
        status: 'active',
        autoRenew: true,
        benefits: JSON.stringify({ complimentary_rounds: 4, cart_discount: 25, locker: true, clubhouse_access: true, priority_tee_times: true, guest_rounds: 2 }),
        notes: 'VIP Platinum member. Lifetime access to clubhouse facilities.',
      },
      {
        id: uuid('golfmem-2'),
        tenantId,
        propertyId,
        guestId: uuid('guest-1'),
        membershipType: 'annual',
        name: 'Gold Golf Membership',
        startDate: new Date(today.getTime() - 3 * 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 9 * 30 * 24 * 60 * 60 * 1000),
        monthlyFee: 3000,
        joiningFee: 25000,
        totalPaid: 34000,
        status: 'active',
        autoRenew: false,
        benefits: JSON.stringify({ complimentary_rounds: 2, cart_discount: 15, locker: true, clubhouse_access: true }),
      },
    ],
  });

  // 15. CasinoTable - 4 tables
  await prisma.casinoTable.createMany({
    data: [
      {
        id: uuid('casino-1'),
        tenantId,
        propertyId,
        name: 'Royal Flush',
        gameType: 'poker',
        tableNumber: 1,
        minBet: 5000,
        maxBet: 100000,
        status: 'open',
        dealerName: 'Ravi Shankar',
        isActive: true,
      },
      {
        id: uuid('casino-2'),
        tenantId,
        propertyId,
        name: 'Blackjack Royale',
        gameType: 'blackjack',
        tableNumber: 2,
        minBet: 2000,
        maxBet: 50000,
        status: 'open',
        dealerName: 'Sunil Verma',
        isActive: true,
      },
      {
        id: uuid('casino-3'),
        tenantId,
        propertyId,
        name: 'Lucky Roulette',
        gameType: 'roulette',
        tableNumber: 3,
        minBet: 1000,
        maxBet: 25000,
        status: 'open',
        dealerName: 'Meera Kapoor',
        isActive: true,
      },
      {
        id: uuid('casino-4'),
        tenantId,
        propertyId,
        name: 'Baccarat Elite',
        gameType: 'baccarat',
        tableNumber: 4,
        minBet: 10000,
        maxBet: 500000,
        status: 'reserved',
        dealerName: 'Arjun Nair',
        isActive: true,
      },
    ],
  });

  // 16. CasinoTransaction - 8 transactions
  await prisma.casinoTransaction.createMany({
    data: [
      { id: uuid('casino txn-1'), tenantId, tableId: uuid('casino-1'), guestId: uuid('guest-3'), folioId: uuid('folio-2'), bookingId: uuid('booking-2'), transactionType: 'chip_buy', amount: 50000, currency: 'INR', chipColor: 'black', createdAt: new Date(today.getTime() - 12 * 60 * 60 * 1000) },
      { id: uuid('casino txn-2'), tenantId, tableId: uuid('casino-1'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), transactionType: 'bet', amount: 10000, currency: 'INR', chipColor: 'black', createdAt: new Date(today.getTime() - 11.5 * 60 * 60 * 1000) },
      { id: uuid('casino txn-3'), tenantId, tableId: uuid('casino-1'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), transactionType: 'win', amount: 25000, currency: 'INR', chipColor: 'black', createdAt: new Date(today.getTime() - 11 * 60 * 60 * 1000) },
      { id: uuid('casino txn-4'), tenantId, tableId: uuid('casino-2'), guestId: uuid('guest-1'), folioId: uuid('folio-1'), bookingId: uuid('booking-1'), transactionType: 'chip_buy', amount: 20000, currency: 'INR', chipColor: 'green', createdAt: new Date(today.getTime() - 8 * 60 * 60 * 1000) },
      { id: uuid('casino txn-5'), tenantId, tableId: uuid('casino-2'), guestId: uuid('guest-1'), bookingId: uuid('booking-1'), transactionType: 'bet', amount: 5000, currency: 'INR', chipColor: 'green', createdAt: new Date(today.getTime() - 7.5 * 60 * 60 * 1000) },
      { id: uuid('casino txn-6'), tenantId, tableId: uuid('casino-3'), guestId: uuid('guest-5'), folioId: uuid('folio-4'), bookingId: uuid('booking-4'), transactionType: 'chip_buy', amount: 15000, currency: 'INR', chipColor: 'red', createdAt: new Date(today.getTime() - 5 * 60 * 60 * 1000) },
      { id: uuid('casino txn-7'), tenantId, tableId: uuid('casino-3'), guestId: uuid('guest-5'), bookingId: uuid('booking-4'), transactionType: 'win', amount: 35000, currency: 'INR', chipColor: 'red', createdAt: new Date(today.getTime() - 4.5 * 60 * 60 * 1000) },
      { id: uuid('casino txn-8'), tenantId, tableId: uuid('casino-1'), guestId: uuid('guest-3'), bookingId: uuid('booking-2'), transactionType: 'tip', amount: 2000, currency: 'INR', chipColor: 'black', createdAt: new Date(today.getTime() - 10 * 60 * 60 * 1000) },
    ],
  });

  // 17. TimeshareUnit - 3 units
  await prisma.timeshareUnit.createMany({
    data: [
      {
        id: uuid('ts-unit-1'),
        tenantId,
        propertyId,
        unitNumber: 'TS-A101',
        roomTypeId: uuid('roomtype-2'),
        seasonType: 'fixed_week',
        weekNumber: 5,
        pointsValue: 2500,
        usageType: 'fractional',
        isActive: true,
      },
      {
        id: uuid('ts-unit-2'),
        tenantId,
        propertyId,
        unitNumber: 'TS-B202',
        roomTypeId: uuid('roomtype-3'),
        seasonType: 'seasonal',
        weekNumber: 45,
        pointsValue: 4000,
        usageType: 'fractional',
        isActive: true,
      },
      {
        id: uuid('ts-unit-3'),
        tenantId,
        propertyId,
        unitNumber: 'TS-C303',
        roomTypeId: uuid('roomtype-3'),
        seasonType: 'floating',
        pointsValue: 3500,
        usageType: 'points',
        isActive: true,
      },
    ],
  });

  // 18. TimeshareOwnership - 3 ownerships
  await prisma.timeshareOwnership.createMany({
    data: [
      {
        id: uuid('ts-owner-1'),
        tenantId,
        unitId: uuid('ts-unit-1'),
        ownerId: uuid('guest-3'),
        ownerName: 'Rahul Banerjee',
        ownerEmail: 'rahul.b@email.com',
        ownerPhone: '+91-9830034567',
        startDate: new Date(today.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 13 * 365 * 24 * 60 * 60 * 1000),
        purchasePrice: 850000,
        annualMf: 35000,
        status: 'active',
        notes: 'Fixed week 5 ownership. VIP Platinum member. Auto-renewal enabled.',
      },
      {
        id: uuid('ts-owner-2'),
        tenantId,
        unitId: uuid('ts-unit-2'),
        ownerId: uuid('guest-1'),
        ownerName: 'Amit Mukherjee',
        ownerEmail: 'amit.m@email.com',
        ownerPhone: '+91-9830012345',
        startDate: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 14 * 365 * 24 * 60 * 60 * 1000),
        purchasePrice: 1200000,
        annualMf: 55000,
        status: 'active',
        notes: 'Seasonal ownership in peak winter weeks. Executive Suite category.',
      },
      {
        id: uuid('ts-owner-3'),
        tenantId,
        unitId: uuid('ts-unit-3'),
        ownerName: 'Deepak Roy Chowdhury',
        ownerEmail: 'deepak.rc@email.com',
        ownerPhone: '+91-9830099888',
        startDate: new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 5 * 365 * 24 * 60 * 60 * 1000),
        purchasePrice: 650000,
        annualMf: 28000,
        status: 'active',
        notes: 'Points-based ownership. 3500 points per year redeemable across properties.',
      },
    ],
  });

  // ============================================================
  // POS MODULE
  // ============================================================
  console.log('Seeding POS module...');

  // 19. Recipe - 6 recipes for existing menu items
  await prisma.recipe.createMany({
    data: [
      {
        id: uuid('recipe-1'),
        tenantId,
        menuItemId: uuid('menu-5'),
        instructions: '1. Marinate chicken with yogurt, ginger-garlic paste, and spices for 2 hours. 2. Cook in tandoor until charred. 3. Prepare makhani gravy with tomatoes, cream, and butter. 4. Simmer chicken in gravy for 15 minutes. 5. Finish with kasuri methi and fresh cream.',
        prepTime: 30,
        cookTime: 25,
        yield: 4,
        costPerServing: 95,
      },
      {
        id: uuid('recipe-2'),
        tenantId,
        menuItemId: uuid('menu-2'),
        instructions: '1. Cut paneer into cubes and marinate with hung curd, tikka paste, and oil for 1 hour. 2. Thread onto skewers with bell peppers and onions. 3. Cook in tandoor at high heat for 8-10 minutes, turning once. 4. Serve with mint chutney.',
        prepTime: 20,
        cookTime: 10,
        yield: 2,
        costPerServing: 65,
      },
      {
        id: uuid('recipe-3'),
        tenantId,
        menuItemId: uuid('menu-6'),
        instructions: '1. Soak whole black urad dal overnight. 2. Pressure cook with kidney beans for 30 minutes. 3. Prepare tadka with butter, cumin, and spices. 4. Add cooked dal to gravy and simmer on low heat for 2 hours. 5. Finish with fresh cream.',
        prepTime: 480,
        cookTime: 120,
        yield: 6,
        costPerServing: 42,
      },
      {
        id: uuid('recipe-4'),
        tenantId,
        menuItemId: uuid('menu-8'),
        instructions: '1. Wash and soak basmati rice for 30 minutes. 2. Prepare biryani masala with whole spices. 3. Parboil rice with whole spices. 4. Layer rice and vegetable masala in handi. 5. Dum cook on low heat with saffron milk for 20 minutes.',
        prepTime: 40,
        cookTime: 35,
        yield: 4,
        costPerServing: 55,
      },
      {
        id: uuid('recipe-5'),
        tenantId,
        menuItemId: uuid('menu-9'),
        instructions: '1. Prepare chhena (cottage cheese) by curdling full-fat milk. 2. Knead chhena until smooth, shape into balls. 3. Prepare sugar syrup with cardamom. 4. Simmer balls in syrup for 15 minutes on medium heat. 5. Cool and serve at room temperature.',
        prepTime: 30,
        cookTime: 15,
        yield: 8,
        costPerServing: 18,
      },
      {
        id: uuid('recipe-6'),
        tenantId,
        menuItemId: uuid('menu-7'),
        instructions: '1. Clean and marinate rohu fish with turmeric and salt for 15 minutes. 2. Shallow fry fish pieces until golden. 3. Prepare curry base with mustard paste, poppy seed paste, and green chilies. 4. Add fish to simmering gravy and cook for 10 minutes. 5. Finish with mustard oil tempering.',
        prepTime: 25,
        cookTime: 20,
        yield: 3,
        costPerServing: 85,
      },
    ],
  });

  // 20. RecipeIngredient - 20+ ingredients across recipes
  await prisma.recipeIngredient.createMany({
    data: [
      // Butter Chicken ingredients (recipe-1)
      { id: uuid('ri-1'), tenantId, recipeId: uuid('recipe-1'), name: 'Chicken Breast (boneless)', quantity: 500, unit: 'g', costPerUnit: 0.14, sortOrder: 1 },
      { id: uuid('ri-2'), tenantId, recipeId: uuid('recipe-1'), name: 'Greek Yogurt', quantity: 200, unit: 'g', costPerUnit: 0.03, sortOrder: 2 },
      { id: uuid('ri-3'), tenantId, recipeId: uuid('recipe-1'), name: 'Tomato Puree', quantity: 400, unit: 'g', costPerUnit: 0.02, sortOrder: 3 },
      { id: uuid('ri-4'), tenantId, recipeId: uuid('recipe-1'), name: 'Fresh Cream', quantity: 150, unit: 'ml', costPerUnit: 0.04, sortOrder: 4 },
      { id: uuid('ri-5'), tenantId, recipeId: uuid('recipe-1'), name: 'Butter', quantity: 80, unit: 'g', costPerUnit: 0.05, sortOrder: 5 },
      // Paneer Tikka ingredients (recipe-2)
      { id: uuid('ri-6'), tenantId, recipeId: uuid('recipe-2'), name: 'Paneer (cottage cheese)', quantity: 300, unit: 'g', costPerUnit: 0.12, sortOrder: 1 },
      { id: uuid('ri-7'), tenantId, recipeId: uuid('recipe-2'), name: 'Bell Peppers (mixed)', quantity: 150, unit: 'g', costPerUnit: 0.03, sortOrder: 2 },
      { id: uuid('ri-8'), tenantId, recipeId: uuid('recipe-2'), name: 'Hung Curd', quantity: 100, unit: 'g', costPerUnit: 0.04, sortOrder: 3 },
      { id: uuid('ri-9'), tenantId, recipeId: uuid('recipe-2'), name: 'Tikka Masala Paste', quantity: 30, unit: 'g', costPerUnit: 0.15, sortOrder: 4 },
      // Dal Makhani ingredients (recipe-3)
      { id: uuid('ri-10'), tenantId, recipeId: uuid('recipe-3'), name: 'Whole Black Urad Dal', quantity: 250, unit: 'g', costPerUnit: 0.05, sortOrder: 1 },
      { id: uuid('ri-11'), tenantId, recipeId: uuid('recipe-3'), name: 'Kidney Beans (Rajma)', quantity: 100, unit: 'g', costPerUnit: 0.04, sortOrder: 2 },
      { id: uuid('ri-12'), tenantId, recipeId: uuid('recipe-3'), name: 'Butter', quantity: 60, unit: 'g', costPerUnit: 0.05, sortOrder: 3 },
      { id: uuid('ri-13'), tenantId, recipeId: uuid('recipe-3'), name: 'Fresh Cream', quantity: 100, unit: 'ml', costPerUnit: 0.04, sortOrder: 4 },
      // Vegetable Biryani ingredients (recipe-4)
      { id: uuid('ri-14'), tenantId, recipeId: uuid('recipe-4'), name: 'Basmati Rice', quantity: 400, unit: 'g', costPerUnit: 0.04, sortOrder: 1 },
      { id: uuid('ri-15'), tenantId, recipeId: uuid('recipe-4'), name: 'Mixed Vegetables', quantity: 300, unit: 'g', costPerUnit: 0.02, sortOrder: 2 },
      { id: uuid('ri-16'), tenantId, recipeId: uuid('recipe-4'), name: 'Saffron Strands', quantity: 0.5, unit: 'g', costPerUnit: 20.0, sortOrder: 3 },
      { id: uuid('ri-17'), tenantId, recipeId: uuid('recipe-4'), name: 'Ghee', quantity: 50, unit: 'ml', costPerUnit: 0.08, sortOrder: 4 },
      // Rasgulla ingredients (recipe-5)
      { id: uuid('ri-18'), tenantId, recipeId: uuid('recipe-5'), name: 'Full-Fat Milk', quantity: 2000, unit: 'ml', costPerUnit: 0.02, sortOrder: 1 },
      { id: uuid('ri-19'), tenantId, recipeId: uuid('recipe-5'), name: 'Sugar', quantity: 400, unit: 'g', costPerUnit: 0.015, sortOrder: 2 },
      { id: uuid('ri-20'), tenantId, recipeId: uuid('recipe-5'), name: 'Cardamom Pods', quantity: 4, unit: 'pcs', costPerUnit: 2.0, sortOrder: 3 },
      // Fish Curry ingredients (recipe-6)
      { id: uuid('ri-21'), tenantId, recipeId: uuid('recipe-6'), name: 'Rohu Fish Fillet', quantity: 500, unit: 'g', costPerUnit: 0.10, sortOrder: 1 },
      { id: uuid('ri-22'), tenantId, recipeId: uuid('recipe-6'), name: 'Mustard Paste', quantity: 40, unit: 'g', costPerUnit: 0.05, sortOrder: 2 },
      { id: uuid('ri-23'), tenantId, recipeId: uuid('recipe-6'), name: 'Poppy Seed Paste', quantity: 20, unit: 'g', costPerUnit: 0.08, sortOrder: 3 },
      { id: uuid('ri-24'), tenantId, recipeId: uuid('recipe-6'), name: 'Mustard Oil', quantity: 50, unit: 'ml', costPerUnit: 0.06, sortOrder: 4 },
    ],
  });

  // 21. MenuModifier - 4 modifiers
  await prisma.menuModifier.createMany({
    data: [
      {
        id: uuid('mod-1'),
        propertyId,
        name: 'Serving Size',
        selectionType: 'required',
        minSelections: 1,
        maxSelections: 1,
        isAvailable: true,
      },
      {
        id: uuid('mod-2'),
        propertyId,
        name: 'Spice Level',
        selectionType: 'required',
        minSelections: 1,
        maxSelections: 1,
        isAvailable: true,
      },
      {
        id: uuid('mod-3'),
        propertyId,
        name: 'Extras & Add-ons',
        selectionType: 'optional',
        minSelections: 0,
        maxSelections: 3,
        isAvailable: true,
      },
      {
        id: uuid('mod-4'),
        propertyId,
        name: 'Cooking Preference',
        selectionType: 'optional',
        minSelections: 0,
        maxSelections: 1,
        isAvailable: true,
      },
    ],
  });

  // 22. MenuModifierOption - 12+ options
  await prisma.menuModifierOption.createMany({
    data: [
      // Size options
      { id: uuid('modopt-1'), propertyId, modifierGroupId: uuid('mod-1'), name: 'Regular', priceAdjustment: 0, isAvailable: true, isDefault: true, sortOrder: 1 },
      { id: uuid('modopt-2'), propertyId, modifierGroupId: uuid('mod-1'), name: 'Large', priceAdjustment: 120, isAvailable: true, isDefault: false, sortOrder: 2 },
      { id: uuid('modopt-3'), propertyId, modifierGroupId: uuid('mod-1'), name: 'Sharing (2-3 persons)', priceAdjustment: 450, isAvailable: true, isDefault: false, sortOrder: 3 },
      // Spice level options
      { id: uuid('modopt-4'), propertyId, modifierGroupId: uuid('mod-2'), name: 'Mild', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('modopt-5'), propertyId, modifierGroupId: uuid('mod-2'), name: 'Medium', priceAdjustment: 0, isAvailable: true, isDefault: true, sortOrder: 2 },
      { id: uuid('modopt-6'), propertyId, modifierGroupId: uuid('mod-2'), name: 'Hot', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 3 },
      { id: uuid('modopt-7'), propertyId, modifierGroupId: uuid('mod-2'), name: 'Extra Hot (Bengali Style)', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 4 },
      // Extras options
      { id: uuid('modopt-8'), propertyId, modifierGroupId: uuid('mod-3'), name: 'Extra Cheese', priceAdjustment: 80, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('modopt-9'), propertyId, modifierGroupId: uuid('mod-3'), name: 'Garlic Bread (2 pcs)', priceAdjustment: 100, isAvailable: true, isDefault: false, sortOrder: 2 },
      { id: uuid('modopt-10'), propertyId, modifierGroupId: uuid('mod-3'), name: 'Raita (150ml)', priceAdjustment: 60, isAvailable: true, isDefault: false, sortOrder: 3 },
      // Cooking preference options
      { id: uuid('modopt-11'), propertyId, modifierGroupId: uuid('mod-4'), name: 'Less Oil', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('modopt-12'), propertyId, modifierGroupId: uuid('mod-4'), name: 'Jain (No Onion/Garlic)', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 2 },
      { id: uuid('modopt-13'), propertyId, modifierGroupId: uuid('mod-4'), name: 'Vegan (No Dairy)', priceAdjustment: 0, isAvailable: true, isDefault: false, sortOrder: 3 },
    ],
  });

  // 23. MenuVariant - 8 variants for existing menu items
  await prisma.menuVariant.createMany({
    data: [
      { id: uuid('variant-1'), propertyId, menuItemId: uuid('menu-5'), name: 'Boneless Butter Chicken', price: 480, sku: 'BC-BL', calories: 380, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('variant-2'), propertyId, menuItemId: uuid('menu-5'), name: 'Butter Chicken with Bone', price: 420, sku: 'BC-WB', calories: 420, isAvailable: true, isDefault: true, sortOrder: 0 },
      { id: uuid('variant-3'), propertyId, menuItemId: uuid('menu-8'), name: 'Chicken Biryani', price: 420, sku: 'BR-CHK', calories: 550, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('variant-4'), propertyId, menuItemId: uuid('menu-8'), name: 'Mutton Biryani', price: 550, sku: 'BR-MTN', calories: 580, isAvailable: true, isDefault: false, sortOrder: 2 },
      { id: uuid('variant-5'), propertyId, menuItemId: uuid('menu-8'), name: 'Vegetable Biryani (Regular)', price: 320, sku: 'BR-VEG', calories: 380, isAvailable: true, isDefault: true, sortOrder: 0 },
      { id: uuid('variant-6'), propertyId, menuItemId: uuid('menu-12'), name: 'Masala Chai (Hot)', price: 60, sku: 'CH-HOT', calories: 45, isAvailable: true, isDefault: true, sortOrder: 0 },
      { id: uuid('variant-7'), propertyId, menuItemId: uuid('menu-12'), name: 'Iced Masala Chai', price: 80, sku: 'CH-ICD', calories: 55, isAvailable: true, isDefault: false, sortOrder: 1 },
      { id: uuid('variant-8'), propertyId, menuItemId: uuid('menu-13'), name: 'Fresh Lime Soda - Sweet', price: 80, sku: 'LS-SWT', calories: 65, isAvailable: true, isDefault: true, sortOrder: 0 },
    ],
  });

  // 24. MenuBoard - 2 boards
  await prisma.menuBoard.createMany({
    data: [
      {
        id: uuid('board-1'),
        tenantId,
        propertyId,
        name: 'Ahaar - Main Restaurant Menu',
        description: 'Digital menu display for Ahaar, our signature multi-cuisine restaurant.',
        location: 'ahaar-restaurant',
        orientation: 'landscape',
        resolution: '1920x1080',
        theme: 'elegant',
        isActive: true,
      },
      {
        id: uuid('board-2'),
        tenantId,
        propertyId,
        name: 'Tiki Bar - Drinks & Snacks',
        description: 'Menu board for the rooftop Tiki Bar featuring cocktails and bar snacks.',
        location: 'tiki-bar-rooftop',
        orientation: 'portrait',
        resolution: '1080x1920',
        theme: 'casual',
        isActive: true,
      },
    ],
  });

  // 25. MenuBoardItem - 14 items on boards
  await prisma.menuBoardItem.createMany({
    data: [
      // Board 1: Ahaar Restaurant items
      { id: uuid('boarditem-1'), boardId: uuid('board-1'), menuItemId: uuid('menu-1'), name: 'Samosa', description: 'Crispy pastry filled with spiced potatoes and peas', price: 120, currency: 'INR', category: 'Starters', isAvailable: true, isFeatured: true, sortOrder: 1 },
      { id: uuid('boarditem-2'), boardId: uuid('board-1'), menuItemId: uuid('menu-2'), name: 'Paneer Tikka', description: 'Grilled cottage cheese with bell peppers and spices', price: 280, currency: 'INR', category: 'Starters', isAvailable: true, isFeatured: false, sortOrder: 2 },
      { id: uuid('boarditem-3'), boardId: uuid('board-1'), menuItemId: uuid('menu-3'), name: 'Chicken Tikka', description: 'Tender chicken marinated in yogurt and tandoor spices', price: 320, currency: 'INR', category: 'Starters', isAvailable: true, isFeatured: true, sortOrder: 3 },
      { id: uuid('boarditem-4'), boardId: uuid('board-1'), menuItemId: uuid('menu-5'), name: 'Butter Chicken', description: 'Creamy tomato-based curry with tender chicken', price: 420, currency: 'INR', category: 'Main Course', isAvailable: true, isFeatured: true, sortOrder: 4 },
      { id: uuid('boarditem-5'), boardId: uuid('board-1'), menuItemId: uuid('menu-6'), name: 'Dal Makhani', description: 'Creamy black lentils slow-cooked overnight', price: 280, currency: 'INR', category: 'Main Course', isAvailable: true, isFeatured: false, sortOrder: 5 },
      { id: uuid('boarditem-6'), boardId: uuid('board-1'), menuItemId: uuid('menu-7'), name: 'Bengali Fish Curry', description: 'Traditional Rohu fish in mustard gravy', price: 480, currency: 'INR', category: 'Main Course', isAvailable: true, isFeatured: true, sortOrder: 6 },
      { id: uuid('boarditem-7'), boardId: uuid('board-1'), menuItemId: uuid('menu-8'), name: 'Vegetable Biryani', description: 'Fragrant basmati rice with seasonal vegetables', price: 320, currency: 'INR', category: 'Main Course', isAvailable: true, isFeatured: false, sortOrder: 7 },
      { id: uuid('boarditem-8'), boardId: uuid('board-1'), menuItemId: uuid('menu-9'), name: 'Rasgulla', description: 'Soft cottage cheese balls in cardamom sugar syrup', price: 120, currency: 'INR', category: 'Desserts', isAvailable: true, isFeatured: true, sortOrder: 8 },
      { id: uuid('boarditem-9'), boardId: uuid('board-1'), menuItemId: uuid('menu-10'), name: 'Gulab Jamun', description: 'Deep-fried milk dumplings in rose-flavored syrup', price: 150, currency: 'INR', category: 'Desserts', isAvailable: true, isFeatured: false, sortOrder: 9 },
      { id: uuid('boarditem-10'), boardId: uuid('board-1'), menuItemId: uuid('menu-11'), name: 'Mishti Doi', description: 'Traditional Bengali sweet fermented yogurt', price: 100, currency: 'INR', category: 'Desserts', isAvailable: true, isFeatured: false, sortOrder: 10 },
      // Board 2: Tiki Bar items
      { id: uuid('boarditem-11'), boardId: uuid('board-2'), menuItemId: uuid('menu-12'), name: 'Masala Chai', description: 'Traditional Indian spiced tea with ginger and cardamom', price: 60, currency: 'INR', category: 'Hot Drinks', isAvailable: true, isFeatured: false, sortOrder: 1 },
      { id: uuid('boarditem-12'), boardId: uuid('board-2'), menuItemId: uuid('menu-13'), name: 'Fresh Lime Soda', description: 'Refreshing lime juice with soda water', price: 80, currency: 'INR', category: 'Coolers', isAvailable: true, isFeatured: false, sortOrder: 2 },
      { id: uuid('boarditem-13'), boardId: uuid('board-2'), menuItemId: uuid('menu-14'), name: 'Mango Lassi', description: 'Creamy yogurt drink blended with Alphonso mango', price: 120, currency: 'INR', category: 'Coolers', isAvailable: true, isFeatured: true, sortOrder: 3 },
      { id: uuid('boarditem-14'), boardId: uuid('board-2'), menuItemId: uuid('menu-4'), name: 'Vegetable Spring Roll', description: 'Crispy rolls stuffed with mixed vegetables', price: 180, currency: 'INR', category: 'Bar Snacks', isAvailable: true, isFeatured: false, sortOrder: 4 },
    ],
  });

  // 26. PosTerminal - 3 terminals
  await prisma.posTerminal.createMany({
    data: [
      {
        id: uuid('pos-1'),
        tenantId,
        propertyId,
        name: 'Ahaar Restaurant POS',
        terminalType: 'restaurant',
        location: 'Ground Floor - Main Restaurant',
        ipAddress: '192.168.1.101',
        lastSyncAt: new Date(today.getTime() - 5 * 60 * 1000),
        syncStatus: 'synced',
        offlineModeEnabled: true,
        offlineQueueCount: 0,
        isActive: true,
      },
      {
        id: uuid('pos-2'),
        tenantId,
        propertyId,
        name: 'Tiki Bar POS',
        terminalType: 'bar',
        location: 'Rooftop - Tiki Bar',
        ipAddress: '192.168.1.102',
        lastSyncAt: new Date(today.getTime() - 2 * 60 * 1000),
        syncStatus: 'synced',
        offlineModeEnabled: true,
        offlineQueueCount: 0,
        isActive: true,
      },
      {
        id: uuid('pos-3'),
        tenantId,
        propertyId,
        name: 'Room Service POS',
        terminalType: 'room_service',
        location: 'Kitchen - Room Service Station',
        ipAddress: '192.168.1.103',
        lastSyncAt: new Date(today.getTime() - 10 * 60 * 1000),
        syncStatus: 'synced',
        offlineModeEnabled: true,
        offlineQueueCount: 0,
        isActive: true,
      },
    ],
  });

  // 27. Reservation - 5 restaurant reservations
  await prisma.reservation.createMany({
    data: [
      {
        id: uuid('res-1'),
        propertyId,
        tableId: uuid('table-3'),
        guestId: uuid('guest-1'),
        guestName: 'Amit Mukherjee',
        guestPhone: '+91-9830012345',
        guestEmail: 'amit.m@email.com',
        partySize: 4,
        date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        time: '19:30',
        duration: 120,
        specialRequests: 'Birthday celebration. Please arrange a small cake.',
        occasion: 'birthday',
        status: 'confirmed',
        source: 'in_person',
      },
      {
        id: uuid('res-2'),
        propertyId,
        tableId: uuid('table-8'),
        guestId: uuid('guest-3'),
        guestName: 'Rahul Banerjee',
        guestPhone: '+91-9830034567',
        guestEmail: 'rahul.b@email.com',
        partySize: 6,
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        time: '20:00',
        duration: 150,
        specialRequests: 'VIP Platinum guest. Business dinner with partners. Prefer quiet corner.',
        status: 'confirmed',
        source: 'phone',
      },
      {
        id: uuid('res-3'),
        propertyId,
        tableId: uuid('table-5'),
        guestId: uuid('guest-5'),
        guestName: 'Vikram Singh',
        guestPhone: '+91-9830056789',
        guestEmail: 'vikram.s@email.com',
        partySize: 3,
        date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        time: '13:00',
        duration: 90,
        specialRequests: 'High chair needed for a toddler.',
        occasion: 'family',
        status: 'confirmed',
        source: 'app',
      },
      {
        id: uuid('res-4'),
        propertyId,
        tableId: uuid('table-6'),
        guestId: uuid('guest-2'),
        guestName: 'Sneha Gupta',
        guestPhone: '+91-9830023456',
        guestEmail: 'sneha.g@email.com',
        partySize: 2,
        date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        time: '12:30',
        duration: 90,
        specialRequests: 'Anniversary lunch. Patio seating preferred.',
        occasion: 'anniversary',
        status: 'confirmed',
        source: 'phone',
      },
      {
        id: uuid('res-5'),
        propertyId,
        tableId: uuid('table-9'),
        guestId: uuid('guest-4'),
        guestName: 'Pooja Saha',
        guestPhone: '+91-9830045678',
        guestEmail: 'pooja.s@email.com',
        partySize: 2,
        date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        time: '21:00',
        duration: 90,
        specialRequests: 'Late dinner after arrival.',
        status: 'confirmed',
        source: 'walk_in',
      },
    ],
  });

  // 28. TableMerge - 2 merges
  await prisma.tableMerge.createMany({
    data: [
      {
        id: uuid('merge-1'),
        tenantId,
        propertyId,
        tableIds: JSON.stringify([uuid('table-3'), uuid('table-4')]),
        partySize: 8,
        mergedAt: new Date(today.getTime() - 3 * 60 * 60 * 1000),
        status: 'merged',
      },
      {
        id: uuid('merge-2'),
        tenantId,
        propertyId,
        tableIds: JSON.stringify([uuid('table-5'), uuid('table-6')]),
        partySize: 10,
        mergedAt: new Date(today.getTime() - 1 * 60 * 60 * 1000),
        splitAt: new Date(today.getTime() - 0.5 * 60 * 60 * 1000),
        status: 'split',
      },
    ],
  });

  console.log('Supplemental seed data completed successfully!');
}
