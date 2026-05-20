'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import {
  Plus, CalendarDays, CheckCircle2, XCircle, Clock, Trash2,
  Filter, ChevronLeft, ChevronRight, User, Mail, Briefcase, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useTimezone } from '@/contexts/TimezoneContext';
import { format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface LeaveRequest {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  staff: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    jobTitle: string | null;
    avatar: string | null;
  } | null;
  approver: {
    id: string;
    name: string;
  } | null;
}

interface LeaveBalances {
  [userId: string]: Record<string, { total: number; used: number; remaining: number }>;
}

interface CalendarLeave {
  date: Date;
  staffName: string;
  leaveType: string;
  status: string;
}

const leaveTypeLabels: Record<string, string> = {
  sick: 'Sick Leave',
  vacation: 'Vacation',
  personal: 'Personal',
  maternity: 'Maternity',
  other: 'Other',
};

const leaveTypeColors: Record<string, string> = {
  sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  vacation: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  personal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  maternity: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
};

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400',
};

export default function LeaveManagement() {
  const { formatDate } = useTimezone();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalances>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarLeaves, setCalendarLeaves] = useState<CalendarLeave[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Create form state
  const [formLeaveType, setFormLeaveType] = useState('vacation');
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(undefined);
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(undefined);
  const [formReason, setFormReason] = useState('');

  const fetchLeaves = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('leaveType', typeFilter);
      params.set('page', currentPage.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/staff/leave?${params}`);
      const data = await response.json();

      if (data.success) {
        setLeaves(data.leaves || []);
        if (data.balances) setBalances(data.balances);
        if (data.pagination) setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, currentPage]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const fetchCalendarLeaves = useCallback(async (date: Date) => {
    try {
      setCalendarLoading(true);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const params = new URLSearchParams({
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
        status: 'approved,pending',
        limit: '200',
      });

      const response = await fetch(`/api/staff/leave?${params}`);
      const data = await response.json();

      if (data.success) {
        const calLeaves: CalendarLeave[] = [];
        data.leaves.forEach((leave: LeaveRequest) => {
          const start = startOfDay(parseISO(leave.startDate));
          const end = endOfDay(parseISO(leave.endDate));
          const days = eachDayOfInterval({ start, end });
          days.forEach(day => {
            calLeaves.push({
              date: day,
              staffName: leave.staff?.name || 'Unknown',
              leaveType: leave.leaveType,
              status: leave.status,
            });
          });
        });
        setCalendarLeaves(calLeaves);
      }
    } catch (error) {
      console.error('Error fetching calendar leaves:', error);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarLeaves(calendarMonth);
  }, [calendarMonth, fetchCalendarLeaves]);

  const handleCreateLeave = async () => {
    if (!formLeaveType || !formStartDate || !formEndDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setProcessing('create');
      const response = await fetch('/api/staff/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType: formLeaveType,
          startDate: formStartDate.toISOString(),
          endDate: formEndDate.toISOString(),
          reason: formReason || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Leave request created successfully');
        setShowCreateDialog(false);
        setFormLeaveType('vacation');
        setFormStartDate(undefined);
        setFormEndDate(undefined);
        setFormReason('');
        fetchLeaves();
        fetchCalendarLeaves(calendarMonth);
      } else {
        toast.error(data.error?.message || 'Failed to create leave request');
      }
    } catch (error) {
      console.error('Error creating leave:', error);
      toast.error('Failed to create leave request');
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (leaveId: string) => {
    try {
      setProcessing(leaveId);
      const response = await fetch('/api/staff/leave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, action: 'approve' }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Leave request approved');
        fetchLeaves();
        fetchCalendarLeaves(calendarMonth);
      } else {
        toast.error(data.error?.message || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve leave request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try {
      setProcessing(rejectId);
      const response = await fetch('/api/staff/leave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId: rejectId, action: 'reject', rejectionReason: rejectReason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Leave request rejected');
        setRejectId(null);
        setRejectReason('');
        fetchLeaves();
        fetchCalendarLeaves(calendarMonth);
      } else {
        toast.error(data.error?.message || 'Failed to reject');
      }
    } catch (error) {
      toast.error('Failed to reject leave request');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      setProcessing(cancelId);
      const response = await fetch(`/api/staff/leave?id=${cancelId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Leave request cancelled');
        setCancelId(null);
        fetchLeaves();
        fetchCalendarLeaves(calendarMonth);
      } else {
        toast.error(data.error?.message || 'Failed to cancel');
      }
    } catch (error) {
      toast.error('Failed to cancel leave request');
    } finally {
      setProcessing(null);
    }
  };

  const getCalendarDayLeaves = (day: Date) => {
    return calendarLeaves.filter(cl => isSameDay(cl.date, day));
  };

  // Render leave balances
  const renderBalances = () => {
    const userBalances = Object.values(balances)[0];
    if (!userBalances) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(userBalances).map(([type, bal]) => (
          <div key={type} className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground capitalize">{type}</span>
              <Badge variant="outline" className={`text-xs ${leaveTypeColors[type] || ''}`}>
                {bal.remaining}/{bal.total}
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (bal.remaining / bal.total) > 0.3 ? 'bg-emerald-500' : (bal.remaining / bal.total) > 0.1 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (bal.remaining / bal.total) * 100))}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Used: {bal.used}</span>
              <span>Left: {bal.remaining}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leave Management</h2>
          <p className="text-muted-foreground">Manage staff leave requests and balances</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Leave Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>New Leave Request</DialogTitle>
              <DialogDescription>Submit a new leave request for approval</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select value={formLeaveType} onValueChange={setFormLeaveType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(leaveTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formStartDate ? format(formStartDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setFormStartDate(e.target.value ? parseISO(e.target.value) : undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formEndDate ? format(formEndDate, 'yyyy-MM-dd') : ''}
                    min={formStartDate ? format(formStartDate, 'yyyy-MM-dd') : undefined}
                    onChange={(e) => setFormEndDate(e.target.value ? parseISO(e.target.value) : undefined)}
                  />
                </div>
              </div>
              {formStartDate && formEndDate && (
                <div className="text-sm text-muted-foreground">
                  Duration: {differenceInCalendarDays(formEndDate, formStartDate) + 1} day(s)
                </div>
              )}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Provide a reason for your leave request..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateLeave} disabled={processing === 'create'}>
                {processing === 'create' ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balances */}
      {renderBalances()}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Leave Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(leaveTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Leave List */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                {leaves.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No leave requests found
                  </div>
                ) : (
                  <div className="divide-y">
                    {leaves.map((leave) => (
                      <div key={leave.id} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{leave.staff?.name || 'Unknown'}</span>
                                <Badge variant="outline" className={leaveTypeColors[leave.leaveType]}>
                                  {leaveTypeLabels[leave.leaveType] || leave.leaveType}
                                </Badge>
                                <Badge variant="secondary" className={statusStyles[leave.status]}>
                                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                                </span>
                                <span>{leave.totalDays} day(s)</span>
                                {leave.staff?.department && (
                                  <span className="flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    {leave.staff.department}
                                  </span>
                                )}
                              </div>
                              {leave.reason && (
                                <p className="mt-1 text-sm text-muted-foreground truncate">{leave.reason}</p>
                              )}
                              {leave.rejectionReason && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Rejection: {leave.rejectionReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {leave.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                  onClick={() => handleApprove(leave.id)}
                                  disabled={processing === leave.id}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setRejectId(leave.id)}
                                  disabled={processing === leave.id}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={() => setCancelId(leave.id)}
                                  disabled={processing === leave.id}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {leave.approver && (
                              <span className="text-xs text-muted-foreground ml-2">
                                by {leave.approver.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-lg">{format(calendarMonth, 'MMMM yyyy')}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {calendarLoading ? (
                <Skeleton className="h-[400px]" />
              ) : (
                <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden min-w-[640px]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) }).map(day => {
                    const dayLeaves = getCalendarDayLeaves(day);
                    const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    return (
                      <div
                        key={day.toISOString()}
                        className={`bg-card p-1 min-h-[80px] ${!isCurrentMonth ? 'opacity-40' : ''}`}
                      >
                        <span className="text-xs font-medium">{format(day, 'd')}</span>
                        {dayLeaves.slice(0, 3).map((cl, i) => (
                          <div
                            key={i}
                            className={`mt-0.5 px-1 py-0.5 rounded text-[10px] truncate ${
                              cl.status === 'approved' ? leaveTypeColors[cl.leaveType] : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {cl.staffName.split(' ')[0]}
                          </div>
                        ))}
                        {dayLeaves.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+{dayLeaves.length - 3} more</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this leave request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
              Cancel Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing === rejectId || !rejectReason.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
