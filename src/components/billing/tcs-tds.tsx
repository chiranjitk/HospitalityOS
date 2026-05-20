'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Percent, Plus, Search, RefreshCw, IndianRupee, Download, Calendar, AlertCircle,
  CheckCircle2, Clock, ArrowDownToLine, ArrowUpFromLine, FileText, Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface TcsRecord {
  id: string; guestName: string | null; panNumber: string | null; collectionDate: string;
  bookingAmount: number; tcsRate: number; tcsAmount: number; thresholdExceeded: boolean;
  status: string; period: string; challanNo: string | null; challanDate: string | null;
  depositedAmount: number | null; property?: { id: string; name: string };
}

interface TdsRecord {
  id: string; vendorName: string | null; panNumber: string | null; section: string;
  paymentDate: string; paymentAmount: number; tdsRate: number; tdsAmount: number;
  status: string; period: string; challanNo: string | null; challanDate: string | null;
  depositedAmount: number | null; property?: { id: string; name: string };
}

const statusColor: Record<string, string> = {
  collected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  deducted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  deposited: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function TcsTdsPage() {
  const [tcsRecords, setTcsRecords] = useState<TcsRecord[]>([]);
  const [tdsRecords, setTdsRecords] = useState<TdsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tcs');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [tcsDialogOpen, setTcsDialogOpen] = useState(false);
  const [tdsDialogOpen, setTdsDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchTcs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (periodFilter) params.set('period', periodFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/tax/tcs?${params}`);
      const json = await res.json();
      if (json.success) setTcsRecords(json.data || []);
    } catch { /* silent */ }
  }, [statusFilter, periodFilter, search]);

  const fetchTds = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (periodFilter) params.set('period', periodFilter);
      if (sectionFilter && sectionFilter !== 'all') params.set('section', sectionFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/tax/tds?${params}`);
      const json = await res.json();
      if (json.success) setTdsRecords(json.data || []);
    } catch { /* silent */ }
  }, [statusFilter, periodFilter, sectionFilter, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchTcs(), fetchTds()]).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchTcs, fetchTds]);

  const handleCreateTcs = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/tax/tcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) { toast({ title: 'TCS record created' }); setTcsDialogOpen(false); fetchTcs(); }
      else { toast({ title: 'Error', description: json.error?.message, variant: 'destructive' }); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setSaving(false);
  };

  const handleCreateTds = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/tax/tds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) { toast({ title: 'TDS record created' }); setTdsDialogOpen(false); fetchTds(); }
      else { toast({ title: 'Error', description: json.error?.message, variant: 'destructive' }); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setSaving(false);
  };

  const tcsTotal = tcsRecords.reduce((s, r) => s + r.tcsAmount, 0);
  const tcsDeposited = tcsRecords.filter(r => r.status === 'deposited').reduce((s, r) => s + (r.depositedAmount || 0), 0);
  const tdsTotal = tdsRecords.reduce((s, r) => s + r.tdsAmount, 0);
  const tdsDeposited = tdsRecords.filter(r => r.status === 'deposited').reduce((s, r) => s + (r.depositedAmount || 0), 0);

  // Compliance calendar dates for 2025-2026
  const complianceDates = [
    { title: 'TCS Deposit (Section 206C(1G))', due: '7th of following month', penalty: '₹200/day' },
    { title: 'TDS Deposit (All Sections)', due: '7th of following month', penalty: '₹200/day' },
    { title: 'TDS Return (Form 26Q)', due: '31st July', penalty: '₹200/day' },
    { title: 'TDS Return (Form 27Q)', due: '31st October', penalty: '₹200/day' },
    { title: 'TDS Return (Form 27EQ)', due: '31st May', penalty: '₹200/day' },
    { title: 'TCS Return (Form 27EQ)', due: '31st May', penalty: '₹200/day' },
    { title: 'GSTR-1 Filing', due: '11th of following month', penalty: '₹50/day (₹20 for nil)' },
    { title: 'GSTR-3B Filing', due: '20th of following month', penalty: '₹50/day (₹20 for nil)' },
    { title: 'Annual Return (GSTR-9)', due: '31st December', penalty: '₹200/day' },
  ];

  const currentPeriod = `${String(new Date().getMonth() + 1).padStart(2, '0')}${new Date().getFullYear()}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Percent className="h-7 w-7" /> TCS/TDS Tracking</h1>
          <p className="text-muted-foreground mt-1">Track tax collection and deduction compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCalendarOpen(true)}><Calendar className="h-4 w-4 mr-1" />Compliance Calendar</Button>
          <Button size="sm" onClick={() => { fetchTcs(); fetchTds(); }}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><ArrowDownToLine className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">TCS Collected</p><p className="font-bold text-lg">₹{tcsTotal.toLocaleString()}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">TCS Deposited</p><p className="font-bold text-lg">₹{tcsDeposited.toLocaleString()}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><ArrowUpFromLine className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">TDS Deducted</p><p className="font-bold text-lg">₹{tdsTotal.toLocaleString()}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><CheckCircle2 className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">TDS Deposited</p><p className="font-bold text-lg">₹{tdsDeposited.toLocaleString()}</p></div></div></Card></motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList><TabsTrigger value="tcs">TCS Collections</TabsTrigger><TabsTrigger value="tds">TDS Deductions</TabsTrigger></TabsList>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-48" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="collected">Collected</SelectItem><SelectItem value="deducted">Deducted</SelectItem><SelectItem value="deposited">Deposited</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select>
            <Input placeholder="MMYYYY" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="w-28" maxLength={6} />
            {activeTab === 'tds' && (
              <Select value={sectionFilter} onValueChange={setSectionFilter}><SelectTrigger className="w-28"><SelectValue placeholder="Section" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="194C">194C</SelectItem><SelectItem value="194H">194H</SelectItem><SelectItem value="194J">194J</SelectItem></SelectContent></Select>
            )}
          </div>
        </div>

        <TabsContent value="tcs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div><CardTitle className="text-base">TCS Collection Records</CardTitle><CardDescription>Section 206C(1G) - Tax Collected at Source on hotel payments</CardDescription></div>
              <Button size="sm" onClick={() => setTcsDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add TCS</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>PAN</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Booking Amt</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">TCS Amt</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8" /></TableCell></TableRow>) :
                      tcsRecords.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground"><ArrowDownToLine className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No TCS records found</p></TableCell></TableRow> :
                      tcsRecords.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.guestName || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.panNumber || '-'}</TableCell>
                          <TableCell className="text-sm">{new Date(r.collectionDate).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="text-right">₹{r.bookingAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(r.tcsRate * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-semibold">₹{r.tcsAmount.toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{r.period}</Badge></TableCell>
                          <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[r.status] || ''}`}>{r.status}</span></TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tds" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div><CardTitle className="text-base">TDS Deduction Records</CardTitle><CardDescription>Tax Deducted at Source on vendor payments</CardDescription></div>
              <Button size="sm" onClick={() => setTdsDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add TDS</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>PAN</TableHead><TableHead>Section</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Payment</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">TDS</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-8" /></TableCell></TableRow>) :
                      tdsRecords.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground"><ArrowUpFromLine className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No TDS records found</p></TableCell></TableRow> :
                      tdsRecords.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.vendorName || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.panNumber || '-'}</TableCell>
                          <TableCell><Badge variant="outline">{r.section}</Badge></TableCell>
                          <TableCell className="text-sm">{new Date(r.paymentDate).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="text-right">₹{r.paymentAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(r.tdsRate * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-semibold">₹{r.tdsAmount.toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{r.period}</Badge></TableCell>
                          <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[r.status] || ''}`}>{r.status}</span></TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* TCS Create Dialog */}
      <Dialog open={tcsDialogOpen} onOpenChange={setTcsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add TCS Record</DialogTitle><DialogDescription>Record TCS collection from hotel booking payment</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = Object.fromEntries(fd); data.tcsRate = parseFloat(data.tcsRate as string) / 100; data.tcsAmount = parseFloat(data.bookingAmount as string) * data.tcsRate; data.thresholdExceeded = parseFloat(data.bookingAmount as string) > 100000; handleCreateTcs(data); }}>
            <div className="space-y-4">
              <div><Label>Guest Name</Label><Input name="guestName" placeholder="John Doe" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>PAN Number</Label><Input name="panNumber" maxLength={10} placeholder="ABCDE1234F" /></div>
                <div><Label>Collection Date</Label><Input name="collectionDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Booking Amount (₹)</Label><Input name="bookingAmount" type="number" placeholder="50000" /></div>
                <div><Label>TCS Rate (%)</Label><Input name="tcsRate" type="number" step="0.1" defaultValue="1" /></div>
              </div>
              <div><Label>Period (MMYYYY)</Label><Input name="period" defaultValue={currentPeriod} maxLength={6} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTcsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* TDS Create Dialog */}
      <Dialog open={tdsDialogOpen} onOpenChange={setTdsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add TDS Record</DialogTitle><DialogDescription>Record TDS deduction from vendor payment</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = Object.fromEntries(fd); data.tdsRate = parseFloat(data.tdsRate as string) / 100; data.tdsAmount = parseFloat(data.paymentAmount as string) * data.tdsRate; handleCreateTds(data); }}>
            <div className="space-y-4">
              <div><Label>Vendor Name</Label><Input name="vendorName" placeholder="ABC Services" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>PAN Number</Label><Input name="panNumber" maxLength={10} placeholder="ABCDE1234F" /></div>
                <div><Label>Section</Label><Select name="section" defaultValue="194C"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="194C">194C - Contractor</SelectItem><SelectItem value="194H">194H - Commission</SelectItem><SelectItem value="194J">194J - Professional</SelectItem><SelectItem value="194I">194I - Interest</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Payment Date</Label><Input name="paymentDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
                <div><Label>Payment Amount (₹)</Label><Input name="paymentAmount" type="number" placeholder="25000" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>TDS Rate (%)</Label><Input name="tdsRate" type="number" step="0.1" defaultValue="1" /></div>
                <div><Label>Period (MMYYYY)</Label><Input name="period" defaultValue={currentPeriod} maxLength={6} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTdsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Compliance Calendar Dialog */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Compliance Calendar</DialogTitle><DialogDescription>Key due dates and penalty information for tax compliance</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {complianceDates.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/20 rounded"><Clock className="h-4 w-4 text-amber-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.title}</p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1 text-xs">
                    <span className="text-muted-foreground">Due: <span className="text-foreground font-medium">{item.due}</span></span>
                    <span className="text-red-500">Penalty: <span className="font-medium">{item.penalty}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
