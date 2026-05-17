'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Shield,
  Plus,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  FileText,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TaxExemption {
  id: string;
  bookingId: string | null;
  folioId: string | null;
  guestId: string;
  exemptionType: string;
  certificateNumber: string | null;
  certificateUrl: string | null;
  issuingAuthority: string | null;
  exemptTaxTypes: string[];
  exemptAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface TaxExemptionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  totalExemptAmount: number;
}

const EXEMPTION_TYPES = [
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'government', label: 'Government' },
  { value: 'inter_state', label: 'Inter-State' },
  { value: 'export', label: 'Export' },
  { value: 'charity', label: 'Charity / Non-Profit' },
  { value: 'other', label: 'Other' },
];

const TAX_TYPE_OPTIONS = [
  { value: 'gst', label: 'GST' },
  { value: 'service_tax', label: 'Service Tax' },
  { value: 'luxury_tax', label: 'Luxury Tax' },
  { value: 'vat', label: 'VAT' },
  { value: 'city_tax', label: 'City Tax' },
  { value: 'tourism_tax', label: 'Tourism Tax' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" /> },
  expired: { label: 'Expired', color: 'bg-gray-500/10 text-gray-600 border-gray-200', icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function TaxExemptions() {
  const { toast } = useToast();
  const [exemptions, setExemptions] = useState<TaxExemption[]>([]);
  const [stats, setStats] = useState<TaxExemptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    guestId: '',
    bookingId: '',
    folioId: '',
    exemptionType: '',
    certificateNumber: '',
    certificateUrl: '',
    issuingAuthority: '',
    exemptTaxTypes: [] as string[],
    exemptAmount: '',
    expiresAt: '',
    notes: '',
  });

  const fetchExemptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/billing/tax-exemptions?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setExemptions(result.data);
        setStats(result.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch tax exemptions', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchExemptions();
  }, [fetchExemptions]);

  const resetForm = () => {
    setFormData({
      guestId: '',
      bookingId: '',
      folioId: '',
      exemptionType: '',
      certificateNumber: '',
      certificateUrl: '',
      issuingAuthority: '',
      exemptTaxTypes: [],
      exemptAmount: '',
      expiresAt: '',
      notes: '',
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.guestId || !formData.exemptionType || formData.exemptTaxTypes.length === 0 || !formData.exemptAmount) {
      toast({ title: 'Validation Error', description: 'Guest, exemption type, tax types, and amount are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/tax-exemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          exemptAmount: parseFloat(formData.exemptAmount),
          exemptTaxTypes: formData.exemptTaxTypes,
          bookingId: formData.bookingId || undefined,
          folioId: formData.folioId || undefined,
          expiresAt: formData.expiresAt || undefined,
          certificateUrl: formData.certificateUrl || undefined,
          issuingAuthority: formData.issuingAuthority || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Tax exemption request created' });
        setIsDialogOpen(false);
        fetchExemptions();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create exemption', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create tax exemption', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (exemptionId: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/tax-exemptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: exemptionId, status: 'approved', notes: 'Approved by finance team' }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Tax exemption approved. Zero-tax line items created.' });
        fetchExemptions();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to approve', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve exemption', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async (exemptionId: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/tax-exemptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: exemptionId, status: 'rejected', notes: 'Rejected — invalid certificate' }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Tax exemption rejected' });
        fetchExemptions();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to reject', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reject exemption', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (exemptionId: string) => {
    try {
      const res = await fetch(`/api/billing/tax-exemptions?id=${exemptionId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Exemption cancelled' });
        fetchExemptions();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel exemption', variant: 'destructive' });
    }
  };

  const toggleTaxType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      exemptTaxTypes: prev.exemptTaxTypes.includes(type)
        ? prev.exemptTaxTypes.filter((t) => t !== type)
        : [...prev.exemptTaxTypes, type],
    }));
  };

  const filtered = exemptions.filter(
    (e) =>
      !searchQuery ||
      e.certificateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.exemptionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            Tax Exemptions
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage tax exemption requests with approval workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchExemptions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Exemption
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-foreground' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600' },
            { label: 'Total Exempt', value: `$${stats.totalExemptAmount.toLocaleString()}`, icon: Shield, color: 'text-teal-600' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-muted">
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
                <div>
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by certificate, type, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4" />
              <p>No tax exemptions found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Tax Types</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((exemption) => {
                    const statusCfg = STATUS_CONFIG[exemption.status] || STATUS_CONFIG.pending;
                    return (
                      <TableRow key={exemption.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {exemption.exemptionType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm">{exemption.certificateNumber || 'N/A'}</p>
                            {exemption.issuingAuthority && (
                              <p className="text-xs text-muted-foreground">{exemption.issuingAuthority}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {exemption.exemptTaxTypes.map((type) => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${exemption.exemptAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1', statusCfg.color)}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(exemption.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {exemption.status === 'pending' && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => handleApprove(exemption.id)} disabled={isSaving}>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleReject(exemption.id)} disabled={isSaving}>
                                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </>
                            )}
                            {exemption.status !== 'expired' && (
                              <Button variant="ghost" size="sm" onClick={() => handleCancel(exemption.id)}>
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Exemption Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              New Tax Exemption Request
            </DialogTitle>
            <DialogDescription>
              Submit a tax exemption request for review and approval
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest ID</Label>
                <Input
                  placeholder="Enter guest ID"
                  value={formData.guestId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, guestId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Exemption Type</Label>
                <Select
                  value={formData.exemptionType}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, exemptionType: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXEMPTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificate Number</Label>
                <Input
                  placeholder="e.g., DIP-2024-001"
                  value={formData.certificateNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, certificateNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Issuing Authority</Label>
                <Input
                  placeholder="e.g., Ministry of Foreign Affairs"
                  value={formData.issuingAuthority}
                  onChange={(e) => setFormData((prev) => ({ ...prev, issuingAuthority: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Exempt Tax Types</Label>
              <div className="flex flex-wrap gap-2">
                {TAX_TYPE_OPTIONS.map((type) => (
                  <Badge
                    key={type.value}
                    variant={formData.exemptTaxTypes.includes(type.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTaxType(type.value)}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exempt Amount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={formData.exemptAmount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, exemptAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes for the reviewer..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
