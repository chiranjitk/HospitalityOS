'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Download, Plus, RefreshCw, IndianRupee, FileText, CheckCircle2,
  AlertCircle, Clock, Calendar, ArrowRight, Eye, FileJson
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

interface GstReturn {
  id: string; returnType: string; period: string; fromMonth: number; fromYear: number;
  status: string; totalOutwardSupply: number; totalTaxableValue: number; totalCgst: number;
  totalSgst: number; totalIgst: number; totalCess: number; totalTaxLiability: number;
  totalItcClaimed: number; netTaxPayable: number; filedDate: string | null; arn: string | null;
  property?: { id: string; name: string };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const statusColor: Record<string, string> = { draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', prepared: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', filed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', amended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };

export default function GstReturnsPage() {
  const [returns, setReturns] = useState<GstReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gstr1');
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewPeriod, setPreviewPeriod] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [newReturn, setNewReturn] = useState({ returnType: 'gstr1', period: '', fromMonth: 1, fromYear: 2026 });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/returns?returnType=${activeTab}`);
      const json = await res.json();
      if (json.success) setReturns(json.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    fetchReturns().then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchReturns]);

  const handleCreateReturn = async () => {
    if (!newReturn.period || newReturn.period.length !== 6) { toast({ title: 'Error', description: 'Enter valid period (MMYYYY)', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/tax/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newReturn, fromMonth: parseInt(newReturn.period.slice(0, 2)), fromYear: parseInt(newReturn.period.slice(2)) }) });
      const json = await res.json();
      if (json.success) { toast({ title: 'Return created' }); setCreateOpen(false); fetchReturns(); }
      else { toast({ title: 'Error', description: json.error?.message, variant: 'destructive' }); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setSaving(false);
  };

  const handlePreview = async (returnType: string, period: string) => {
    setPreviewLoading(true);
    setPreviewPeriod(period);
    try {
      const endpoint = returnType === 'gstr1' ? '/api/tax/returns/gstr1' : '/api/tax/returns/gstr3b';
      const res = await fetch(`${endpoint}?period=${period}`);
      const json = await res.json();
      if (json.success) { setPreviewData(json.data); setPreviewOpen(true); }
      else { toast({ title: 'Error', description: json.error?.message || 'Failed to preview', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    setPreviewLoading(false);
  };

  const handleDownloadJson = () => {
    if (!previewData) return;
    const blob = new Blob([JSON.stringify(previewData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeTab.toUpperCase()}_${previewPeriod}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'JSON downloaded' });
  };

  const totalTaxLiability = returns.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.totalTaxLiability, 0);
  const totalFiled = returns.filter(r => r.status === 'filed').length;
  const totalDraft = returns.filter(r => r.status === 'draft' || r.status === 'prepared').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-7 w-7" /> GST Returns</h1>
          <p className="text-muted-foreground mt-1">Prepare GSTR-1 and GSTR-3B returns for filing</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setNewReturn({ ...newReturn, returnType: activeTab }); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" />Create Return</Button>
          <Button variant="outline" size="sm" onClick={fetchReturns}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Returns</p><p className="font-bold text-lg">{returns.length}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Filed</p><p className="font-bold text-lg">{totalFiled}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-sm text-muted-foreground">Draft/Pending</p><p className="font-bold text-lg">{totalDraft}</p></div></div></Card></motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}><Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><IndianRupee className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Tax Liability</p><p className="font-bold text-lg">₹{totalTaxLiability.toLocaleString()}</p></div></div></Card></motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList><TabsTrigger value="gstr1">GSTR-1</TabsTrigger><TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger></TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Month</TableHead><TableHead>Taxable Value</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Cess</TableHead><TableHead className="text-right">Net Payable</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-8" /></TableCell></TableRow>) :
                      returns.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No {activeTab.toUpperCase()} returns found</p></TableCell></TableRow> :
                      returns.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.period}</TableCell>
                          <TableCell>{MONTHS[r.fromMonth - 1]} {r.fromYear}</TableCell>
                          <TableCell>₹{r.totalTaxableValue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{r.totalCgst.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{r.totalSgst.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{r.totalIgst.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{r.totalCess.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">₹{r.netTaxPayable.toLocaleString()}</TableCell>
                          <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[r.status] || statusColor.draft}`}>{r.status}</span></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handlePreview(r.returnType, r.period)} disabled={previewLoading}><Eye className="h-3 w-3" /></Button>
                              {r.status === 'draft' && <Button variant="ghost" size="sm"><ArrowRight className="h-3 w-3" /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Return Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create {newReturn.returnType.toUpperCase()} Return</DialogTitle><DialogDescription>Create a draft GST return for the selected period</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Period (MMYYYY)</Label><Input placeholder="052026" value={newReturn.period} onChange={e => setNewReturn({ ...newReturn, period: e.target.value })} maxLength={6} className="mt-1" /></div>
            <p className="text-xs text-muted-foreground">A draft return will be created. You can preview and prepare it before filing.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateReturn} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> {activeTab.toUpperCase()} Preview - {previewPeriod}</DialogTitle><DialogDescription>Auto-calculated from e-invoices</DialogDescription></div>
              <Button variant="outline" size="sm" onClick={handleDownloadJson}><FileJson className="h-4 w-4 mr-1" />Download JSON</Button>
            </div>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              {activeTab === 'gstr1' ? (
                <div className="space-y-4">
                  <Card className="p-4"><h4 className="font-semibold mb-3 text-sm">Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Total Invoices</span><p className="font-bold">{(previewData as Record<string, unknown>).totalInvoices || 0}</p></div>
                      <div><span className="text-muted-foreground">Taxable Value</span><p className="font-bold">₹{Number(((previewData as Record<string, unknown>).totalTaxableValue as number) || 0).toLocaleString()}</p></div>
                      <div><span className="text-muted-foreground">Total Tax</span><p className="font-bold">₹{Number(((previewData as Record<string, unknown>).totalTax as number) || 0).toLocaleString()}</p></div>
                    </div>
                  </Card>
                  <Card className="p-4"><h4 className="font-semibold mb-3 text-sm">Tax Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>CGST</span><span className="font-mono">₹{Number(((previewData as Record<string, unknown>).totalCgst as number) || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>SGST</span><span className="font-mono">₹{Number(((previewData as Record<string, unknown>).totalSgst as number) || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>IGST</span><span className="font-mono">₹{Number(((previewData as Record<string, unknown>).totalIgst as number) || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Cess</span><span className="font-mono">₹{Number(((previewData as Record<string, unknown>).totalCess as number) || 0).toLocaleString()}</span></div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  {(previewData as Record<string, Record<string, unknown>>)?.outwardSupplies && (
                    <Card className="p-4"><h4 className="font-semibold mb-3 text-sm">3.1 - Outward Supplies (Taxable)</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Taxable Value</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).outwardSupplies!.totalTaxableValue as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>CGST</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).outwardSupplies!.totalCgst as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>SGST</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).outwardSupplies!.totalSgst as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>IGST</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).outwardSupplies!.totalIgst as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Total Tax</span><span className="font-mono font-semibold">₹{Number(((previewData as Record<string, Record<string, unknown>>).outwardSupplies!.totalTax as number) || 0).toLocaleString()}</span></div>
                      </div>
                    </Card>
                  )}
                  {(previewData as Record<string, Record<string, unknown>>)?.summary && (
                    <Card className="p-4"><h4 className="font-semibold mb-3 text-sm">Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total Outward Supply</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).summary!.totalOutwardSupply as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Total Tax Liability</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).summary!.totalTaxLiability as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>ITC Claimed</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).summary!.totalItcClaimed as number) || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Net Tax Payable</span><span className="font-mono">₹{Number(((previewData as Record<string, Record<string, unknown>>).summary!.netTaxPayable as number) || 0).toLocaleString()}</span></div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
