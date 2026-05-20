'use client';

import { useState, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CreditCard,
  Plus,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Pause,
  RotateCcw,
  AlertTriangle,
  DollarSign,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { format } from 'date-fns';

interface ParkingSlot {
  id: string;
  number: string;
  floor: number;
  type: string;
  status: string;
}

interface ParkingPass {
  id: string;
  propertyId: string;
  vehicleId?: string | null;
  slotId?: string | null;
  holderName: string;
  holderEmail?: string | null;
  licensePlate: string;
  startDate: string;
  endDate: string;
  duration: string;
  amount: number;
  currency: string;
  status: string;
  autoRenew: boolean;
  paymentStatus: string;
  slot?: { id: string; number: string; floor: number; type: string } | null;
  vehicle?: { id: string; licensePlate: string; make?: string; model?: string; color?: string } | null;
}

const durationOptions = [
  { value: 'weekly', label: 'Weekly', priceMultiplier: 1 },
  { value: 'monthly', label: 'Monthly', priceMultiplier: 3.5 },
  { value: 'quarterly', label: 'Quarterly', priceMultiplier: 10 },
  { value: 'yearly', label: 'Yearly', priceMultiplier: 36 },
];

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', label: 'Active' },
  expired: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', label: 'Expired' },
  suspended: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', label: 'Suspended' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Cancelled' },
};

export default function MonthlyPasses() {
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [passes, setPasses] = useState<ParkingPass[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, suspended: 0, cancelled: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    holderName: '',
    holderEmail: '',
    holderPhone: '',
    licensePlate: '',
    slotId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    duration: 'monthly',
    amount: 0,
    autoRenew: false,
  });

  useEffect(() => {
    fetchPasses();
    if (propertyId) fetchSlots();
  }, [propertyId, statusFilter]);

  const fetchPasses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/parking/passes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPasses(data.data || []);
        setStats(data.stats || { total: 0, active: 0, expired: 0, suspended: 0, cancelled: 0, totalRevenue: 0 });
      }
    } catch (error) {
      console.error('Error fetching passes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await fetch(`/api/parking?propertyId=${propertyId}&status=available`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.holderName || !formData.licensePlate || !formData.startDate) {
      toast.error('Fill in required fields');
      return;
    }
    if (!propertyId) {
      toast.error('No property selected');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/parking/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, propertyId }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Pass created successfully');
        setDialogOpen(false);
        setFormData({
          holderName: '', holderEmail: '', holderPhone: '', licensePlate: '',
          slotId: '', startDate: format(new Date(), 'yyyy-MM-dd'), duration: 'monthly', amount: 0, autoRenew: false,
        });
        fetchPasses();
      } else {
        toast.error(data.error || 'Failed to create pass');
      }
    } catch (error) {
      toast.error('Failed to create pass');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch('/api/parking/passes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Pass ${action}d`);
        fetchPasses();
      } else {
        toast.error(data.error || 'Failed to update pass');
      }
    } catch (error) {
      toast.error('Failed to update pass');
    }
  };

  const getDaysUntilExpiry = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <CreditCard className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Monthly Passes
          </h2>
          <p className="text-sm text-muted-foreground">Manage parking passes and subscriptions</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)} className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="h-4 w-4 mr-2" /> New Pass
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Active', value: stats.active, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Expired', value: stats.expired, color: 'text-gray-500' },
          { label: 'Suspended', value: stats.suspended, color: 'text-amber-500' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-500' },
          { label: 'Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Pass List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parking Passes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : passes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No parking passes found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {passes.map(pass => {
                  const config = statusConfig[pass.status] || statusConfig.active;
                  const daysLeft = getDaysUntilExpiry(pass.endDate);
                  return (
                    <div key={pass.id} className="border rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pass.holderName}</span>
                            <Badge className={config.color}>{config.label}</Badge>
                            {pass.autoRenew && <Badge variant="outline" className="text-xs">Auto-renew</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>{pass.licensePlate}</span>
                            {pass.slot && <span>Slot: {pass.slot.number} (F{pass.slot.floor})</span>}
                            <span className="capitalize">{pass.duration}</span>
                            <span>{formatCurrency(pass.amount)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="h-3 w-3" />
                            <span>{format(new Date(pass.startDate), 'MMM d')} - {format(new Date(pass.endDate), 'MMM d, yyyy')}</span>
                            {pass.status === 'active' && daysLeft <= 7 && daysLeft > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" /> {daysLeft}d left
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          {pass.status === 'active' && (
                            <>
                              <Button size="sm" variant="outline" title="Renew"
                                onClick={() => handleAction(pass.id, 'renew')}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" title="Suspend"
                                onClick={() => handleAction(pass.id, 'suspend')}>
                                <Pause className="h-4 w-4 text-amber-500" />
                              </Button>
                              <Button size="sm" variant="outline" title="Cancel"
                                onClick={() => handleAction(pass.id, 'cancel')}>
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {pass.status === 'suspended' && (
                            <Button size="sm" variant="outline" onClick={() => handleAction(pass.id, 'renew')}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-1" /> Reactivate
                            </Button>
                          )}
                          {pass.status === 'expired' && (
                            <Button size="sm" variant="outline" onClick={() => handleAction(pass.id, 'renew')}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Renew
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Pass Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Parking Pass</DialogTitle>
            <DialogDescription>Create a new monthly, weekly, or yearly parking pass</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Holder Name *</Label>
                <Input value={formData.holderName} onChange={e => setFormData({ ...formData, holderName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>License Plate *</Label>
                <Input value={formData.licensePlate} onChange={e => setFormData({ ...formData, licensePlate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.holderEmail} onChange={e => setFormData({ ...formData, holderEmail: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.holderPhone} onChange={e => setFormData({ ...formData, holderPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Duration *</Label>
                <Select value={formData.duration} onValueChange={v => setFormData({ ...formData, duration: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {durationOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Parking Slot</Label>
                <Select value={formData.slotId} onValueChange={v => setFormData({ ...formData, slotId: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {slots.map(s => <SelectItem key={s.id} value={s.id}>Slot {s.number} (F{s.floor})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
