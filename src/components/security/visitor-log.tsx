'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users, UserCheck, UserMinus, Search,
  Loader2, Plus, Building, ClipboardList,
  LogOut, Phone, Mail, Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  idType: string;
  idNumber: string;
  purpose: string;
  hostGuestName: string | null;
  hostRoomNumber: string | null;
  company: string | null;
  vehiclePlate: string | null;
  checkIn: string;
  checkOut: string | null;
  badgeNumber: string | null;
  status: string;
  notes: string | null;
}

interface VisitorStats {
  totalToday: number;
  currentlyCheckedIn: number;
  byPurpose: Record<string, number>;
  checkedInByPurpose: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  checked_in: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  checked_out: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800',
  blacklisted: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  expected: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

const PURPOSE_LABELS: Record<string, string> = {
  business: 'Business',
  personal: 'Personal',
  delivery: 'Delivery',
  contractor: 'Contractor',
  government: 'Government',
  other: 'Other',
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatDuration(checkIn: string, checkOut: string | null): string {
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const diffMs = end - start;
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function VisitorLogPanel() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPurpose, setFilterPurpose] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [propertyId] = useState('default');

  // Check-in form
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIdType, setFormIdType] = useState('other');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formPurpose, setFormPurpose] = useState('other');
  const [formHostName, setFormHostName] = useState('');
  const [formHostRoom, setFormHostRoom] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formVehicle, setFormVehicle] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [visitorsParams, statsParams] = [new URLSearchParams({ propertyId }), new URLSearchParams({ propertyId })];

      if (filterStatus !== 'all') visitorsParams.set('status', filterStatus);
      if (filterPurpose !== 'all') visitorsParams.set('purpose', filterPurpose);
      if (searchQuery) visitorsParams.set('search', searchQuery);

      const [visitorsRes, statsRes] = await Promise.all([
        fetch(`/api/security/visitors?${visitorsParams}`),
        fetch(`/api/security/visitors/stats?${statsParams}`),
      ]);

      const visitorsData = await visitorsRes.json();
      const statsData = await statsRes.json();

      if (visitorsData.success) setVisitors(visitorsData.data.visitors || []);
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    }
    setLoading(false);
  }, [filterStatus, filterPurpose, searchQuery, propertyId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCheckIn = async () => {
    if (!formFirstName.trim() || !formLastName.trim() || !formIdNumber.trim()) {
      toast.error('First name, last name, and ID number are required');
      return;
    }
    setCheckInLoading(true);
    try {
      const res = await fetch('/api/security/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          idType: formIdType,
          idNumber: formIdNumber.trim(),
          purpose: formPurpose,
          hostGuestName: formHostName.trim() || undefined,
          hostRoomNumber: formHostRoom.trim() || undefined,
          company: formCompany.trim() || undefined,
          vehiclePlate: formVehicle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Visitor checked in successfully');
        setCheckInOpen(false);
        setFormFirstName('');
        setFormLastName('');
        setFormEmail('');
        setFormPhone('');
        setFormIdType('other');
        setFormIdNumber('');
        setFormPurpose('other');
        setFormHostName('');
        setFormHostRoom('');
        setFormCompany('');
        setFormVehicle('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to check in visitor');
      }
    } catch {
      toast.error('Failed to check in visitor');
    }
    setCheckInLoading(false);
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      const res = await fetch('/api/security/visitors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: visitorId, checkOut: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Visitor checked out');
        fetchData();
      }
    } catch {
      toast.error('Failed to check out visitor');
    }
  };

  return (
    <SectionGuard permission="security.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visitor Management</h2>
            <p className="text-muted-foreground">Track and manage visitor access</p>
          </div>
          <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Check In Visitor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Visitor Check-In</DialogTitle>
                <DialogDescription>Register a new visitor</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name *</label>
                    <Input value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} placeholder="John" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name *</label>
                    <Input value={formLastName} onChange={(e) => setFormLastName(e.target.value)} placeholder="Doe" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="john@example.com" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+1-555-0100" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">ID Type</label>
                    <Select value={formIdType} onValueChange={setFormIdType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national_id">National ID</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">Driver License</SelectItem>
                        <SelectItem value="company_id">Company ID</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">ID Number *</label>
                    <Input value={formIdNumber} onChange={(e) => setFormIdNumber(e.target.value)} placeholder="ID number" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Purpose</label>
                    <Select value={formPurpose} onValueChange={setFormPurpose}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURPOSE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company</label>
                    <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="Company name" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Host Name</label>
                    <Input value={formHostName} onChange={(e) => setFormHostName(e.target.value)} placeholder="Guest being visited" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Host Room</label>
                    <Input value={formHostRoom} onChange={(e) => setFormHostRoom(e.target.value)} placeholder="Room number" className="mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Vehicle Plate</label>
                  <Input value={formVehicle} onChange={(e) => setFormVehicle(e.target.value)} placeholder="e.g. ABC-1234" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCheckInOpen(false)}>Cancel</Button>
                <Button onClick={handleCheckIn} disabled={checkInLoading} className="gap-2">
                  {checkInLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Check In
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <ClipboardList className="h-4 w-4" />
                Total Today
              </div>
              <div className="text-2xl font-bold">{stats?.totalToday ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <UserCheck className="h-4 w-4" />
                Currently In
              </div>
              <div className="text-2xl font-bold text-green-600">{stats?.currentlyCheckedIn ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building className="h-4 w-4" />
                Business
              </div>
              <div className="text-2xl font-bold">{stats?.checkedInByPurpose?.business ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Car className="h-4 w-4" />
                Contractors
              </div>
              <div className="text-2xl font-bold">{stats?.checkedInByPurpose?.contractor ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, company, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                  <SelectItem value="expected">Expected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Purpose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purpose</SelectItem>
                  {Object.entries(PURPOSE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Visitor Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mb-2" />
                <p className="text-sm">No visitors found</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitor</TableHead>
                      <TableHead className="hidden sm:table-cell">ID</TableHead>
                      <TableHead className="hidden md:table-cell">Purpose</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.map((visitor) => (
                      <TableRow key={visitor.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {visitor.firstName} {visitor.lastName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {visitor.company && (
                                <span className="text-xs text-muted-foreground">{visitor.company}</span>
                              )}
                              {visitor.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Phone className="h-3 w-3" />{visitor.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-xs text-muted-foreground">
                            <div>{visitor.idType.replace(/_/g, ' ')}</div>
                            <div className="font-mono">{visitor.idNumber.slice(-4)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className="text-xs">
                            {PURPOSE_LABELS[visitor.purpose] || visitor.purpose}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {visitor.hostGuestName || '—'}
                            {visitor.hostRoomNumber && (
                              <div className="text-muted-foreground">Room {visitor.hostRoomNumber}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[visitor.status] || ''}>
                            {visitor.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {formatDuration(visitor.checkIn, visitor.checkOut)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {visitor.status === 'checked_in' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleCheckOut(visitor.id)}
                                title="Check Out"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
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
    </SectionGuard>
  );
}
