'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Handshake, Plus, Search, Loader2, Pencil, Trash2, Eye, RefreshCw, Building2, Mail, Phone, BadgePercent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['Adventure', 'Wellness', 'Dining', 'Cultural', 'Water Sports', 'Nature', 'Entertainment', 'Transportation', 'Custom'];

interface Vendor {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  commissionRate: number;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

const defaultForm = {
  companyName: '', contactPerson: '', email: '', phone: '', address: '',
  category: '', commissionRate: 0, bankAccountName: '', bankAccountNumber: '',
  bankIfsc: '', status: 'active', notes: '',
};

export default function ExperienceVendors() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/experience-vendors?${params}`);
      const result = await res.json();
      if (result.success) setVendors(result.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch vendors', variant: 'destructive' });
    } finally { setIsLoading(false); }
  }, [categoryFilter, statusFilter, toast]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleSave = async () => {
    if (!formData.companyName || !formData.contactPerson || !formData.email) {
      toast({ title: 'Error', description: 'Company, contact person, and email are required', variant: 'destructive' }); return;
    }
    setIsSaving(true);
    try {
      const method = isEditOpen ? 'PUT' : 'POST';
      const body = isEditOpen && selectedVendor ? { id: selectedVendor.id, ...formData } : formData;
      const res = await fetch('/api/experience-vendors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: isEditOpen ? 'Vendor updated' : 'Vendor created' });
        setIsCreateOpen(false); setIsEditOpen(false);
        if (!isEditOpen) setFormData(defaultForm);
        fetchVendors();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Failed to save vendor', variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedVendor?.id) return;
    try {
      const res = await fetch('/api/experience-vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedVendor.id }) });
      const result = await res.json();
      if (result.success) { toast({ title: 'Success', description: 'Vendor deleted' }); setIsDeleteOpen(false); fetchVendors(); }
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }); }
  };

  const openEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor); setIsEditOpen(true);
    setFormData({
      companyName: vendor.companyName, contactPerson: vendor.contactPerson, email: vendor.email,
      phone: vendor.phone || '', address: vendor.address || '', category: vendor.category || '',
      commissionRate: vendor.commissionRate, bankAccountName: vendor.bankAccountName || '',
      bankAccountNumber: vendor.bankAccountNumber || '', bankIfsc: vendor.bankIfsc || '',
      status: vendor.status, notes: vendor.notes || '',
    });
  };

  const filteredVendors = vendors.filter(v =>
    !searchQuery || v.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Handshake className="h-5 w-5" /> Vendor Management</h2>
          <p className="text-sm text-muted-foreground">Manage external experience providers and partners</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVendors}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button onClick={() => { setFormData(defaultForm); setIsCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10"><Building2 className="h-4 w-4 text-violet-500" /></div>
            <div><div className="text-2xl font-bold">{vendors.length}</div><div className="text-xs text-muted-foreground">Total Vendors</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10"><Handshake className="h-4 w-4 text-primary" /></div>
            <div><div className="text-2xl font-bold">{vendors.filter(v => v.status === 'active').length}</div><div className="text-xs text-muted-foreground">Active</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10"><BadgePercent className="h-4 w-4 text-amber-500" /></div>
            <div><div className="text-2xl font-bold">{vendors.length > 0 ? (vendors.reduce((s, v) => s + v.commissionRate, 0) / vendors.length).toFixed(1) : '0'}%</div><div className="text-xs text-muted-foreground">Avg Commission</div></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search vendors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Handshake className="h-12 w-12 mb-4" /><p>No vendors found</p>
            </div>
          ) : (
            <>
              <div className="sm:hidden space-y-3 p-4">
                {filteredVendors.map(v => (
                  <div key={v.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between mb-1">
                      <p className="font-medium truncate">{v.companyName}</p>
                      <Badge variant="secondary" className={cn('text-white text-xs', v.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500')}>{v.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{v.contactPerson}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{v.email}</span>
                      <span>{v.commissionRate}% commission</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => { setSelectedVendor(v); setIsDetailOpen(true); }}>View</Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEdit(v)}>Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.map(v => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{v.companyName}</p>
                              <p className="text-xs text-muted-foreground">{v.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{v.contactPerson}</p>
                              {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{v.category ? <Badge variant="outline">{v.category}</Badge> : '-'}</TableCell>
                          <TableCell><span className="font-medium">{v.commissionRate}%</span></TableCell>
                          <TableCell><Badge variant="secondary" className={cn('text-white', v.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500')}>{v.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedVendor(v); setIsDetailOpen(true); }}><Eye className="h-3 w-3 mr-1" />View</Button>
                              <Button variant="outline" size="sm" onClick={() => openEdit(v)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="outline" size="sm" className="text-red-500" onClick={() => { setSelectedVendor(v); setIsDeleteOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setIsEditOpen(false); } }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
            <DialogDescription>{isEditOpen ? 'Update vendor information' : 'Register a new experience partner'}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Company Name *</Label><Input value={formData.companyName} onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Contact Person *</Label><Input value={formData.contactPerson} onChange={(e) => setFormData(p => ({ ...p, contactPerson: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Commission %</Label><Input type="number" step="0.01" value={formData.commissionRate} onChange={(e) => setFormData(p => ({ ...p, commissionRate: parseFloat(e.target.value) || 0 }))} /></div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm mb-3">Bank Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Account Name</Label><Input value={formData.bankAccountName} onChange={(e) => setFormData(p => ({ ...p, bankAccountName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Account Number</Label><Input value={formData.bankAccountNumber} onChange={(e) => setFormData(p => ({ ...p, bankAccountNumber: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>IFSC Code</Label><Input value={formData.bankIfsc} onChange={(e) => setFormData(p => ({ ...p, bankIfsc: e.target.value }))} /></div>
                </div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Internal notes..." /></div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditOpen ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Vendor Details</DialogTitle></DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{selectedVendor.companyName}</h3>
                  {selectedVendor.category && <Badge variant="outline" className="mt-1">{selectedVendor.category}</Badge>}
                </div>
                <Badge variant="secondary" className={cn('text-white', selectedVendor.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500')}>{selectedVendor.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Contact:</span><p className="font-medium">{selectedVendor.contactPerson}</p></div>
                <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{selectedVendor.email}</p></div>
                <div><span className="text-muted-foreground">Phone:</span><p className="font-medium">{selectedVendor.phone || '-'}</p></div>
                <div><span className="text-muted-foreground">Commission:</span><p className="font-medium">{selectedVendor.commissionRate}%</p></div>
              </div>
              {selectedVendor.address && <div><span className="text-sm text-muted-foreground">Address:</span><p className="text-sm mt-1">{selectedVendor.address}</p></div>}
              {selectedVendor.bankAccountName && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Bank Details</p>
                  <p className="text-sm">{selectedVendor.bankAccountName}</p>
                  {selectedVendor.bankAccountNumber && <p className="text-sm text-muted-foreground">A/C: {selectedVendor.bankAccountNumber}</p>}
                  {selectedVendor.bankIfsc && <p className="text-sm text-muted-foreground">IFSC: {selectedVendor.bankIfsc}</p>}
                </div>
              )}
              {selectedVendor.notes && <div><span className="text-sm text-muted-foreground">Notes:</span><p className="text-sm mt-1">{selectedVendor.notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete &quot;{selectedVendor?.companyName}&quot;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


