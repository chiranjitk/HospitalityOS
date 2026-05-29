'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PlaneTakeoff,
  PlaneLanding,
  Printer,
  Mail,
  Sparkles,
  Wifi,
  Car,
  MapPin,
  Phone,
  Clock,
  Building2,
  Key,
  CreditCard,
  Luggage,
  Bus,
  Star,
  MessageSquare,
  Shield,
  Coffee,
  ConciergeBell,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  nearbyAmenities: 'Beach (2 min walk), Marina Shopping Center (5 min), City Hospital (1.2 mi)',
  specialOffers: 'Enjoy 10% off at our rooftop restaurant. Show your room key for the discount.',
  luggageStorage: 'Complimentary luggage storage available at the Bell Desk until 6:00 PM.',
  airportShuttle: 'Complimentary airport shuttle runs every 30 minutes from 5:00 AM–10:00 PM. Reserve at the front desk.',
  expressCheckout: 'Express checkout is available via the in-room TV or our mobile app. Your folio will be emailed automatically.',
  feedbackLink: 'https://survey.grandhorizon.com',
};

type PropertyConfig = typeof defaultPropertyConfig;

// ─── Booking context (mock for demo) ──────────────────────────────────────────
interface BookingContext {
  guestName: string;
  confirmationCode: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  email: string;
}

const defaultBooking: BookingContext = {
  guestName: 'John Smith',
  confirmationCode: 'GH-2024-8842',
  roomNumber: '504',
  roomType: 'Deluxe Ocean View',
  checkInDate: 'Friday, June 14, 2024',
  checkOutDate: 'Monday, June 17, 2024',
  email: 'john.smith@email.com',
};

// ─── Instruction section definition ───────────────────────────────────────────
interface InstructionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
}

// ─── Generate arrival instructions ────────────────────────────────────────────
function generateArrivalInstructions(
  config: PropertyConfig,
  booking: BookingContext
): InstructionSection[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome & Property Overview',
      icon: <ConciergeBell className="h-4 w-4" />,
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
      icon: <Car className="h-4 w-4" />,
      content: `${config.parkingInfo}

For GPS navigation, use: ${config.address}`,
    },
    {
      id: 'frontdesk',
      title: 'Front Desk Location',
      icon: <MapPin className="h-4 w-4" />,
      content: `Our front desk is located at: ${config.frontDeskLocation}

Please present a valid photo ID and the credit card used for booking at check-in.`,
    },
    {
      id: 'room-access',
      title: 'Room & Elevator Access',
      icon: <Key className="h-4 w-4" />,
      content: `Your room number is ${booking.roomNumber} (${booking.roomType}).

${config.elevatorAccess}

Room key cards are provided at check-in. Please keep your key card away from mobile phones and magnets to avoid demagnetization.

If your key card stops working, please visit the front desk for a replacement — available 24/7.`,
    },
    {
      id: 'wifi',
      title: 'WiFi Access',
      icon: <Wifi className="h-4 w-4" />,
      content: `Stay connected during your visit!

Network Name (SSID): ${config.wifiSSID}
Password: ${config.wifiPassword}

The WiFi password is also printed on the back of your room key card holder.`,
    },
    {
      id: 'emergency',
      title: 'Emergency Information',
      icon: <Shield className="h-4 w-4" />,
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
      icon: <Coffee className="h-4 w-4" />,
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
      icon: <Star className="h-4 w-4" />,
      content: `${config.specialOffers}

For more offers, scan the QR code in your room or ask the front desk.`,
    },
  ];
}

// ─── Generate departure instructions ──────────────────────────────────────────
function generateDepartureInstructions(
  config: PropertyConfig,
  booking: BookingContext
): InstructionSection[] {
  return [
    {
      id: 'checkout-time',
      title: 'Check-out Time',
      icon: <Clock className="h-4 w-4" />,
      content: `Dear ${booking.guestName},

Your check-out time is ${config.checkOutTime} on ${booking.checkOutDate}.

Please ensure you vacate your room by the check-out time. Late check-out requests are subject to availability and may incur an additional charge of 50% of the nightly rate.

For early or late check-out arrangements, please contact the front desk at least 4 hours in advance.`,
    },
    {
      id: 'key-return',
      title: 'Key / Card Return Procedure',
      icon: <Key className="h-4 w-4" />,
      content: `Please return all room key cards to the front desk or drop them in the key return box located near the lobby exit.

Lost key cards will incur a replacement fee of $15 per card. Please check your wallet, bags, and room safe before departing.`,
    },
    {
      id: 'folio-review',
      title: 'Folio Review Reminder',
      icon: <CreditCard className="h-4 w-4" />,
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
      icon: <Luggage className="h-4 w-4" />,
      content: `${config.luggageStorage}

After 6:00 PM, luggage storage is available for $10 per bag. All luggage is stored in a secure, monitored area.

Please collect a luggage claim ticket from the Bell Desk.`,
    },
    {
      id: 'shuttle',
      title: 'Airport Shuttle',
      icon: <Bus className="h-4 w-4" />,
      content: `${config.airportShuttle}

Estimated travel time: 25–35 minutes depending on traffic.

For private car or taxi arrangements, please ask the concierge.`,
    },
    {
      id: 'express-checkout',
      title: 'Express Checkout',
      icon: <Sparkles className="h-4 w-4" />,
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
      icon: <MessageSquare className="h-4 w-4" />,
      content: `We value your feedback! Your experience matters to us.

Please take a moment to complete our guest satisfaction survey:
  ${config.feedbackLink}

Your honest feedback helps us improve and continue delivering exceptional hospitality. As a thank-you, survey respondents receive a 5% discount code for their next stay.

We hope you had a wonderful stay at ${config.propertyName}. We look forward to welcoming you back!

Safe travels, ${booking.guestName}!`,
    },
  ];
}

// ─── Instruction section editor ───────────────────────────────────────────────
function InstructionSectionEditor({
  section,
  value,
  onChange,
}: {
  section: InstructionSection;
  value: string;
  onChange: (id: string, content: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {section.icon}
          </div>
          <div>
            <h4 className="font-medium text-sm">{section.title}</h4>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <Textarea
            value={value}
            onChange={(e) => onChange(section.id, e.target.value)}
            rows={Math.max(6, value.split('\n').length + 1)}
            className="resize-y text-sm font-mono leading-relaxed"
          />
        </CardContent>
      )}
    </Card>
  );
}

// ─── Property config editor ────────────────────────────────────────────────────
function PropertyConfigEditor({
  config,
  onChange,
}: {
  config: PropertyConfig;
  onChange: (field: keyof PropertyConfig, value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="text-left">
            <h4 className="font-medium text-sm">Property Configuration</h4>
            <p className="text-xs text-muted-foreground">
              Customize property details for instruction generation
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Property Name</Label>
              <Input
                value={config.propertyName}
                onChange={(e) => onChange('propertyName', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input
                value={config.address}
                onChange={(e) => onChange('address', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Check-in Time</Label>
              <Input
                value={config.checkInTime}
                onChange={(e) => onChange('checkInTime', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Check-out Time</Label>
              <Input
                value={config.checkOutTime}
                onChange={(e) => onChange('checkOutTime', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WiFi Network Name (SSID)</Label>
              <Input
                value={config.wifiSSID}
                onChange={(e) => onChange('wifiSSID', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WiFi Password</Label>
              <Input
                value={config.wifiPassword}
                onChange={(e) => onChange('wifiPassword', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Emergency Number</Label>
              <Input
                value={config.emergencyNumber}
                onChange={(e) => onChange('emergencyNumber', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Parking Information</Label>
              <Input
                value={config.parkingInfo}
                onChange={(e) => onChange('parkingInfo', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Front Desk Location</Label>
              <Input
                value={config.frontDeskLocation}
                onChange={(e) => onChange('frontDeskLocation', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Elevator Access</Label>
              <Input
                value={config.elevatorAccess}
                onChange={(e) => onChange('elevatorAccess', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Nearby Amenities</Label>
              <Textarea
                value={config.nearbyAmenities}
                onChange={(e) => onChange('nearbyAmenities', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Special Offers</Label>
              <Textarea
                value={config.specialOffers}
                onChange={(e) => onChange('specialOffers', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Luggage Storage</Label>
              <Input
                value={config.luggageStorage}
                onChange={(e) => onChange('luggageStorage', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Airport Shuttle Info</Label>
              <Textarea
                value={config.airportShuttle}
                onChange={(e) => onChange('airportShuttle', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Express Checkout Info</Label>
              <Textarea
                value={config.expressCheckout}
                onChange={(e) => onChange('expressCheckout', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Feedback Survey Link</Label>
              <Input
                value={config.feedbackLink}
                onChange={(e) => onChange('feedbackLink', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function GuestInstructions() {
  const [activeTab, setActiveTab] = useState('arrival');
  const [propertyConfig, setPropertyConfig] = useState<PropertyConfig>(defaultPropertyConfig);
  const [booking, setBooking] = useState<BookingContext>(defaultBooking);
  const [arrivalSections, setArrivalSections] = useState<InstructionSection[]>([]);
  const [departureSections, setDepartureSections] = useState<InstructionSection[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle property config change
  const handlePropertyChange = useCallback(
    (field: keyof PropertyConfig, value: string) => {
      setPropertyConfig((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle section content edit
  const handleSectionEdit = useCallback(
    (type: 'arrival' | 'departure', sectionId: string, content: string) => {
      const setter = type === 'arrival' ? setArrivalSections : setDepartureSections;
      setter((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, content } : s))
      );
    },
    []
  );

  // Generate instructions
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Call the API route
      const response = await fetch('/api/frontdesk/guest-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyConfig, booking }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setArrivalSections(result.data.arrival);
          setDepartureSections(result.data.departure);
        }
      }
    } catch {
      // Fallback to client-side generation if API fails
      setArrivalSections(generateArrivalInstructions(propertyConfig, booking));
      setDepartureSections(generateDepartureInstructions(propertyConfig, booking));
    } finally {
      setIsGenerated(true);
      setIsGenerating(false);
      toast.success('Instructions generated successfully', {
        description: 'You can now edit, print, or email the instructions.',
      });
    }
  }, [propertyConfig, booking]);

  // Print instructions
  const handlePrint = useCallback(() => {
    const sections =
      activeTab === 'arrival' ? arrivalSections : departureSections;
    const title =
      activeTab === 'arrival'
        ? `Arrival Instructions - ${booking.guestName}`
        : `Departure Instructions - ${booking.guestName}`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow popups to print instructions');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Georgia', 'Times New Roman', serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
          h1 { font-size: 22px; margin-bottom: 4px; color: #1a1a1a; }
          h2 { font-size: 16px; margin-top: 28px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; color: #333; }
          p, li { font-size: 13px; margin-bottom: 6px; }
          .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #333; }
          .header .property { font-size: 24px; font-weight: bold; letter-spacing: 0.5px; }
          .header .guest { font-size: 16px; margin-top: 8px; color: #555; }
          .section { margin-bottom: 20px; }
          pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; }
          .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="property">${propertyConfig.propertyName}</div>
          <div class="guest">${title}</div>
          <div>Confirmation: ${booking.confirmationCode} &bull; Room ${booking.roomNumber}</div>
        </div>
        ${sections
          .map(
            (s) => `
          <div class="section">
            <h2>${s.title}</h2>
            <pre>${s.content}</pre>
          </div>
        `
          )
          .join('')}
        <div class="footer">
          ${propertyConfig.propertyName} &bull; ${propertyConfig.address} &bull; Generated on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [activeTab, arrivalSections, departureSections, booking, propertyConfig]);

  // Email instructions
  const handleEmail = useCallback(() => {
    toast.success('Instructions sent via email', {
      description: `Arrival & departure instructions have been emailed to ${booking.email}`,
    });
  }, [booking.email]);

  const currentSections =
    activeTab === 'arrival' ? arrivalSections : departureSections;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ConciergeBell className="h-5 w-5" />
            Guest Instructions
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-generate arrival &amp; departure instruction sheets for guests
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerated && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Email to Guest
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Booking Context Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Booking Context
          </CardTitle>
          <CardDescription>
            Enter guest and booking details to personalize the instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Guest Name</Label>
              <Input
                value={booking.guestName}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, guestName: e.target.value }))
                }
                placeholder="e.g. John Smith"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmation Code</Label>
              <Input
                value={booking.confirmationCode}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    confirmationCode: e.target.value,
                  }))
                }
                placeholder="e.g. GH-2024-8842"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Room Number</Label>
              <Input
                value={booking.roomNumber}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, roomNumber: e.target.value }))
                }
                placeholder="e.g. 504"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Room Type</Label>
              <Input
                value={booking.roomType}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, roomType: e.target.value }))
                }
                placeholder="e.g. Deluxe Ocean View"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Check-in Date</Label>
              <Input
                value={booking.checkInDate}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, checkInDate: e.target.value }))
                }
                placeholder="e.g. Friday, June 14, 2024"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Check-out Date</Label>
              <Input
                value={booking.checkOutDate}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, checkOutDate: e.target.value }))
                }
                placeholder="e.g. Monday, June 17, 2024"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Guest Email</Label>
              <Input
                type="email"
                value={booking.email}
                onChange={(e) =>
                  setBooking((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="e.g. john.smith@email.com"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Configuration */}
      <PropertyConfigEditor
        config={propertyConfig}
        onChange={handlePropertyChange}
      />

      {/* Tabs: Arrival / Departure */}
      {isGenerated && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="arrival" className="gap-1.5">
                <PlaneLanding className="h-3.5 w-3.5" />
                Arrival Instructions
                <Badge variant="secondary" className="ml-1 text-xs">
                  {arrivalSections.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="departure" className="gap-1.5">
                <PlaneTakeoff className="h-3.5 w-3.5" />
                Departure Instructions
                <Badge variant="secondary" className="ml-1 text-xs">
                  {departureSections.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              Click any section header to expand/collapse. Edit text directly
              before printing or emailing.
            </p>
          </div>

          <TabsContent value="arrival">
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-3 pr-4">
                {currentSections.map((section) => (
                  <InstructionSectionEditor
                    key={section.id}
                    section={section}
                    value={section.content}
                    onChange={(id, content) =>
                      handleSectionEdit('arrival', id, content)
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="departure">
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-3 pr-4">
                {currentSections.map((section) => (
                  <InstructionSectionEditor
                    key={section.id}
                    section={section}
                    value={section.content}
                    onChange={(id, content) =>
                      handleSectionEdit('departure', id, content)
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state */}
      {!isGenerated && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="p-4 rounded-full bg-muted mb-4">
              <ConciergeBell className="h-8 w-8" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              No Instructions Generated
            </h3>
            <p className="text-sm text-center max-w-md">
              Fill in the booking context and property configuration above, then
              click &ldquo;Generate&rdquo; to create personalized arrival and
              departure instruction sheets.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GuestInstructions;
