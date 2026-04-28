'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRightLeft,
  Loader2,
  User,
  Clock,
  MessageSquare,
  AlertTriangle,
  Briefcase,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface ChatTransferProps {
  conversationId: string;
  currentAssignee?: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete?: () => void;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  avatar?: string;
}

interface TransferRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  fromUser?: { id: string; firstName: string; lastName: string; jobTitle?: string };
  toUser?: { id: string; firstName: string; lastName: string; jobTitle?: string };
}

const transferReasons = [
  { value: 'escalation', label: 'Escalation', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'department_change', label: 'Department Change', icon: Briefcase, color: 'text-blue-500' },
  { value: 'shift_change', label: 'Shift Change', icon: RefreshCw, color: 'text-amber-500' },
  { value: 'expertise', label: 'Subject Expert', icon: User, color: 'text-violet-500' },
  { value: 'other', label: 'Other', color: 'text-gray-500' },
];

export default function ChatTransfer({
  conversationId,
  currentAssignee,
  open,
  onOpenChange,
  onTransferComplete,
}: ChatTransferProps) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch staff members (users for this tenant)
      const staffResponse = await fetch('/api/users?limit=100');
      const staffResult = await staffResponse.json();
      if (staffResult.success) {
        setStaff(staffResult.data || []);
      }

      // Fetch transfer history
      const historyResponse = await fetch(`/api/chat-conversations/${conversationId}/transfer`);
      const historyResult = await historyResponse.json();
      if (historyResult.success) {
        setTransferHistory(historyResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching transfer data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  const handleTransfer = async () => {
    if (!selectedStaff) {
      toast({
        title: 'Validation Error',
        description: 'Please select a staff member',
        variant: 'destructive',
      });
      return;
    }

    setIsTransferring(true);
    try {
      const response = await fetch(`/api/chat-conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: selectedStaff,
          reason: reason || undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Conversation transferred successfully',
        });
        setSelectedStaff('');
        setReason('');
        setNotes('');
        onTransferComplete?.();
        onOpenChange(false);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to transfer conversation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error transferring conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to transfer conversation',
        variant: 'destructive',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const getReasonIcon = (reasonValue: string) => {
    const found = transferReasons.find(r => r.value === reasonValue);
    return found?.label || reasonValue;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Conversation
          </DialogTitle>
          <DialogDescription>
            Transfer this conversation to another staff member
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Assignee */}
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Current Assignee</div>
              {currentAssignee ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-medium">
                    {currentAssignee.firstName[0]}{currentAssignee.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">{currentAssignee.firstName} {currentAssignee.lastName}</p>
                    {currentAssignee.jobTitle && (
                      <p className="text-xs text-muted-foreground">{currentAssignee.jobTitle}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </Card>

            {/* Transfer Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Transfer To</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff
                      .filter(s => s.id !== currentAssignee?.id)
                      .map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                          {member.jobTitle && ` — ${member.jobTitle}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {transferReasons.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex items-center gap-2">
                          <r.icon className={cn('h-4 w-4', r.color)} />
                          {r.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add context for the transfer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Transfer History */}
            {transferHistory.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Transfer History
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transferHistory.map(record => (
                    <div key={record.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          {record.fromUser && (
                            <span className="font-medium">
                              {record.fromUser.firstName} {record.fromUser.lastName}
                            </span>
                          )}
                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                          {record.toUser && (
                            <span className="font-medium">
                              {record.toUser.firstName} {record.toUser.lastName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {record.reason && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {getReasonIcon(record.reason)}
                        </Badge>
                      )}
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isTransferring || !selectedStaff}
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
