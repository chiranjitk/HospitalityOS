'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Receipt, Printer, Mail, Download, Loader2, Eye } from 'lucide-react';

interface ReceiptTemplate {
  id: string;
  headerName: string;
  headerAddress: string;
  headerPhone: string;
  logoUrl: string;
  showOrderNumber: boolean;
  showTable: boolean;
  showDateTime: boolean;
  showItems: boolean;
  showTaxBreakdown: boolean;
  showTotal: boolean;
  showPaymentMethod: boolean;
  showStaffName: boolean;
  showQrCode: boolean;
  footerMessage: string;
  gstNumber: string;
  fontSize: string;
}

const defaultTemplate: ReceiptTemplate = {
  id: '', headerName: 'StaySuite Restaurant', headerAddress: '123 Hotel Street', headerPhone: '+1 555-0100',
  logoUrl: '', showOrderNumber: true, showTable: true, showDateTime: true, showItems: true,
  showTaxBreakdown: true, showTotal: true, showPaymentMethod: true, showStaffName: false, showQrCode: false,
  footerMessage: 'Thank you for dining with us!', gstNumber: '', fontSize: 'medium',
};

const sampleOrder = { orderNumber: 'ORD-001', table: '5', date: new Date().toLocaleString(), items: [
  { name: 'Grilled Salmon', qty: 1, price: 24.99 }, { name: 'Caesar Salad', qty: 2, price: 12.99 }, { name: 'Sparkling Water', qty: 3, price: 3.99 },
], subtotal: 62.94, tax: 6.29, total: 69.23, paymentMethod: 'Credit Card' };

export default function ReceiptTemplates() {
  const { propertyId } = usePropertyId();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<ReceiptTemplate>(defaultTemplate);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch('/api/receipt-templates');
      const data = await res.json();
      if (data.success && data.data) setTemplate(data.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/receipt-templates', {
        method: template.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      const data = await res.json();
      if (data.success) { toast.success('Template saved'); if (data.data?.id) setTemplate(prev => ({ ...prev, id: data.data.id })); }
      else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const update = (field: keyof ReceiptTemplate, value: string | boolean) => setTemplate(prev => ({ ...prev, [field]: value }));

  const printReceipt = () => {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`<html><head><style>body{font-family:monospace;padding:20px;max-width:300px;margin:0 auto}h2{text-align:center;margin:4px 0}p{margin:2px 0;font-size:12px}.line{border-top:1px dashed #000;margin:8px 0}.total{font-size:16px;font-weight:bold}</style></head><body>
      <h2>${template.headerName}</h2><p style="text-align:center">${template.headerAddress}</p><p style="text-align:center">${template.headerPhone}</p>
      <div class="line"></div>
      <p>Order: ${sampleOrder.orderNumber}${template.showTable ? ` | Table: ${sampleOrder.table}` : ''}</p>
      ${template.showDateTime ? `<p>${sampleOrder.date}</p>` : ''}
      <div class="line"></div>
      ${sampleOrder.items.map(i => `<p>${i.name} x${i.qty} ....... $${(i.price * i.qty).toFixed(2)}</p>`).join('')}
      <div class="line"></div>
      <p>Subtotal: $${sampleOrder.subtotal.toFixed(2)}</p><p>Tax: $${sampleOrder.tax.toFixed(2)}</p><p class="total">TOTAL: $${sampleOrder.total.toFixed(2)}</p>
      ${template.showPaymentMethod ? `<p>Payment: ${sampleOrder.paymentMethod}</p>` : ''}
      <div class="line"></div>
      <p style="text-align:center">${template.footerMessage}</p>
      ${template.gstNumber ? `<p style="text-align:center;font-size:10px">GST: ${template.gstNumber}</p>` : ''}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const fontSizeClass = template.fontSize === 'large' ? 'text-lg' : template.fontSize === 'small' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Receipt Templates</h1><p className="text-muted-foreground">Customize digital receipt appearance</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4 mr-2" />Preview</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />Print Sample</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Header</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Restaurant Name</Label><Input value={template.headerName} onChange={e => update('headerName', e.target.value)} /></div>
              <div><Label>Address</Label><Input value={template.headerAddress} onChange={e => update('headerAddress', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={template.headerPhone} onChange={e => update('headerPhone', e.target.value)} /></div>
              <div><Label>Logo URL</Label><Input value={template.logoUrl} onChange={e => update('logoUrl', e.target.value)} placeholder="https://..." /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sections</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {([['showOrderNumber', 'Order Number'], ['showTable', 'Table'], ['showDateTime', 'Date & Time'], ['showItems', 'Items'], ['showTaxBreakdown', 'Tax Breakdown'], ['showTotal', 'Total'], ['showPaymentMethod', 'Payment Method'], ['showStaffName', 'Staff Name'], ['showQrCode', 'QR Code (Feedback)']] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between"><Label>{label}</Label><Switch checked={template[key] as boolean} onCheckedChange={v => update(key, v)} /></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Thank You Message</Label><Input value={template.footerMessage} onChange={e => update('footerMessage', e.target.value)} /></div>
              <div><Label>GST Number</Label><Input value={template.gstNumber} onChange={e => update('gstNumber', e.target.value)} /></div>
              <div><Label>Font Size</Label>
                <div className="flex gap-2 mt-1">{['small', 'medium', 'large'].map(s => (
                  <Button key={s} variant={template.fontSize === s ? 'default' : 'outline'} size="sm" onClick={() => update('fontSize', s)} className={template.fontSize === s ? 'bg-emerald-600' : ''}><span className="capitalize">{s}</span></Button>
                ))}</div>
              </div>
            </CardContent>
          </Card>
          <Button onClick={save} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Template</Button>
        </div>

        {/* Live Preview */}
        <Card className="sticky top-6">
          <CardHeader><CardTitle className="text-base">Live Preview</CardTitle></CardHeader>
          <CardContent>
            <div className={`bg-white dark:bg-white text-black p-4 rounded-lg border-2 border-dashed ${fontSizeClass}`} style={{ fontFamily: 'monospace', maxWidth: 280, margin: '0 auto' }}>
              <div className="text-center font-bold">{template.headerName}</div>
              <div className="text-center text-xs">{template.headerAddress}</div>
              <div className="text-center text-xs">{template.headerPhone}</div>
              <div className="border-t border-dashed border-gray-400 my-2" />
              {template.showOrderNumber && <div className="flex justify-between"><span>Order: {sampleOrder.orderNumber}</span>{template.showTable && <span>T{sampleOrder.table}</span>}</div>}
              {template.showDateTime && <div className="text-xs">{sampleOrder.date}</div>}
              <div className="border-t border-dashed border-gray-400 my-2" />
              {template.showItems && sampleOrder.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-xs"><span>{i.name} x{i.qty}</span><span>${(i.price * i.qty).toFixed(2)}</span></div>
              ))}
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="flex justify-between text-xs"><span>Subtotal</span><span>${sampleOrder.subtotal.toFixed(2)}</span></div>
              {template.showTaxBreakdown && <div className="flex justify-between text-xs"><span>Tax</span><span>${sampleOrder.tax.toFixed(2)}</span></div>}
              {template.showTotal && <div className="flex justify-between font-bold"><span>TOTAL</span><span>${sampleOrder.total.toFixed(2)}</span></div>}
              {template.showPaymentMethod && <div className="text-xs mt-1">Paid: {sampleOrder.paymentMethod}</div>}
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="text-center text-xs">{template.footerMessage}</div>
              {template.gstNumber && <div className="text-center text-[10px]">GST: {template.gstNumber}</div>}
              {template.showQrCode && <div className="flex justify-center mt-2"><div className="w-16 h-16 bg-gray-200 flex items-center justify-center text-[8px]">QR Code</div></div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
