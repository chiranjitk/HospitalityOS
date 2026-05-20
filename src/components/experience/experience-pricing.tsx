'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DollarSign, Plus, Loader2, Pencil, Trash2, RefreshCw, CalendarDays,
  Clock, Users, Save, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ============================================================
// Types
// ============================================================

interface TimeSlot {
  id: string;
  experienceId: string;
  type: 'slot';
  startTime: string;
  endTime: string;
  capacity?: number;
  isAvailable: boolean;
  createdAt: string;
}

interface PricingRule {
  id: string;
  experienceId: string;
  type: 'rule';
  seasonName: string;
  startDate?: string;
  endDate?: string;
  priceMultiplier: number;
  minGuests: number;
  maxGuests?: number;
  isAvailable: boolean;
  createdAt: string;
}

interface ExperienceOption {
  id: string;
  name: string;
  basePrice: number;
  duration: number;
}

const RULE_TYPES = [
  { value: 'seasonal', label: 'Seasonal', color: 'bg-emerald-500' },
  { value: 'group', label: 'Group', color: 'bg-amber-500' },
  { value: 'early_bird', label: 'Early Bird', color: 'bg-sky-500' },
  { value: 'last_minute', label: 'Last Minute', color: 'bg-rose-500' },
];

// ============================================================
// Component
// ============================================================

export default function ExperiencePricing() {
  const { toast } = useToast();

  // Experience selector
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [selectedExpId, setSelectedExpId] = useState('');

  // Data
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TimeSlot | PricingRule | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteType, setDeleteType] = useState<'slot' | 'rule'>('slot');

  // Slot form
  const [slotForm, setSlotForm] = useState({
    startTime: '09:00',
    endTime: '10:00',
    capacity: 10,
    isAvailable: true,
  });

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    seasonName: '',
    ruleType: 'seasonal',
    startDate: '',
    endDate: '',
    priceMultiplier: 1,
    minGuests: 1,
    maxGuests: '',
    isAvailable: true,
  });

  // ============================================================
  // Fetch
  // ============================================================

  const fetchExperiences = useCallback(async () => {
    try {
      const res = await fetch('/api/experiences?status=active');
      const result = await res.json();
      if (result.success) {
        const list: ExperienceOption[] = result.data.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          name: e.name as string,
          basePrice: (e.basePrice as number) || 0,
          duration: (e.duration as number) || 60,
        }));
        setExperiences(list);
        if (list.length > 0 && !selectedExpId) {
          setSelectedExpId(list[0].id);
        }
      }
    } catch {
      /* silent */
    }
  }, [selectedExpId]);

  const fetchData = useCallback(async () => {
    if (!selectedExpId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/experience-availability?experienceId=${selectedExpId}`);
      const result = await res.json();
      if (result.success) {
        setTimeSlots(result.data.timeSlots || []);
        setPricingRules(result.data.pricingRules || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedExpId, toast]);

  useEffect(() => {
    fetchExperiences(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    fetchData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchData]);

  // ============================================================
  // Slot CRUD
  // ============================================================

  const openCreateSlot = () => {
    setSelectedItem(null);
    setIsEdit(false);
    setSlotForm({ startTime: '09:00', endTime: '10:00', capacity: 10, isAvailable: true });
    setIsSlotDialogOpen(true);
  };

  const openEditSlot = (slot: TimeSlot) => {
    setSelectedItem(slot);
    setIsEdit(true);
    setSlotForm({
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity || 10,
      isAvailable: slot.isAvailable,
    });
    setIsSlotDialogOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!selectedExpId) return;
    if (!slotForm.startTime || !slotForm.endTime) {
      toast({ title: 'Error', description: 'Start and end times are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        type: 'slot' as const,
        experienceId: selectedExpId,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: slotForm.capacity,
        isAvailable: slotForm.isAvailable,
      };
      let res;
      if (isEdit && selectedItem) {
        res = await fetch('/api/experience-availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedItem.id, ...payload }),
        });
      } else {
        res = await fetch('/api/experience-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: isEdit ? 'Time slot updated' : 'Time slot created' });
        setIsSlotDialogOpen(false);
        fetchData();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save time slot', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // Rule CRUD
  // ============================================================

  const openCreateRule = () => {
    setSelectedItem(null);
    setIsEdit(false);
    setRuleForm({
      seasonName: '',
      ruleType: 'seasonal',
      startDate: '',
      endDate: '',
      priceMultiplier: 1,
      minGuests: 1,
      maxGuests: '',
      isAvailable: true,
    });
    setIsRuleDialogOpen(true);
  };

  const openEditRule = (rule: PricingRule) => {
    setSelectedItem(rule);
    setIsEdit(true);
    // infer type from name or use seasonName prefix
    const nameLower = (rule.seasonName || '').toLowerCase();
    let inferredType = 'seasonal';
    if (nameLower.includes('group')) inferredType = 'group';
    else if (nameLower.includes('early')) inferredType = 'early_bird';
    else if (nameLower.includes('last')) inferredType = 'last_minute';

    setRuleForm({
      seasonName: rule.seasonName || '',
      ruleType: inferredType,
      startDate: rule.startDate ? format(new Date(rule.startDate), 'yyyy-MM-dd') : '',
      endDate: rule.endDate ? format(new Date(rule.endDate), 'yyyy-MM-dd') : '',
      priceMultiplier: rule.priceMultiplier,
      minGuests: rule.minGuests,
      maxGuests: rule.maxGuests ? String(rule.maxGuests) : '',
      isAvailable: rule.isAvailable,
    });
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedExpId) return;
    if (!ruleForm.seasonName) {
      toast({ title: 'Error', description: 'Rule name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        type: 'rule' as const,
        experienceId: selectedExpId,
        seasonName: ruleForm.seasonName,
        startDate: ruleForm.startDate || null,
        endDate: ruleForm.endDate || null,
        priceMultiplier: parseFloat(String(ruleForm.priceMultiplier)) || 1,
        minGuests: parseInt(String(ruleForm.minGuests)) || 1,
        maxGuests: ruleForm.maxGuests ? parseInt(ruleForm.maxGuests) : null,
        isAvailable: ruleForm.isAvailable,
      };
      let res;
      if (isEdit && selectedItem) {
        res = await fetch('/api/experience-availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedItem.id, ...payload }),
        });
      } else {
        res = await fetch('/api/experience-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: isEdit ? 'Pricing rule updated' : 'Pricing rule created' });
        setIsRuleDialogOpen(false);
        fetchData();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save pricing rule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // Toggle availability
  // ============================================================

  const handleToggleSlot = async (slot: TimeSlot) => {
    try {
      const res = await fetch('/api/experience-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slot.id, isAvailable: !slot.isAvailable }),
      });
      const result = await res.json();
      if (result.success) fetchData();
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' });
    }
  };

  const handleToggleRule = async (rule: PricingRule) => {
    try {
      const res = await fetch('/api/experience-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isAvailable: !rule.isAvailable }),
      });
      const result = await res.json();
      if (result.success) fetchData();
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' });
    }
  };

  // ============================================================
  // Delete
  // ============================================================

  const handleDelete = async () => {
    if (!selectedItem?.id) return;
    try {
      const res = await fetch('/api/experience-availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedItem.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: `${deleteType === 'slot' ? 'Time slot' : 'Pricing rule'} deleted` });
        setIsDeleteOpen(false);
        fetchData();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const confirmDelete = (item: TimeSlot | PricingRule, type: 'slot' | 'rule') => {
    setSelectedItem(item);
    setDeleteType(type);
    setIsDeleteOpen(true);
  };

  // ============================================================
  // Save All (no-op refresh)
  // ============================================================

  const handleSaveAll = async () => {
    toast({ title: 'Saved', description: 'All changes saved successfully' });
    fetchData();
  };

  const selectedExp = experiences.find(e => e.id === selectedExpId);

  const getRuleTypeInfo = (rule: PricingRule) => {
    const nameLower = (rule.seasonName || '').toLowerCase();
    if (nameLower.includes('group')) return RULE_TYPES[1];
    if (nameLower.includes('early')) return RULE_TYPES[2];
    if (nameLower.includes('last')) return RULE_TYPES[3];
    return RULE_TYPES[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing & Availability
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage time slots, seasonal pricing, and availability rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSaveAll}>
            <Save className="h-4 w-4 mr-2" />
            Save All
          </Button>
        </div>
      </div>

      {/* Experience Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Label className="font-medium whitespace-nowrap">Experience:</Label>
            <Select value={selectedExpId} onValueChange={setSelectedExpId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select experience" />
              </SelectTrigger>
              <SelectContent>
                {experiences.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedExp && (
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span>Base: ${selectedExp.basePrice.toFixed(2)}</span>
                <span className="hidden sm:inline">•</span>
                <span>{selectedExp.duration} min</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Clock className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{timeSlots.length}</div>
              <div className="text-xs text-muted-foreground">Time Slots</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Clock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{timeSlots.filter(s => s.isAvailable).length}</div>
              <div className="text-xs text-muted-foreground">Available Slots</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CalendarDays className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pricingRules.length}</div>
              <div className="text-xs text-muted-foreground">Pricing Rules</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {timeSlots.reduce((sum, s) => sum + (s.capacity || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total Capacity</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Time Slots Section */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Slots
            </CardTitle>
            <Button size="sm" onClick={openCreateSlot}>
              <Plus className="h-4 w-4 mr-1" />
              Add Slot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4" />
              <p>No time slots configured</p>
              <p className="text-xs mt-1">Add time slots to control booking availability</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3 p-4">
                {timeSlots.map(slot => (
                  <div key={slot.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={slot.isAvailable ? 'default' : 'destructive'} className="text-xs">
                          {slot.isAvailable ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {slot.capacity || 'Unlimited'} capacity
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => handleToggleSlot(slot)}
                      >
                        {slot.isAvailable ? <ToggleRight className="h-4 w-4 mr-1 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 mr-1 text-muted-foreground" />}
                        {slot.isAvailable ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEditSlot(slot)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => confirmDelete(slot, 'slot')}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <ScrollArea className="max-h-[350px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlots.map(slot => (
                        <TableRow key={slot.id}>
                          <TableCell className="font-medium">{slot.startTime}</TableCell>
                          <TableCell>{slot.endTime}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {slot.capacity || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleToggleSlot(slot)}
                              className="flex items-center gap-1.5"
                            >
                              {slot.isAvailable ? (
                                <ToggleRight className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className={cn('text-xs', slot.isAvailable ? 'text-emerald-600' : 'text-muted-foreground')}>
                                {slot.isAvailable ? 'Yes' : 'No'}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEditSlot(slot)}>
                                <Pencil className="h-3 w-3 mr-1" />Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500"
                                onClick={() => confirmDelete(slot, 'slot')}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Pricing Rules Section */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Pricing Rules
            </CardTitle>
            <Button size="sm" onClick={openCreateRule}>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pricingRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4" />
              <p>No pricing rules configured</p>
              <p className="text-xs mt-1">Add seasonal, group, early bird, or last minute rules</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3 p-4">
                {pricingRules.map(rule => {
                  const typeInfo = getRuleTypeInfo(rule);
                  return (
                    <div key={rule.id} className="p-3 rounded-lg border">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{rule.seasonName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className={cn('border text-xs', typeInfo.color)}>
                              {typeInfo.label}
                            </Badge>
                            <Badge variant={rule.isAvailable ? 'default' : 'destructive'} className="text-xs">
                              {rule.isAvailable ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {rule.startDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(rule.startDate), 'MMM d')} - {rule.endDate ? format(new Date(rule.endDate), 'MMM d, yyyy') : 'Open'}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                        <span>{rule.priceMultiplier}x multiplier</span>
                        <span>{rule.minGuests}{rule.maxGuests ? `-${rule.maxGuests}` : '+'} guests</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEditRule(rule)}>Edit</Button>
                        <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => confirmDelete(rule, 'rule')}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <ScrollArea className="max-h-[350px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Multiplier</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricingRules.map(rule => {
                        const typeInfo = getRuleTypeInfo(rule);
                        return (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{rule.seasonName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('border text-xs', typeInfo.color)}>
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{rule.startDate ? format(new Date(rule.startDate), 'MMM d, yyyy') : '—'}</TableCell>
                            <TableCell>{rule.endDate ? format(new Date(rule.endDate), 'MMM d, yyyy') : '—'}</TableCell>
                            <TableCell>
                              <span className="font-semibold flex items-center gap-1">
                                <DollarSign className="h-3 w-3 text-amber-500" />
                                {rule.priceMultiplier}x
                              </span>
                            </TableCell>
                            <TableCell>{rule.minGuests}{rule.maxGuests ? ` - ${rule.maxGuests}` : '+'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="outline" size="sm" onClick={() => openEditRule(rule)}>
                                  <Pencil className="h-3 w-3 mr-1" />Edit
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleToggleRule(rule)}>
                                  {rule.isAvailable ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-500"
                                  onClick={() => confirmDelete(rule, 'rule')}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Time Slot Dialog */}
      {/* ============================================================ */}
      <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Time Slot' : 'Add Time Slot'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update time slot details' : 'Define a new booking time slot'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm(p => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm(p => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Capacity (guests)</Label>
              <Input
                type="number"
                min={1}
                value={slotForm.capacity}
                onChange={(e) => setSlotForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))}
                placeholder="Max guests per slot"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Available for Booking</Label>
              <Switch
                checked={slotForm.isAvailable}
                onCheckedChange={(checked) => setSlotForm(p => ({ ...p, isAvailable: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSlotDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSlot} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Pricing Rule Dialog */}
      {/* ============================================================ */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update pricing and availability rule' : 'Configure seasonal pricing, group discounts, or time-based rules'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={ruleForm.seasonName}
                onChange={(e) => setRuleForm(p => ({ ...p, seasonName: e.target.value }))}
                placeholder="e.g. Peak Season, Group Rate, Early Bird"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={ruleForm.ruleType} onValueChange={(v) => setRuleForm(p => ({ ...p, ruleType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={ruleForm.startDate}
                  onChange={(e) => setRuleForm(p => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={ruleForm.endDate}
                  onChange={(e) => setRuleForm(p => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Price Multiplier</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ruleForm.priceMultiplier}
                  onChange={(e) => setRuleForm(p => ({ ...p, priceMultiplier: parseFloat(e.target.value) || 1 }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">x (e.g. 1.2 = 20% premium)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleForm.minGuests}
                  onChange={(e) => setRuleForm(p => ({ ...p, minGuests: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleForm.maxGuests}
                  onChange={(e) => setRuleForm(p => ({ ...p, maxGuests: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Available for Booking</Label>
              <Switch
                checked={ruleForm.isAvailable}
                onCheckedChange={(checked) => setRuleForm(p => ({ ...p, isAvailable: checked }))}
              />
            </div>
            {/* Price Preview */}
            {selectedExp && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">Price Preview</p>
                <p className="mt-1">
                  Base: ${selectedExp.basePrice.toFixed(2)} × {ruleForm.priceMultiplier}x ={' '}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ${(selectedExp.basePrice * ruleForm.priceMultiplier).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Delete Confirmation */}
      {/* ============================================================ */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteType === 'slot' ? 'Time Slot' : 'Pricing Rule'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteType === 'slot' ? 'time slot' : 'pricing rule'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
