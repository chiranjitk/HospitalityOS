'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Search,
  User,
  Hash,
  ArrowRight,
  Calendar,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BookingInfo {
  id: string;
  confirmationCode: string;
  primaryGuest?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  notes?: string;
  performedBy?: string;
  performedByName?: string;
  performedAt: string;
  booking: BookingInfo;
}

const actionTypes: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-emerald-500' },
  status_change: { label: 'Status Change', color: 'bg-amber-500' },
  room_change: { label: 'Room Change', color: 'bg-cyan-500' },
  checked_in: { label: 'Checked In', color: 'bg-teal-500' },
  checked_out: { label: 'Checked Out', color: 'bg-violet-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
  modified: { label: 'Modified', color: 'bg-slate-500' },
  note_added: { label: 'Note Added', color: 'bg-pink-500' },
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  confirmed: 'bg-emerald-500',
  checked_in: 'bg-teal-500',
  checked_out: 'bg-cyan-500',
  cancelled: 'bg-red-500',
  no_show: 'bg-orange-500',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);

  // Fetch audit logs
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('bookingId', searchQuery);
      if (actionFilter !== 'all') params.append('action', actionFilter);

      const response = await fetch(`/api/bookings/audit-logs?${params.toString()}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        setLogs(result.data || []);
        setTotal(result.pagination?.total ?? 0);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs();
    return () => controller.abort();
  }, [actionFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchLogs();
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery]);

  const getActionBadge = (action: string) => {
    const actionInfo = actionTypes[action] || { label: action, color: 'bg-gray-500' };
    return (
      <Badge className={cn('text-white', actionInfo.color)}>
        {actionInfo.label}
      </Badge>
    );
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    return (
      <Badge variant="outline" className={cn('text-xs', statusColors[status])}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete history of booking changes and actions
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {total} total entries
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(actionTypes).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLogs}>
              <Filter className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No audit logs found</p>
              <p className="text-sm">Activity will appear here as bookings are modified</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead className="w-[130px]">Booking ID</TableHead>
                    <TableHead className="w-[150px]">Guest</TableHead>
                    <TableHead className="w-[130px]">Action</TableHead>
                    <TableHead>Status Change</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[130px]">Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs">
                            {format(new Date(log.performedAt), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            {format(new Date(log.performedAt), 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm font-medium">
                            {log.booking.confirmationCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.booking.primaryGuest ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm">
                              {log.booking.primaryGuest.firstName} {log.booking.primaryGuest.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        {log.oldStatus && log.newStatus ? (
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(log.oldStatus)}
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {getStatusBadge(log.newStatus)}
                          </div>
                        ) : log.newStatus ? (
                          getStatusBadge(log.newStatus)
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.notes ? (
                          <p className="text-sm text-muted-foreground max-w-xs truncate" title={log.notes}>
                            {log.notes}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {log.performedByName || 'System'}
                        </span>
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
