'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Save, Plus, Edit2, Trash2, RefreshCw, AlertCircle,
  FileText, CheckCircle2, XCircle, Settings2, Hash, MapPin, CreditCard
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface GstSettings {
  id: string; gstin: string | null; legalName: string | null; tradeName: string | null;
  stateCode: string | null; stateName: string | null; address: string | null; city: string | null;
  pincode: string | null; registrationType: string | null; scheme: string | null;
  gstEntityType: string | null; fssaiLicenseNo: string | null; tcsRate: number; tcsThreshold: number;
  tds194cRate: number; tds194hRate: number; tds194jRate: number; panNumber: string | null;
  aadhaarNumber: string | null; isActive: boolean; property?: { id: string; name: string };
}

interface SacCode {
  id: string; serviceType: string; sacCode: string; description: string | null;
  cgstRate: number; sgstRate: number; igstRate: number; cessRate: number; isActive: boolean;
}

const SERVICE_TYPES = [
  { value: 'room_rent', label: 'Room Rent', sac: '9963' },
  { value: 'restaurant', label: 'Restaurant', sac: '9963' },
  { value: 'fnb', label: 'Food & Beverage', sac: '9963' },
  { value: 'laundry', label: 'Laundry', sac: '9985' },
  { value: 'minibar', label: 'Minibar', sac: '9963' },
  { value: 'spa', label: 'Spa & Wellness', sac: '9996' },
  { value: 'events', label: 'Events & Banquets', sac: '9971' },
  { value: 'parking', label: 'Parking', sac: '9972' },
  { value: 'other', label: 'Other Services', sac: '9998' },
];

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' }, { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' }, { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' }, { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' }, { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' }, { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' }, { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' }, { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' }, { code: '25', name: 'Dadra & Nagar Haveli' }, { code: '26', name: 'Daman & Diu' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh' }, { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' }, { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' }, { code: '35', name: 'Andaman & Nicobar' },
  { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh (New)' },
];

export default function TaxSettingsPage() {
  const [settings, setSettings] = useState<GstSettings[]>([]);
  const [sacCodes, setSacCodes] = useState<SacCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSettings, setEditingSettings] = useState<GstSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sacOpen, setSacOpen] = useState(false);
  const [editingSac, setEditingSac] = useState<SacCode | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/tax/settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch { /* silent */ }
  }, []);

  const fetchSacCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/tax/sac-codes');
      const json = await res.json();
      if (json.success) setSacCodes(json.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSettings(), fetchSacCodes()]).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchSettings, fetchSacCodes]);

  const handleSaveSettings = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const url = editingSettings?.id ? `/api/tax/settings/${editingSettings.id}` : '/api/tax/settings';
      const method = editingSettings?.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) {
        toast({ title: editingSettings?.id ? 'Settings updated' : 'Settings created', description: 'GST tax settings saved successfully' });
        setSettingsOpen(false);
        setEditingSettings(null);
        fetchSettings();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSaveSac = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const url = editingSac?.id ? `/api/tax/sac-codes/${editingSac.id}` : '/api/tax/sac-codes';
      const method = editingSac?.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'SAC code saved', description: 'Service accounting code saved' });
        setSacOpen(false);
        setEditingSac(null);
        fetchSacCodes();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteSac = async (id: string) => {
    if (!confirm('Delete this SAC code?')) return;
    try {
      const res = await fetch(`/api/tax/sac-codes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) fetchSacCodes();
    } catch { /* silent */ }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings2 className="h-7 w-7" /> India GST Tax Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure GST compliance, tax rates, and SAC code mappings</p>
        </div>
        <Button onClick={() => { setEditingSettings(settings[0] || null); setSettingsOpen(true); }}>
          <Edit2 className="h-4 w-4 mr-2" /> {settings.length > 0 ? 'Edit Settings' : 'Configure GST'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><FileText className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">GSTIN</p><p className="font-semibold">{settings[0]?.gstin ? <Badge variant="default" className="bg-emerald-600">Registered</Badge> : <Badge variant="secondary">Not Set</Badge>}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Hash className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">SAC Codes</p><p className="font-semibold text-lg">{sacCodes.length}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><MapPin className="h-5 w-5 text-amber-600" /></div><div><p className="text-sm text-muted-foreground">State</p><p className="font-semibold">{settings[0]?.stateName || 'N/A'}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><CreditCard className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Scheme</p><p className="font-semibold capitalize">{settings[0]?.scheme || 'Regular'}</p></div></div></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sac">SAC Codes</TabsTrigger>
          <TabsTrigger value="tcs">TCS/TDS</TabsTrigger>
          <TabsTrigger value="rc">Reverse Charge</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>GST Registration Details</CardTitle><CardDescription>Your GST registration and business information</CardDescription></CardHeader>
            <CardContent>
              {settings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No GST settings configured</p><Button variant="outline" className="mt-2" onClick={() => { setEditingSettings(null); setSettingsOpen(true); }}><Plus className="h-4 w-4 mr-2" />Configure GST</Button></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {settings.map(s => (
                    <div key={s.id} className="space-y-3 p-4 border rounded-lg">
                      <div className="flex justify-between"><span className="text-muted-foreground">GSTIN</span><span className="font-mono font-semibold">{s.gstin || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Legal Name</span><span>{s.legalName || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Trade Name</span><span>{s.tradeName || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">State</span><span>{s.stateCode} - {s.stateName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Entity Type</span><span className="capitalize">{s.gstEntityType}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Scheme</span><Badge variant={s.scheme === 'composition' ? 'secondary' : 'default'}>{s.scheme}</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">FSSAI License</span><span>{s.fssaiLicenseNo || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{s.isActive ? <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge> : <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sac" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div><CardTitle>SAC Code Mapping</CardTitle><CardDescription>Service Accounting Codes for hospitality services</CardDescription></div>
              <Button size="sm" onClick={() => { setEditingSac(null); setSacOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add SAC</Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Service Type</TableHead><TableHead>SAC Code</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead><TableHead>Cess</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sacCodes.map(sc => (
                      <TableRow key={sc.id}>
                        <TableCell className="font-medium">{SERVICE_TYPES.find(s => s.value === sc.serviceType)?.label || sc.serviceType}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{sc.sacCode}</Badge></TableCell>
                        <TableCell>{(sc.cgstRate * 100).toFixed(0)}%</TableCell>
                        <TableCell>{(sc.sgstRate * 100).toFixed(0)}%</TableCell>
                        <TableCell>{(sc.igstRate * 100).toFixed(0)}%</TableCell>
                        <TableCell>{(sc.cessRate * 100).toFixed(0)}%</TableCell>
                        <TableCell>{sc.isActive ? <Badge className="bg-emerald-600">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingSac(sc); setSacOpen(true); }}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSac(sc.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sacCodes.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No SAC codes configured</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tcs" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>TCS & TDS Settings</CardTitle><CardDescription>Section 206C(1G) TCS and section 194C/194H/194J TDS rates</CardDescription></CardHeader>
            <CardContent>
              {settings.length > 0 ? settings.map(s => (
                <div key={s.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 p-4 border rounded-lg">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" /> TCS (Hotel Room Rent)</h4>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Section</span><span>206C(1G)</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">TCS Rate</span><span className="font-semibold">{(s.tcsRate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Threshold</span><span className="font-semibold">₹{s.tcsThreshold.toLocaleString()}</span></div>
                  </div>
                  <div className="space-y-3 p-4 border rounded-lg">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-500" /> TDS Rates</h4>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">194C (Contractor)</span><span className="font-semibold">{(s.tds194cRate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">194H (Commission)</span><span className="font-semibold">{(s.tds194hRate * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">194J (Professional)</span><span className="font-semibold">{(s.tds194jRate * 100).toFixed(1)}%</span></div>
                  </div>
                </div>
              )) : <p className="text-muted-foreground text-center py-4">Configure GST settings first</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rc" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Reverse Charge Mechanism</CardTitle><CardDescription>Configure reverse charge applicability for services</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-3 p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Reverse Charge is applicable when registered hotel receives services from unregistered vendors or specified categories. The recipient (hotel) becomes liable to pay GST instead of the supplier.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"><span className="text-sm">GTA Services</span><Badge variant="outline">Applicable</Badge></div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"><span className="text-sm">Legal Services</span><Badge variant="outline">Applicable</Badge></div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/10 rounded-lg"><span className="text-sm">IT Services</span><Badge variant="outline">Conditional</Badge></div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/10 rounded-lg"><span className="text-sm">Security Services</span><Badge variant="outline">Conditional</Badge></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSettings?.id ? 'Edit GST Settings' : 'Configure GST Settings'}</DialogTitle><DialogDescription>Enter your GST registration details and tax configuration</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleSaveSettings(Object.fromEntries(fd)); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>GSTIN (15 digits)</Label><Input name="gstin" defaultValue={editingSettings?.gstin || ''} maxLength={15} placeholder="29AAACR1234F1ZH" /></div>
              <div><Label>Legal Name</Label><Input name="legalName" defaultValue={editingSettings?.legalName || ''} placeholder="Royal Stay Hotels Pvt Ltd" /></div>
              <div><Label>Trade Name</Label><Input name="tradeName" defaultValue={editingSettings?.tradeName || ''} placeholder="Royal Stay Hotels" /></div>
              <div><Label>State</Label><Select name="stateCode" defaultValue={editingSettings?.stateCode || ''}><SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger><SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>State Name</Label><Input name="stateName" defaultValue={editingSettings?.stateName || ''} placeholder="Karnataka" /></div>
              <div><Label>PIN Code</Label><Input name="pincode" defaultValue={editingSettings?.pincode || ''} maxLength={6} placeholder="560001" /></div>
              <div className="md:col-span-2"><Label>Address</Label><Input name="address" defaultValue={editingSettings?.address || ''} placeholder="123 MG Road, Indiranagar" /></div>
              <div><Label>City</Label><Input name="city" defaultValue={editingSettings?.city || ''} placeholder="Bangalore" /></div>
              <div><Label>Registration Type</Label><Select name="registrationType" defaultValue={editingSettings?.registrationType || 'regular'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="composition">Composition</SelectItem><SelectItem value="casual">Casual</SelectItem><SelectItem value="non-resident">Non-Resident</SelectItem></SelectContent></Select></div>
              <div><Label>Scheme</Label><Select name="scheme" defaultValue={editingSettings?.scheme || 'regular'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="composition">Composition</SelectItem></SelectContent></Select></div>
              <div><Label>Entity Type</Label><Select name="gstEntityType" defaultValue={editingSettings?.gstEntityType || 'proprietary'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="proprietary">Proprietary</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="llp">LLP</SelectItem><SelectItem value="pvt_ltd">Pvt Ltd</SelectItem><SelectItem value="ltd">Ltd</SelectItem><SelectItem value="trust">Trust</SelectItem><SelectItem value="society">Society</SelectItem></SelectContent></Select></div>
              <div><Label>FSSAI License No</Label><Input name="fssaiLicenseNo" defaultValue={editingSettings?.fssaiLicenseNo || ''} placeholder="12345678901234" /></div>
              <div><Label>PAN Number</Label><Input name="panNumber" defaultValue={editingSettings?.panNumber || ''} maxLength={10} placeholder="AAACR1234F" /></div>
              <div className="md:col-span-2 border-t pt-4 mt-2"><h4 className="font-semibold mb-2 text-sm">TCS/TDS Rates</h4></div>
              <div><Label>TCS Rate (%)</Label><Input name="tcsRate" type="number" step="0.01" defaultValue={editingSettings?.tcsRate || 0.01} /></div>
              <div><Label>TCS Threshold (₹)</Label><Input name="tcsThreshold" type="number" defaultValue={editingSettings?.tcsThreshold || 100000} /></div>
              <div><Label>TDS 194C Rate (%)</Label><Input name="tds194cRate" type="number" step="0.01" defaultValue={editingSettings?.tds194cRate || 0.01} /></div>
              <div><Label>TDS 194H Rate (%)</Label><Input name="tds194hRate" type="number" step="0.01" defaultValue={editingSettings?.tds194hRate || 0.05} /></div>
              <div><Label>TDS 194J Rate (%)</Label><Input name="tds194jRate" type="number" step="0.01" defaultValue={editingSettings?.tds194jRate || 0.10} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Settings'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SAC Code Dialog */}
      <Dialog open={sacOpen} onOpenChange={setSacOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSac?.id ? 'Edit SAC Code' : 'Add SAC Code'}</DialogTitle><DialogDescription>Configure service accounting code and tax rates</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleSaveSac(Object.fromEntries(fd)); }}>
            <div className="space-y-4">
              <div><Label>Service Type</Label><Select name="serviceType" defaultValue={editingSac?.serviceType || ''} disabled={!!editingSac?.id}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>SAC Code</Label><Input name="sacCode" defaultValue={editingSac?.sacCode || SERVICE_TYPES.find(s => s.value === editingSac?.serviceType)?.sac || ''} /></div>
              <div><Label>Description</Label><Input name="description" defaultValue={editingSac?.description || ''} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>CGST Rate (%)</Label><Input name="cgstRate" type="number" step="0.01" defaultValue={editingSac ? editingSac.cgstRate * 100 : 9} /></div>
                <div><Label>SGST Rate (%)</Label><Input name="sgstRate" type="number" step="0.01" defaultValue={editingSac ? editingSac.sgstRate * 100 : 9} /></div>
                <div><Label>IGST Rate (%)</Label><Input name="igstRate" type="number" step="0.01" defaultValue={editingSac ? editingSac.igstRate * 100 : 18} /></div>
                <div><Label>Cess Rate (%)</Label><Input name="cessRate" type="number" step="0.01" defaultValue={editingSac ? editingSac.cessRate * 100 : 0} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setSacOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
