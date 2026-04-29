'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface TransferItem {
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

interface Transfer {
  id: string;
  fromPropertyId: string;
  toPropertyId: string;
  status: string;
  reason?: string;
  notes?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  fromProperty: { id: string; name: string };
  toProperty: { id: string; name: string };
  items: TransferItem[];
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  requested: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: Clock, label: 'Requested' },
  approved: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', icon: CheckCircle2, label: 'Approved' },
  in_transit: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: Truck, label: 'In Transit' },
  completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2, label: 'Completed' },
  rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: XCircle, label: 'Rejected' },
};

export default function InterPropertyTransfer() {
  const { formatCurrency } = useCurrency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stockItems, setStockItems] = useState<Array<{ id: string; name: string; unit: string; unitCost: number; quantity: number; propertyId?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fromProperty, setFromProperty] = useState('');
  const [toProperty, setToProperty] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchProperties();
    fetchTransfers();
  }, [statusFilter]);

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/inventory/transfer?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockItems = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/inventory/stock?propertyId=${propertyId}&status=active`);
      if (res.ok) {
        const data = await res.json();
        setStockItems(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching stock items:', error);
    }
  };

  const handleFromPropertyChange = (value: string) => {
    setFromProperty(value);
    setToProperty('');
    setTransferItems([]);
    if (value) fetchStockItems(value);
  };

  const handleAddItem = () => {
    if (stockItems.length === 0) {
      toast.error('Select a source property first');
      return;
    }
    setTransferItems([...transferItems, {
      stockItemId: '',
      stockItemName: '',
      quantity: 1,
      unit: 'piece',
      unitCost: 0,
    }]);
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...transferItems];
    if (field === 'stockItemId') {
      const selectedItem = stockItems.find(i => i.id === value);
      if (selectedItem) {
        updated[index] = {
          ...updated[index],
          stockItemId: selectedItem.id,
          stockItemName: selectedItem.name,
          unit: selectedItem.unit,
          unitCost: selectedItem.unitCost,
        };
      }
    } else {
      (updated[index] as Record<string, unknown>)[field] = value;
    }
    setTransferItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!fromProperty || !toProperty) {
      toast.error('Select both source and destination properties');
      return;
    }
    if (transferItems.length === 0) {
      toast.error('Add at least one item to transfer');
      return;
    }
    if (transferItems.some(i => !i.stockItemId || i.quantity <= 0)) {
      toast.error('Fill in all item fields with valid quantities');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPropertyId: fromProperty,
          toPropertyId: toProperty,
          items: transferItems,
          reason,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Transfer request created successfully');
        setDialogOpen(false);
        resetForm();
        fetchTransfers();
      } else {
        toast.error(data.error || 'Failed to create transfer');
      }
    } catch (error) {
      toast.error('Failed to create transfer');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFromProperty('');
    setToProperty('');
    setReason('');
    setNotes('');
    setTransferItems([]);
    setStockItems([]);
  };

  const handleAction = async (id: string, status: string) => {
    try {
      const body: Record<string, unknown> = { id, status };
      if (status === 'rejected') {
        body.rejectionReason = rejectionReason;
      }

      const res = await fetch('/api/inventory/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Transfer ${status}`);
        fetchTransfers();
      } else {
        toast.error(data.error || 'Failed to update transfer');
      }
    } catch (error) {
      toast.error('Failed to update transfer');
    } finally {
      setRejectionDialogOpen(false);
      setRejectingTransferId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Inter-Property Transfers
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage inventory transfers between properties
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)} className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="h-4 w-4 mr-2" />
            New Transfer
          </Button>
        </div>
      </div>

      {/* Transfer List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transfer requests found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {transfers.map((transfer) => {
                  const config = statusConfig[transfer.status] || statusConfig.requested;
                  const StatusIcon = config.icon;
                  return (
                    <div key={transfer.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(transfer.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {transfer.status === 'requested' && (
                            <>
                              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => handleAction(transfer.id, 'approved')}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => { setRejectingTransferId(transfer.id); setRejectionDialogOpen(true); }}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {transfer.status === 'approved' && (
                            <Button size="sm" variant="outline"
                              onClick={() => handleAction(transfer.id, 'in_transit')}>
                              <Truck className="h-4 w-4 mr-1" /> Ship
                            </Button>
                          )}
                          {transfer.status === 'in_transit' && (
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleAction(transfer.id, 'completed')}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{transfer.fromProperty.name}</span>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{transfer.toProperty.name}</span>
                      </div>

                      {transfer.items.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {transfer.items.map((item, i) => (
                              <div key={i} className="text-sm flex justify-between">
                                <span>{item.stockItemName}</span>
                                <span className="font-medium">{item.quantity} {item.unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {transfer.reason && (
                        <p className="text-sm text-muted-foreground">Reason: {transfer.reason}</p>
                      )}
                      {transfer.status === 'rejected' && transfer.rejectionReason && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Rejection: {transfer.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Transfer Request</DialogTitle>
            <DialogDescription>Create a new inter-property inventory transfer</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Property *</Label>
                <Select value={fromProperty} onValueChange={handleFromPropertyChange}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Property *</Label>
                <Select value={toProperty} onValueChange={setToProperty}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {properties.filter(p => p.id !== fromProperty).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Reason for transfer" value={reason} onChange={e => setReason(e.target.value)} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
              {transferItems.length > 0 ? (
                <div className="space-y-2">
                  {transferItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={item.stockItemId} onValueChange={v => handleItemChange(index, 'stockItemId', v)}>
                          <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>
                            {stockItems.filter(si => !transferItems.some(ti => ti.stockItemId === si.id && ti.stockItemId !== item.stockItemId)).map(si => (
                              <SelectItem key={si.id} value={si.id}>{si.name} ({si.quantity} {si.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input type="number" min="1" className="w-24" value={item.quantity}
                        onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} />
                      <span className="text-sm text-muted-foreground pb-2">{item.unit}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveItem(index)}>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground border rounded-lg">
                  Select a source property, then add items
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transfer</DialogTitle>
            <DialogDescription>Please provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => rejectingTransferId && handleAction(rejectingTransferId, 'rejected')}
              className="bg-red-500 hover:bg-red-600">
              Reject Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
