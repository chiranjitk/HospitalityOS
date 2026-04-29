'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  DollarSign,
  Loader2,
  Clock,
  Coffee,
  Utensils,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from 'next-intl';

interface Property {
  id: string;
  name: string;
  currency: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  currency: string;
  propertyId: string;
}

interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  currency: string;
  mealPlan: string;
  minStay: number;
  maxStay?: number;
  cancellationPolicy?: string;
  cancellationHours?: number;
  status: string;
  roomType?: RoomType;
  overridesCount?: number;
  // Derivation fields
  derivedFromId?: string | null;
  derivationType?: 'percentage' | 'fixed' | null;
  derivationValue?: number | null;
  derivedFrom?: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
  } | null;
}

const mealPlans = [
  { value: 'room_only', label: 'Room Only', icon: Tag },
  { value: 'bed_breakfast', label: 'Bed & Breakfast', icon: Coffee },
  { value: 'half_board', label: 'Half Board', icon: Utensils },
  { value: 'full_board', label: 'Full Board', icon: Utensils },
  { value: 'all_inclusive', label: 'All Inclusive', icon: Utensils },
];

const cancellationPolicies = [
  { value: 'flexible', label: 'Flexible (24h before)', hours: 24 },
  { value: 'moderate', label: 'Moderate (48h before)', hours: 48 },
  { value: 'strict', label: 'Strict (7 days before)', hours: 168 },
  { value: 'non_refundable', label: 'Non-refundable', hours: 0 },
];

export function RatePlansManager() {
  const t = useTranslations('pms');
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    roomTypeId: '',
    name: '',
    code: '',
    description: '',
    basePrice: '',
    mealPlan: 'room_only',
    minStay: 1,
    maxStay: '',
    cancellationPolicy: 'moderate',
    status: 'active',
    // Derivation fields
    derivedFromId: '',
    derivationType: 'percentage' as 'percentage' | 'fixed',
    derivationValue: '',
  });

  // Fetch properties
  useEffect(() => {
    const controller = new AbortController();
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API error ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
    return () => controller.abort();
  }, []);

  // Fetch room types
  useEffect(() => {
    const controller = new AbortController();
    const fetchRoomTypes = async () => {
      try {
        const params = new URLSearchParams();
        if (propertyFilter !== 'all') {
          params.append('propertyId', propertyFilter);
        }
        const response = await fetch(`/api/room-types?${params.toString()}`);
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API error ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
          if (result.data.length > 0 && !formData.roomTypeId) {
            setFormData(prev => ({ ...prev, roomTypeId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
    return () => controller.abort();
  }, [propertyFilter]);

  // Fetch rate plans
  const fetchRatePlans = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/rate-plans?${params.toString()}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        setRatePlans(result.data);
      }
    } catch (error) {
      console.error('Error fetching rate plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rate plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchRatePlans();
    return () => controller.abort();
  }, [propertyFilter, statusFilter]);

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .substring(0, 8);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      code: generateCode(name),
    }));
  };

  // Create rate plan
  const handleCreate = async () => {
    if (!formData.roomTypeId || !formData.name || !formData.code || !formData.basePrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        basePrice: parseFloat(formData.basePrice) || 0,
        maxStay: formData.maxStay ? parseInt(formData.maxStay) : null,
        cancellationHours: cancellationPolicies.find(p => p.value === formData.cancellationPolicy)?.hours,
      };

      // Include derivation fields if deriving from another plan
      if (formData.derivedFromId) {
        payload.derivedFromId = formData.derivedFromId;
        payload.derivationType = formData.derivationType;
        payload.derivationValue = parseFloat(formData.derivationValue) || 0;
      }

      const response = await fetch('/api/rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchRatePlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update rate plan
  const handleUpdate = async () => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rate-plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          maxStay: formData.maxStay ? parseInt(formData.maxStay) : null,
          cancellationHours: cancellationPolicies.find(p => p.value === formData.cancellationPolicy)?.hours,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan updated successfully',
        });
        setIsEditOpen(false);
        setSelectedPlan(null);
        fetchRatePlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete rate plan
  const handleDelete = async () => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rate-plans/${selectedPlan.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedPlan(null);
        fetchRatePlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (plan: RatePlan) => {
    setSelectedPlan(plan);
    setFormData({
      roomTypeId: plan.roomTypeId,
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      basePrice: plan.basePrice.toString(),
      mealPlan: plan.mealPlan,
      minStay: plan.minStay,
      maxStay: plan.maxStay?.toString() || '',
      cancellationPolicy: plan.cancellationPolicy || 'moderate',
      status: plan.status,
      // Derivation fields (read-only in edit)
      derivedFromId: plan.derivedFromId || '',
      derivationType: (plan.derivationType as 'percentage' | 'fixed') || 'percentage',
      derivationValue: plan.derivationValue?.toString() || '',
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (plan: RatePlan) => {
    setSelectedPlan(plan);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      roomTypeId: roomTypes[0]?.id || '',
      name: '',
      code: '',
      description: '',
      basePrice: '',
      mealPlan: 'room_only',
      minStay: 1,
      maxStay: '',
      cancellationPolicy: 'moderate',
      status: 'active',
      // Derivation fields
      derivedFromId: '',
      derivationType: 'percentage',
      derivationValue: '',
    });
  };

  // Filter rate plans by search query
  const filteredPlans = ratePlans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMealPlanLabel = (value: string) => {
    return mealPlans.find(m => m.value === value)?.label || value;
  };

  const getCancellationLabel = (value?: string) => {
    return cancellationPolicies.find(c => c.value === value)?.label || value || 'Not set';
  };

  const getRoomTypeName = (roomTypeId: string) => {
    const plan = ratePlans.find(p => p.roomTypeId === roomTypeId);
    return plan?.roomType?.name || roomTypes.find(rt => rt.id === roomTypeId)?.name || 'Unknown';
  };

  const getDerivationLabel = (plan: RatePlan): string | null => {
    if (!plan.derivedFrom || !plan.derivationType || plan.derivationValue == null) return null;
    const sign = plan.derivationValue < 0 ? '-' : '+';
    const absVal = Math.abs(plan.derivationValue);
    if (plan.derivationType === 'percentage') {
      return `${plan.name} = ${plan.derivedFrom.name} ${sign}${absVal}%`;
    }
    return `${plan.name} = ${plan.derivedFrom.name} ${sign}${absVal}`;
  };

  // Filter rate plans for derivation dropdown: only show plans for the selected room type
  const derivationCandidates = formData.roomTypeId
    ? ratePlans.filter(p => p.roomTypeId === formData.roomTypeId && p.status === 'active' && !p.derivedFromId)
    : [];

  // Computed derived base price preview
  const derivedBasePreview = (() => {
    if (!formData.derivedFromId || !formData.derivationValue) return null;
    const parent = ratePlans.find(p => p.id === formData.derivedFromId);
    if (!parent) return null;
    const val = parseFloat(formData.derivationValue) || 0;
    if (formData.derivationType === 'percentage') {
      return Math.max(0, parent.basePrice * (1 + val / 100));
    }
    return Math.max(0, parent.basePrice + val);
  })();

  // Stats
  const stats = {
    total: ratePlans.length,
    active: ratePlans.filter(p => p.status === 'active').length,
    avgPrice: ratePlans.length > 0
      ? Math.round(ratePlans.reduce((sum, p) => sum + p.basePrice, 0) / ratePlans.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Rate Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage pricing plans for your room types
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rate Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Rate Plans</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{stats.active}</div>
          <div className="text-xs text-muted-foreground">Active Plans</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</div>
          <div className="text-xs text-muted-foreground">Avg Base Price</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rate plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rate Plans Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mb-4" />
              <p>No rate plans found</p>
              <p className="text-sm">Create your first rate plan to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Meal Plan</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Min Stay</TableHead>
                  <TableHead>Cancellation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.code}</p>
                        {getDerivationLabel(plan) && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-violet-600 dark:text-violet-400">
                            <GitBranch className="h-3 w-3" />
                            <span>{getDerivationLabel(plan)}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRoomTypeName(plan.roomTypeId)}</Badge>
                    </TableCell>
                    <TableCell>{getMealPlanLabel(plan.mealPlan)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{formatCurrency(plan.basePrice)}</span>
                        {plan.derivedFrom && (
                          <p className="text-xs text-muted-foreground">
                            from {formatCurrency(plan.derivedFrom.basePrice)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{plan.minStay} night{plan.minStay > 1 ? 's' : ''}</TableCell>
                    <TableCell className="text-sm">{getCancellationLabel(plan.cancellationPolicy)}</TableCell>
                    <TableCell>
                      <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                        {plan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(plan)}
                          aria-label="Edit rate plan"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(plan)}
                          className="text-destructive"
                          aria-label="Delete rate plan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Rate Plan</DialogTitle>
            <DialogDescription>
              Define a new pricing plan
            </DialogDescription>
          </DialogHeader>
          <RatePlanForm
            formData={formData}
            setFormData={setFormData}
            roomTypes={roomTypes}
            ratePlans={ratePlans}
            onNameChange={handleNameChange}
            derivedBasePreview={derivedBasePreview}
            derivationCandidates={derivationCandidates}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rate Plan</DialogTitle>
            <DialogDescription>
              Update rate plan details
            </DialogDescription>
          </DialogHeader>
          <RatePlanForm
            formData={formData}
            setFormData={setFormData}
            roomTypes={roomTypes}
            ratePlans={ratePlans}
            onNameChange={handleNameChange}
            isEdit
            derivedBasePreview={derivedBasePreview}
            derivationCandidates={derivationCandidates}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rate Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedPlan?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Rate Plan Form Component
interface RatePlanFormData {
  roomTypeId: string;
  name: string;
  code: string;
  description: string;
  basePrice: string;
  mealPlan: string;
  minStay: number;
  maxStay: string;
  cancellationPolicy: string;
  status: string;
  // Derivation fields
  derivedFromId: string;
  derivationType: 'percentage' | 'fixed';
  derivationValue: string;
}

interface RatePlanFormProps {
  formData: RatePlanFormData;
  setFormData: React.Dispatch<React.SetStateAction<RatePlanFormData>>;
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  onNameChange: (name: string) => void;
  isEdit?: boolean;
  derivedBasePreview?: number | null;
  derivationCandidates: RatePlan[];
}

function RatePlanForm({ formData, setFormData, roomTypes, ratePlans, onNameChange, isEdit, derivedBasePreview, derivationCandidates }: RatePlanFormProps) {
  const { formatCurrency } = useCurrency();
  const isDerived = !!formData.derivedFromId;

  const handleDerivedFromChange = (value: string) => {
    if (value === 'none') {
      setFormData(prev => ({ ...prev, derivedFromId: '', derivationValue: '', basePrice: '' }));
    } else {
      setFormData(prev => ({ ...prev, derivedFromId: value }));
    }
  };

  return (
    <div className="grid gap-4 py-4">
      {/* Derivation Section (create only) */}
      {!isEdit && (
        <div className={cn(
          'rounded-lg border p-4 space-y-3',
          isDerived && 'border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/30'
        )}>
          <div className="flex items-center gap-2 font-medium text-sm">
            <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Derive from Existing Plan (Optional)
          </div>
          <div className="space-y-2">
            <Select
              value={formData.derivedFromId || 'none'}
              onValueChange={handleDerivedFromChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (standalone plan)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (standalone plan)</SelectItem>
                {derivationCandidates.map(rp => (
                  <SelectItem key={rp.id} value={rp.id}>
                    {rp.name} ({formatCurrency(rp.basePrice)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isDerived && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Adjustment Type</Label>
                  <Select
                    value={formData.derivationType}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, derivationType: v as 'percentage' | 'fixed' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Adjustment Value</Label>
                  <div className="relative">
                    {formData.derivationType === 'percentage' ? (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    ) : (
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Input
                      type="number"
                      className={formData.derivationType === 'percentage' ? 'pl-7' : 'pl-9'}
                      value={formData.derivationValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, derivationValue: e.target.value }))}
                      placeholder={formData.derivationType === 'percentage' ? '-15' : '-20'}
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
              {derivedBasePreview !== null && (
                <div className="flex items-center gap-2 text-sm bg-background rounded-md px-3 py-2 border">
                  <ArrowRight className="h-4 w-4 text-violet-500" />
                  <span className="text-muted-foreground">Calculated base price:</span>
                  <span className="font-semibold">{formatCurrency(derivedBasePreview)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Room Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="roomTypeId">Room Type *</Label>
        <Select
          value={formData.roomTypeId as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, roomTypeId: value, derivedFromId: '' }))}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room type" />
          </SelectTrigger>
          <SelectContent>
            {roomTypes.map(rt => (
              <SelectItem key={rt.id} value={rt.id}>
                {rt.name} ({formatCurrency(rt.basePrice)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name and Code */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name as string}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Standard Rate"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={formData.code as string}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="STD"
            maxLength={10}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description as string}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Rate plan description..."
          rows={2}
        />
      </div>

      {/* Base Price and Meal Plan */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="basePrice">
            Base Price *
            {isEdit && formData.derivedFromId && (
              <span className="text-xs text-violet-600 dark:text-violet-400 ml-2">(auto-derived)</span>
            )}
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="basePrice"
              type="number"
              className="pl-9"
              min={0}
              value={isDerived && !isEdit && derivedBasePreview !== null ? derivedBasePreview.toFixed(2) : (formData.basePrice as string)}
              onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
              placeholder="199.00"
              step="0.01"
              disabled={isDerived && !isEdit}
            />
          </div>
          {isDerived && !isEdit && derivedBasePreview !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              Auto-calculated from parent plan
            </p>
          )}
          {isEdit && formData.derivedFromId && (
            <p className="text-xs text-muted-foreground mt-1">
              Derived from: {ratePlans.find(rp => rp.id === formData.derivedFromId)?.name || 'Unknown'}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mealPlan">Meal Plan</Label>
          <Select
            value={formData.mealPlan as string}
            onValueChange={(value) => setFormData(prev => ({ ...prev, mealPlan: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mealPlans.map(mp => (
                <SelectItem key={mp.value} value={mp.value}>{mp.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Min/Max Stay */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minStay">Min Stay (nights)</Label>
          <Input
            id="minStay"
            type="number"
            min="1"
            value={formData.minStay as number}
            onChange={(e) => setFormData(prev => ({ ...prev, minStay: parseInt(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxStay">Max Stay (optional)</Label>
          <Input
            id="maxStay"
            type="number"
            min="1"
            value={formData.maxStay as string}
            onChange={(e) => setFormData(prev => ({ ...prev, maxStay: e.target.value }))}
            placeholder="No limit"
          />
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="space-y-2">
        <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
        <Select
          value={formData.cancellationPolicy as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, cancellationPolicy: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cancellationPolicies.map(cp => (
              <SelectItem key={cp.value} value={cp.value}>{cp.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
