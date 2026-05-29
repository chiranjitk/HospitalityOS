'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Search,
  Printer,
  Loader2,
  Plus,
  Trash2,
  Eye,
  User,
  Building2,
  Calendar,
  Phone,
  Mail,
  Car,
  Shield,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SignaturePad } from '@/components/frontdesk/signature-pad';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';

interface Booking {
  id: string;
  confirmationCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomRate: number;
  totalAmount: number;
  currency: string;
  specialRequests?: string;
  primaryGuest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  room?: {
    id: string;
    number: string;
    floor: number;
  };
  roomType: {
    id: string;
    name: string;
    code: string;
  };
  property: {
    id: string;
    name: string;
  };
}

interface Companion {
  name: string;
  idType: string;
  idNumber: string;
  nationality: string;
}

interface RegistrationCardData {
  id: string;
  cardNumber: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  purpose: string | null;
  createdAt: string;
}

interface PoliceReportData {
  id: string;
  formNumber: string;
  status: 'not_submitted' | 'submitted' | 'failed';
  submittedAt: string | null;
  createdAt: string;
}

const PURPOSE_OPTIONS = [
  { value: 'leisure', label: 'Leisure / Holiday' },
  { value: 'business', label: 'Business Travel' },
  { value: 'conference', label: 'Conference / Meeting' },
  { value: 'medical', label: 'Medical Visit' },
  { value: 'transit', label: 'Transit / Stopover' },
  { value: 'other', label: 'Other' },
];

export default function RegistrationCard() {
  const { toast } = useToast();
  const { formatDate } = useTimezone();
  const { user } = useAuth();
  const t = useTranslations('frontdesk');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingCard, setExistingCard] = useState<RegistrationCardData | null>(null);

  // Form state
  const [purpose, setPurpose] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Police report state
  const [policeReportStatus, setPoliceReportStatus] = useState<'not_submitted' | 'submitted' | 'failed'>('not_submitted');
  const [policeSubmittedAt, setPoliceSubmittedAt] = useState<string | null>(null);
  const [policeFormNumber, setPoliceFormNumber] = useState<string | null>(null);
  const [isExportingCForm, setIsExportingCForm] = useState(false);
  const [isSubmittingPolice, setIsSubmittingPolice] = useState(false);

  // Search bookings
  const searchBookings = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        status: 'checked_in',
        search: searchQuery.trim(),
        limit: '10',
      });
      const response = await fetch(`/api/bookings?${params}`);
      if (!response.ok) { const text = await response.text().catch(() => 'Unknown error'); throw new Error(text); }
      const result = await response.json();
      if (result.success) {
        setSearchResults(result.data || []);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to search bookings', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchBookings();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Select booking
  const selectBooking = async (booking: Booking) => {
    setSelectedBooking(booking);
    setSearchResults([]);
    setExistingCard(null);
    setPurpose('');
    setVehiclePlate('');
    setCompanions([]);
    setTermsAccepted(false);
    setSignatureData(null);
    setPoliceReportStatus('not_submitted');
    setPoliceSubmittedAt(null);
    setPoliceFormNumber(null);

    // Check for existing registration card
    try {
      const response = await fetch(`/api/folio/registration-card?bookingId=${booking.id}`);
      if (!response.ok) { const text = await response.text().catch(() => 'Unknown error'); throw new Error(text); }
      const result = await response.json();
      if (result.success && result.data) {
        setExistingCard(result.data);
        setPurpose(result.data.purpose || '');
        setVehiclePlate(result.data.vehiclePlate || '');
        setCompanions(JSON.parse(result.data.companions || '[]'));
        setTermsAccepted(result.data.termsAccepted);
        if (result.data.signature) {
          setSignatureData(result.data.signature);
        }
      }
      // Check for existing police report
      try {
        const policeResponse = await fetch(`/api/folio/police-report?bookingId=${booking.id}`);
        if (!policeResponse.ok) { const text = await policeResponse.text().catch(() => 'Unknown error'); throw new Error(text); }
        const policeResult = await policeResponse.json();
        if (policeResult.success && policeResult.data) {
          const pd = policeResult.data as PoliceReportData;
          setPoliceReportStatus(pd.status as 'not_submitted' | 'submitted' | 'failed');
          setPoliceSubmittedAt(pd.submittedAt);
          setPoliceFormNumber(pd.formNumber);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        // Non-critical: don't block on police report fetch failure
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to load existing registration card', variant: 'destructive' });
    }
  };

  // Add companion
  const addCompanion = () => {
    setCompanions([...companions, { name: '', idType: 'passport', idNumber: '', nationality: '' }]);
  };

  // Remove companion
  const removeCompanion = (index: number) => {
    setCompanions(companions.filter((_, i) => i !== index));
  };

  // Update companion
  const updateCompanion = (index: number, field: keyof Companion, value: string) => {
    const updated = [...companions];
    updated[index] = { ...updated[index], [field]: value };
    setCompanions(updated);
  };

  // Generate & print registration card
  const generateCard = async () => {
    if (!selectedBooking) return;

    if (!termsAccepted) {
      toast({ title: 'Terms Required', description: 'Please accept the terms and conditions', variant: 'destructive' });
      return;
    }

    if (!signatureData) {
      toast({ title: 'Signature Required', description: 'Please provide the guest signature to generate the registration card', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/folio/registration-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          purpose: purpose || null,
          vehiclePlate: vehiclePlate || null,
          companions: companions.filter(c => c.name.trim()),
          signature: signatureData,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        } else {
          // Fallback: download the PDF
          const a = document.createElement('a');
          a.href = url;
          a.download = `registration-card-${selectedBooking.confirmationCode}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        toast({ title: 'Registration Card Generated', description: 'PDF generated successfully' });

        // Refresh card data
        const cardResponse = await fetch(`/api/folio/registration-card?bookingId=${selectedBooking.id}`);
        if (!cardResponse.ok) { const text = await cardResponse.text().catch(() => 'Unknown error'); throw new Error(text); }
        const cardResult = await cardResponse.json();
        if (cardResult.success && cardResult.data) {
          setExistingCard(cardResult.data);
        }
      } else {
        const error = await response.json();
        toast({ title: 'Error', description: error.error?.message || 'Failed to generate card', variant: 'destructive' });
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to generate registration card', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Export C-Form PDF
  const exportCForm = async () => {
    if (!selectedBooking) return;

    if (!existingCard) {
      toast({ title: 'Registration Card Required', description: 'Please generate the registration card first', variant: 'destructive' });
      return;
    }

    setIsExportingCForm(true);
    try {
      const response = await fetch('/api/folio/police-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          action: 'export',
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print();
            };
          } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = `c-form-${policeFormNumber || selectedBooking.confirmationCode}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          toast({ title: 'C-Form Exported', description: 'Police registration form generated successfully' });
        } else {
          const result = await response.json();
          if (result.success && result.data) {
            setPoliceFormNumber(result.data.formNumber);
          }
          toast({ title: 'C-Form Ready', description: 'Form data prepared successfully' });
        }

        // Refresh police report data
        const policeResponse = await fetch(`/api/folio/police-report?bookingId=${selectedBooking.id}`);
        if (!policeResponse.ok) { const text = await policeResponse.text().catch(() => 'Unknown error'); throw new Error(text); }
        const policeResult = await policeResponse.json();
        if (policeResult.success && policeResult.data) {
          const pd = policeResult.data as PoliceReportData;
          setPoliceReportStatus(pd.status as 'not_submitted' | 'submitted' | 'failed');
          setPoliceFormNumber(pd.formNumber);
        }
      } else {
        const error = await response.json();
        toast({ title: 'Error', description: error.error?.message || 'Failed to export C-Form', variant: 'destructive' });
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to export C-Form', variant: 'destructive' });
    } finally {
      setIsExportingCForm(false);
    }
  };

  // Submit C-Form to authorities
  const submitToAuthorities = async () => {
    if (!selectedBooking) return;

    if (!existingCard) {
      toast({ title: 'Registration Card Required', description: 'Please generate the registration card first', variant: 'destructive' });
      return;
    }

    setIsSubmittingPolice(true);
    try {
      const response = await fetch('/api/folio/police-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          action: 'submit',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setPoliceReportStatus('submitted');
          setPoliceSubmittedAt(result.data.submittedAt);
          setPoliceFormNumber(result.data.formNumber);
        }
        toast({ title: 'C-Form Submitted', description: 'C-Form submitted successfully' });
      } else {
        setPoliceReportStatus('failed');
        const error = await response.json();
        toast({ title: 'Submission Failed', description: error.error?.message || 'Failed to submit C-Form', variant: 'destructive' });
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setPoliceReportStatus('failed');
      toast({ title: 'Submission Failed', description: 'Failed to submit C-Form to authorities', variant: 'destructive' });
    } finally {
      setIsSubmittingPolice(false);
    }
  };

  // Print C-Form (re-export for printing)
  const printCForm = async () => {
    if (!selectedBooking) return;
    setIsExportingCForm(true);
    try {
      const response = await fetch('/api/folio/police-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          action: 'export',
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to print C-Form', variant: 'destructive' });
    } finally {
      setIsExportingCForm(false);
    }
  };

  const nights = selectedBooking
    ? Math.ceil((new Date(selectedBooking.checkOut).getTime() - new Date(selectedBooking.checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registration Card
          </h2>
          <p className="text-sm text-muted-foreground">
            Generate guest registration cards for check-in records
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by confirmation code or guest name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-3 border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
              {searchResults.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => selectBooking(booking)}
                  className="w-full text-left p-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.confirmationCode} · Room {booking.room?.number || 'TBD'} · {booking.roomType.name}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Card Form */}
      {selectedBooking && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Guest & Stay Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Guest Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <p className="font-medium">
                      {selectedBooking.primaryGuest.firstName} {selectedBooking.primaryGuest.lastName}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nationality</Label>
                    <p className="font-medium">{selectedBooking.primaryGuest.nationality || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ID Type</Label>
                    <p className="font-medium capitalize">{selectedBooking.primaryGuest.idType?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ID Number</Label>
                    <p className="font-medium">{selectedBooking.primaryGuest.idNumber || '-'}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <p className="font-medium">
                      {selectedBooking.primaryGuest.address}
                      {selectedBooking.primaryGuest.city ? `, ${selectedBooking.primaryGuest.city}` : ''}
                      {selectedBooking.primaryGuest.state ? `, ${selectedBooking.primaryGuest.state}` : ''}
                      {selectedBooking.primaryGuest.country ? `, ${selectedBooking.primaryGuest.country}` : ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selectedBooking.primaryGuest.phone || '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedBooking.primaryGuest.email || '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stay Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Stay Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Room Number</Label>
                    <p className="text-lg font-bold text-primary">{selectedBooking.room?.number || 'TBD'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Room Type</Label>
                    <p className="font-medium">{selectedBooking.roomType.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Check-in</Label>
                    <p className="font-medium">{formatDate(selectedBooking.checkIn)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Check-out</Label>
                    <p className="font-medium">{formatDate(selectedBooking.checkOut)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <p className="font-medium">{nights} night{nights !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Guests</Label>
                    <p className="font-medium">
                      {selectedBooking.adults} adult{selectedBooking.adults > 1 ? 's' : ''}
                      {selectedBooking.children > 0 && `, ${selectedBooking.children} child${selectedBooking.children > 1 ? 'ren' : ''}`}
                    </p>
                  </div>
                </div>

                {selectedBooking.specialRequests && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <Label className="text-xs text-muted-foreground">Special Requests</Label>
                    <p className="text-sm mt-1">{selectedBooking.specialRequests}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Companions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Accompanying Guests</CardTitle>
                  <Button variant="outline" size="sm" onClick={addCompanion}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {companions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No companions added. Click &quot;Add&quot; to add accompanying guests.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID Type</TableHead>
                        <TableHead>ID Number</TableHead>
                        <TableHead>Nationality</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companions.map((comp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={comp.name}
                              onChange={(e) => updateCompanion(idx, 'name', e.target.value)}
                              placeholder="Full name"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={comp.idType} onValueChange={(v) => updateCompanion(idx, 'idType', v)}>
                              <SelectTrigger className="h-8 text-sm w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="passport">Passport</SelectItem>
                                <SelectItem value="national_id">National ID</SelectItem>
                                <SelectItem value="driver_license">Driver License</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={comp.idNumber}
                              onChange={(e) => updateCompanion(idx, 'idNumber', e.target.value)}
                              placeholder="ID number"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={comp.nationality}
                              onChange={(e) => updateCompanion(idx, 'nationality', e.target.value)}
                              placeholder="Nationality"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Remove companion" onClick={() => removeCompanion(idx)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Actions & Settings */}
          <div className="space-y-6">
            {/* Purpose of Visit */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Purpose of Visit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Vehicle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="License plate number"
                />
              </CardContent>
            </Card>

            {/* Existing Card Info */}
            {existingCard && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-600" />
                    Existing Card
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Card No.</span>
                    <span className="font-mono font-medium">{existingCard.cardNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(existingCard.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Police Report / C-Form */}
            {existingCard && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Police Registration / C-Form
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    {policeReportStatus === 'submitted' && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    )}
                    {policeReportStatus === 'failed' && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {policeReportStatus === 'not_submitted' && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        Not Submitted
                      </Badge>
                    )}
                  </div>

                  {/* Form Number & Submitted Time */}
                  {policeFormNumber && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Form No.</span>
                        <span className="font-mono font-medium">{policeFormNumber}</span>
                      </div>
                    </div>
                  )}
                  {policeSubmittedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Submitted</span>
                      <span>{formatDate(policeSubmittedAt)}</span>
                    </div>
                  )}

                  <Separator />

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={exportCForm}
                      disabled={isExportingCForm || isSubmittingPolice}
                    >
                      {isExportingCForm ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Export C-Form
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      onClick={submitToAuthorities}
                      disabled={isSubmittingPolice || isExportingCForm || policeReportStatus === 'submitted'}
                    >
                      {isSubmittingPolice ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {policeReportStatus === 'submitted' ? 'Already Submitted' : 'Submit to Authorities'}
                        </>
                      )}
                    </Button>

                    {(policeReportStatus === 'submitted' || policeFormNumber) && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={printCForm}
                        disabled={isExportingCForm}
                      >
                        {isExportingCForm ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Printer className="h-4 w-4 mr-2" />
                            Print C-Form
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Terms & Conditions */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    I confirm that the guest information provided above is accurate and complete.
                    The guest has been informed of the hotel&apos;s rules, policies, and check-out procedures.
                  </Label>
                </div>

                <Separator className="my-2" />

                <SignaturePad
                  value={signatureData}
                  onChange={setSignatureData}
                  label="Guest Signature (Required)"
                  required
                />

                <Button
                  className="w-full"
                  onClick={generateCard}
                  disabled={isGenerating || !termsAccepted || !signatureData}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      {existingCard ? 'Regenerate & Print' : 'Generate & Print'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedBooking && searchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Search for a Booking</p>
            <p className="text-sm">Enter a confirmation code or guest name to generate a registration card</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
