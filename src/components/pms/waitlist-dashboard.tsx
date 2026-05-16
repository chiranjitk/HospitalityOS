'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  Loader2,
  Clock,
  Bell,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCw,
  Sparkles,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WaitlistEntry {
  id: string;
  tenantId: string;
  propertyId: string;
  guestId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  priority: number;
  status: string;
  notes: string | null;
  bookingId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    isVip: boolean;
  } | null;
  roomType?: {
    id: string;
    name: string;
    code: string;
  } | null;
  property?: {
    id: string;
    name: string;
  } | null;
  booking?: {
    id: string;
    confirmationCode: string;
    status: string;
  } | null;
}

interface WaitlistStats {
  total: number;
  waiting: number;
  notified: number;
  converted: number;
  expired: number;
}

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  notified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  converted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  waiting: <Clock className="h-3 w-3" />,
  notified: <Bell className="h-3 w-3" />,
  converted: <CheckCircle2 className="h-3 w-3" />,
  expired: <XCircle className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
};

export default function WaitlistDashboard() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/waitlist?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch waitlist');
      const result = await response.json();

      if (result.success) {
        setEntries(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to load waitlist data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAutoProcess = async () => {
    if (entries.length === 0) {
      toast({ title: 'Info', description: 'No waitlist entries to process' });
      return;
    }

    // Get first waiting entry's room type for processing
    const firstWaiting = entries.find(e => e.status === 'waiting');
    if (!firstWaiting) {
      toast({ title: 'Info', description: 'No waiting entries to process' });
      return;
    }

    setIsAutoProcessing(true);
    try {
      const response = await fetch('/api/waitlist/auto-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: firstWaiting.roomTypeId,
          checkIn: firstWaiting.checkIn,
          checkOut: firstWaiting.checkOut,
          propertyId: firstWaiting.propertyId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Auto-Process Complete',
          description: result.message || `${result.data.processedCount} entries processed`,
        });
        fetchData(); // Refresh
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to process waitlist',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Auto-process error:', error);
      toast({
        title: 'Error',
        description: 'Failed to auto-process waitlist',
        variant: 'destructive',
      });
    } finally {
      setIsAutoProcessing(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/waitlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Updated',
          description: `Entry status changed to ${newStatus}`,
        });
        fetchData();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update entry status',
        variant: 'destructive',
      });
    }
  };

  // Get unique room types from entries
  const roomTypes = useMemo(() => {
    const types = new Map<string, string>();
    entries.forEach(e => {
      if (e.roomType) types.set(e.roomTypeId, e.roomType.name);
    });
    return Array.from(types.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.guest?.firstName.toLowerCase().includes(query) ||
        e.guest?.lastName.toLowerCase().includes(query) ||
        e.roomType?.name.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query)
      );
    }

    if (roomTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.roomTypeId === roomTypeFilter);
    }

    return filtered;
  }, [entries, searchQuery, roomTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" />
            Waitlist Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage room waitlist requests and auto-process when availability opens
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoProcess}
            disabled={isAutoProcessing || isLoading}
          >
            {isAutoProcessing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Auto-Process
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total</div>
        </Card>
        <Card className="p-4 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.waiting ?? 0}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Waiting</div>
        </Card>
        <Card className="p-4 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-500" />
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.notified ?? 0}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Notified</div>
        </Card>
        <Card className="p-4 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.converted ?? 0}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Converted</div>
        </Card>
        <Card className="p-4 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-gray-500" />
            <div className="text-2xl font-bold">{stats?.expired ?? 0}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Expired</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by guest name, room type, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="notified">Notified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Room Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p className="font-medium">No waitlist entries found</p>
              <p className="text-sm mt-1">
                {searchQuery || statusFilter !== 'all' || roomTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Guests will appear here when rooms are unavailable'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">
                              {entry.guest?.firstName} {entry.guest?.lastName || 'Unknown'}
                            </div>
                            {entry.guest?.isVip && (
                              <Badge variant="secondary" className="text-xs mt-0.5">VIP</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{entry.roomType?.name || 'N/A'}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(entry.checkIn), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(entry.checkOut), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.priority > 5 ? 'High' : entry.priority > 2 ? 'Medium' : 'Low'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[entry.status] || ''}>
                          <span className="flex items-center gap-1">
                            {STATUS_ICONS[entry.status]}
                            {entry.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {entry.status === 'waiting' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleUpdateStatus(entry.id, 'notified')}
                              >
                                Notify
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-red-600"
                                onClick={() => handleUpdateStatus(entry.id, 'cancelled')}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {entry.status === 'notified' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-emerald-600"
                                onClick={() => handleUpdateStatus(entry.id, 'converted')}
                              >
                                Convert
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleUpdateStatus(entry.id, 'expired')}
                              >
                                Expire
                              </Button>
                            </>
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
  );
}
