import { NextRequest, NextResponse } from 'next/server';

// ─── Property config defaults ──────────────────────────────────────────────────
const defaultPropertyConfig = {
  propertyName: 'Grand Horizon Hotel',
  address: '123 Oceanfront Drive, Marina Bay, CA 90210',
  checkInTime: '3:00 PM',
  checkOutTime: '11:00 AM',
  wifiSSID: 'GrandHorizon-Guest',
  wifiPassword: 'Welcome2024!',
  parkingInfo: 'Complimentary self-parking in Lot B. Valet available for $25/night.',
  emergencyNumber: '911 / Front Desk: ext. 0',
  frontDeskLocation: 'Main Lobby, Ground Floor, near the Garden Entrance',
  elevatorAccess: 'Elevators located near the lobby restroom. Room floors: 2–8.',
  nearbyAmenities:
    'Beach (2 min walk), Marina Shopping Center (5 min), City Hospital (1.2 mi)',
  specialOffers:
    'Enjoy 10% off at our rooftop restaurant. Show your room key for the discount.',
  luggageStorage:
    'Complimentary luggage storage available at the Bell Desk until 6:00 PM.',
  airportShuttle:
    'Complimentary airport shuttle runs every 30 minutes from 5:00 AM–10:00 PM. Reserve at the front desk.',
  expressCheckout:
    'Express checkout is available via the in-room TV or our mobile app. Your folio will be emailed automatically.',
  feedbackLink: 'https://survey.grandhorizon.com',
};

type PropertyConfig = typeof defaultPropertyConfig;

interface BookingContext {
  guestName: string;
  confirmationCode: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  email: string;
}

// ─── Generate arrival instructions ─────────────────────────────────────────────
function generateArrival(
  config: PropertyConfig,
  booking: BookingContext
): Array<{ id: string; title: string; icon: string; content: string }> {
  return [
    {
      id: 'welcome',
      title: 'Welcome & Property Overview',
      icon: 'ConciergeBell',
      content: `Dear ${booking.guestName},

Welcome to ${config.propertyName}! We are delighted to have you as our guest.

Your reservation details:
  • Confirmation Code: ${booking.confirmationCode}
  • Room: ${booking.roomNumber} (${booking.roomType})
  • Check-in Date: ${booking.checkInDate}
  • Check-out Date: ${booking.checkOutDate}

Your check-in time is ${config.checkInTime}. If you arrive early, we will do our best to accommodate you based on room availability.

Property Address: ${config.address}`,
    },
    {
      id: 'parking',
      title: 'Parking Information',
      icon: 'Car',
      content: `${config.parkingInfo}

For GPS navigation, use: ${config.address}`,
    },
    {
      id: 'frontdesk',
      title: 'Front Desk Location',
      icon: 'MapPin',
      content: `Our front desk is located at: ${config.frontDeskLocation}

Please present a valid photo ID and the credit card used for booking at check-in.`,
    },
    {
      id: 'room-access',
      title: 'Room & Elevator Access',
      icon: 'Key',
      content: `Your room number is ${booking.roomNumber} (${booking.roomType}).

${config.elevatorAccess}

Room key cards are provided at check-in. Please keep your key card away from mobile phones and magnets to avoid demagnetization.

If your key card stops working, please visit the front desk for a replacement — available 24/7.`,
    },
    {
      id: 'wifi',
      title: 'WiFi Access',
      icon: 'Wifi',
      content: `Stay connected during your visit!

Network Name (SSID): ${config.wifiSSID}
Password: ${config.wifiPassword}

The WiFi password is also printed on the back of your room key card holder.`,
    },
    {
      id: 'emergency',
      title: 'Emergency Information',
      icon: 'Shield',
      content: `Emergency Numbers:
  • Police / Fire / Ambulance: ${config.emergencyNumber}
  • Hotel Front Desk (24/7): Dial 0 from any room phone
  • Hotel Security: Dial ext. 55 from any room phone

In case of fire, please use the nearest stairwell exit. Do not use elevators.
Emergency exits are marked with illuminated signs on every floor.`,
    },
    {
      id: 'amenities',
      title: 'Nearby Amenities',
      icon: 'Coffee',
      content: `${config.nearbyAmenities}

Hotel facilities available to you:
  • Fitness Center: Open 6:00 AM – 10:00 PM (Floor 2)
  • Swimming Pool & Sundeck: Open 7:00 AM – 9:00 PM (Roof Level)
  • Business Center: Open 24/7 (Ground Floor)
  • Rooftop Restaurant & Bar: 11:00 AM – 11:00 PM`,
    },
    {
      id: 'offers',
      title: 'Special Offers',
      icon: 'Star',
      content: `${config.specialOffers}

For more offers, scan the QR code in your room or ask the front desk.`,
    },
  ];
}

// ─── Generate departure instructions ──────────────────────────────────────────
function generateDeparture(
  config: PropertyConfig,
  booking: BookingContext
): Array<{ id: string; title: string; icon: string; content: string }> {
  return [
    {
      id: 'checkout-time',
      title: 'Check-out Time',
      icon: 'Clock',
      content: `Dear ${booking.guestName},

Your check-out time is ${config.checkOutTime} on ${booking.checkOutDate}.

Please ensure you vacate your room by the check-out time. Late check-out requests are subject to availability and may incur an additional charge of 50% of the nightly rate.

For early or late check-out arrangements, please contact the front desk at least 4 hours in advance.`,
    },
    {
      id: 'key-return',
      title: 'Key / Card Return Procedure',
      icon: 'Key',
      content: `Please return all room key cards to the front desk or drop them in the key return box located near the lobby exit.

Lost key cards will incur a replacement fee of $15 per card. Please check your wallet, bags, and room safe before departing.`,
    },
    {
      id: 'folio-review',
      title: 'Folio Review Reminder',
      icon: 'CreditCard',
      content: `Before you depart, please review your final folio (billing statement) at the front desk or via the in-room TV.

Your folio includes:
  • Room charges for ${booking.roomNumber} (${booking.roomType})
  • Any incidentals charged to your room
  • Deposits and pre-authorizations (released within 3–5 business days)

If you notice any discrepancies, please inform the front desk immediately so we can resolve them before your departure.`,
    },
    {
      id: 'luggage',
      title: 'Luggage Storage',
      icon: 'Luggage',
      content: `${config.luggageStorage}

After 6:00 PM, luggage storage is available for $10 per bag. All luggage is stored in a secure, monitored area.

Please collect a luggage claim ticket from the Bell Desk.`,
    },
    {
      id: 'shuttle',
      title: 'Airport Shuttle',
      icon: 'Bus',
      content: `${config.airportShuttle}

Estimated travel time: 25–35 minutes depending on traffic.

For private car or taxi arrangements, please ask the concierge.`,
    },
    {
      id: 'express-checkout',
      title: 'Express Checkout',
      icon: 'Sparkles',
      content: `${config.expressCheckout}

To use express checkout:
  1. Review your folio on the in-room TV or mobile app
  2. Confirm the charges are correct
  3. Select "Express Checkout" — your room key will be automatically deactivated
  4. Simply leave your key cards in the room or at the express drop box

An itemized receipt will be sent to ${booking.email}.`,
    },
    {
      id: 'feedback',
      title: 'Feedback & Survey',
      icon: 'MessageSquare',
      content: `We value your feedback! Your experience matters to us.

Please take a moment to complete our guest satisfaction survey:
  ${config.feedbackLink}

Your honest feedback helps us improve and continue delivering exceptional hospitality. As a thank-you, survey respondents receive a 5% discount code for their next stay.

We hope you had a wonderful stay at ${config.propertyName}. We look forward to welcoming you back!

Safe travels, ${booking.guestName}!`,
    },
  ];
}

// ─── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const config: PropertyConfig = {
      ...defaultPropertyConfig,
      ...(body.propertyConfig || {}),
    };

    const booking: BookingContext = {
      guestName: 'Guest',
      confirmationCode: 'N/A',
      roomNumber: 'TBD',
      roomType: 'Standard',
      checkInDate: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      checkOutDate: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000
      ).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      email: '',
      ...(body.booking || {}),
    };

    const arrival = generateArrival(config, booking);
    const departure = generateDeparture(config, booking);

    return NextResponse.json({
      success: true,
      data: { arrival, departure },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to generate instructions' } },
      { status: 500 }
    );
  }
}
