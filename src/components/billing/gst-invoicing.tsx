'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Plus, Search, RefreshCw, Download, Eye, XCircle, CheckCircle2,
  AlertCircle, Filter, Calendar, IndianRupee, Receipt, Zap, QrCode
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface EInvoice {
  id: string; irn: string | null; invoiceNumber: string | null; invoiceDate: string | null;
  totalValue: number; totalCgst: number; totalSgst: number; totalIgst: number; totalCess: number;
  totalTax: number; totalAmount: number; status: string; supplyType: string; placeOfSupply: string | null;
  ackNo: string | null; ackDate: string | null; reverseCharge: boolean; signedQrCode: string | null;
  property?: { id: string; name: string }; errorDetails?: string;
}

const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  generated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function GstInvoicingPage() {
  const [invoices, setInvoices] = useState<EInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<EInvoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPeriod, setBulkPeriod] = useState('');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (periodFilter) params.set('period', periodFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/tax/e-invoices?${params}`);
      const json = await res.json();
      if (json.success) setInvoices(json.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [statusFilter, periodFilter, search]);

  useEffect(() => {
    let cancelled = false;
    fetchInvoices().then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchInvoices]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this e-invoice? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/tax/e-invoices/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelReason: 'Cancelled by user' }) });
      const json = await res.json();
      if (json.success) { toast({ title: 'E-invoice cancelled' }); fetchInvoices(); }
      else { toast({ title: 'Error', description: json.error?.message, variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
  };

  const handleBulkGenerate = async () => {
    if (!bulkPeriod || bulkPeriod.length !== 6) { toast({ title: 'Error', description: 'Enter valid period (MMYYYY)', variant: 'destructive' }); return; }
    setBulkGenerating(true);
    try {
      const res = await fetch('/api/tax/e-invoices/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period: bulkPeriod, supplyType: 'b2b' }) });
      const json = await res.json();
      if (json.success) {
        toast({ title: `Generated ${json.data.generated} e-invoices`, description: 'Bulk generation complete' });
        setBulkOpen(false);
        fetchInvoices();
      } else { toast({ title: 'Error', description: json.error?.message, variant: 'destructive' }); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setBulkGenerating(false);
  };

  const totalTax = invoices.filter(i => i.status === 'generated').reduce((s, i) => s + i.totalTax, 0);
  const totalAmount = invoices.filter(i => i.status === 'generated').reduce((s, i) => s + i.totalAmount, 0);
  const pendingCount = invoices.filter(i => i.status === 'draft').length;
  const generatedCount = invoices.filter(i => i.status === 'generated').length;

  const currentMonth = `${String(new Date().getMonth() + 1).padStart(2, '0')}${new Date().getFullYear()}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-7 w-7" /> GST e-Invoicing
          </h1>
          <p className="text-muted-foreground mt-1">Generate and manage GST e-invoices with IRN</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><Zap className="h-4 w-4 mr-1" />Bulk Generate</Button>
          <Button size="sm" onClick={fetchInvoices}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Invoices</p><p className="font-bold text-lg">{invoices.length}</p></div></div></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Generated</p><p className="font-bold text-lg">{generatedCount}</p></div></div></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><IndianRupee className="h-5 w-5 text-amber-600" /></div><div><p className="text-sm text-muted-foreground">Total Tax</p><p className="font-bold text-lg">₹{totalTax.toLocaleString()}</p></div></div></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><IndianRupee className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Total Amount</p><p className="font-bold text-lg">₹{totalAmount.toLocaleString()}</p></div></div></Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search invoice # or IRN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="generated">Generated</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select>
          <Input placeholder="MMYYYY" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="w-full sm:w-32" maxLength={6} />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>IRN</TableHead><TableHead>Date</TableHead><TableHead>Supply Type</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8" /></TableCell></TableRow>) :
                  invoices.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No e-invoices found</p></TableCell></TableRow> :
                  invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.irn ? `${inv.irn.slice(0, 15)}...` : '-'}</TableCell>
                      <TableCell className="text-sm">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{inv.supplyType.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-right font-medium">₹{inv.totalValue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">₹{inv.totalTax.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">₹{inv.totalAmount.toLocaleString()}</TableCell>
                      <TableCell><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor[inv.status] || statusColor.draft}`}>{inv.status}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setDetailOpen(true); }}><Eye className="h-3 w-3" /></Button>
                          {(inv.status === 'generated' || inv.status === 'draft') && (
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(inv.id)}><XCircle className="h-3 w-3 text-red-500" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice Details</DialogTitle><DialogDescription>Full e-invoice information</DialogDescription></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1"><span className="text-muted-foreground">Invoice #</span><p className="font-mono font-semibold">{selectedInvoice.invoiceNumber}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">IRN</span><p className="font-mono text-xs break-all">{selectedInvoice.irn || 'N/A'}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">Date</span><p>{selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">Status</span><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[selectedInvoice.status]}`}>{selectedInvoice.status}</span></div>
                <div className="space-y-1"><span className="text-muted-foreground">Supply Type</span><p>{selectedInvoice.supplyType.toUpperCase()}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">Place of Supply</span><p>{selectedInvoice.placeOfSupply || '-'}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">Ack #</span><p className="font-mono text-xs">{selectedInvoice.ackNo || '-'}</p></div>
                <div className="space-y-1"><span className="text-muted-foreground">Reverse Charge</span><p>{selectedInvoice.reverseCharge ? 'Yes' : 'No'}</p></div>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Assessable Value</span><span className="font-mono">₹{selectedInvoice.totalValue.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">CGST</span><span className="font-mono">₹{selectedInvoice.totalCgst.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">SGST</span><span className="font-mono">₹{selectedInvoice.totalSgst.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">IGST</span><span className="font-mono">₹{selectedInvoice.totalIgst.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cess</span><span className="font-mono">₹{selectedInvoice.totalCess.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold border-t pt-2"><span>Total Tax</span><span className="font-mono">₹{selectedInvoice.totalTax.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg"><span>Total Amount</span><span className="font-mono">₹{selectedInvoice.totalAmount.toLocaleString()}</span></div>
              </div>
              {selectedInvoice.signedQrCode && (
                <div className="border-t pt-3"><p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><QrCode className="h-4 w-4" /> QR Code Data (Base64)</p><div className="bg-muted p-2 rounded text-xs font-mono break-all max-h-24 overflow-y-auto">{selectedInvoice.signedQrCode.slice(0, 200)}...</div></div>
              )}
              {selectedInvoice.errorDetails && (
                <div className="border-t pt-3"><p className="text-sm text-red-600 font-medium flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Error</p><p className="text-sm text-red-500 mt-1">{selectedInvoice.errorDetails}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bulk Generate E-Invoices</DialogTitle><DialogDescription>Generate e-invoices for all eligible invoices in a period</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Period (MMYYYY)</label><Input placeholder="052026" value={bulkPeriod} onChange={e => setBulkPeriod(e.target.value)} maxLength={6} className="mt-1" /></div>
            <p className="text-xs text-muted-foreground">This will generate e-invoices for all paid/sent invoices in the selected period that do not already have an IRN.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkGenerate} disabled={bulkGenerating}><Zap className="h-4 w-4 mr-1" />{bulkGenerating ? 'Generating...' : 'Generate'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
