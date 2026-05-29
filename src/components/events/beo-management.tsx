'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Printer,
  Download,
  Eye,
  Plus,
  Search,
  Calendar,
  Clock,
  Users,
  DollarSign,
  UtensilsCrossed,
  Monitor,
  Mic,
  Lightbulb,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Building2,
  Mail,
  Phone,
  Wine,
  RectangleHorizontal,
  ClipboardList,
  Copy,
  Wallet,
  CreditCard,
  Receipt,
  Package,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type BEOStatus = 'draft' | 'under_review' | 'approved' | 'confirmed' | 'completed';

interface TimelineItem {
  time: string;
  activity: string;
  responsible: string;
  notes?: string;
}

interface MenuItem {
  name: string;
  description: string;
  dietaryTag: string;
  perPersonCost: number;
}

interface EquipmentItem {
  name: string;
  quantity: number;
  costPerUnit: number;
}

interface BEO {
  id: string;
  beoNumber: string;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  clientName: string;
  contactEmail: string;
  contactPhone: string;
  functionType: 'wedding' | 'corporate' | 'social';
  expectedGuests: number;
  setupStyle: string;
  serviceStyle: 'plated' | 'buffet' | 'stations';
  dietaryRequirements: string[];
  menuItems: MenuItem[];
  barRequirements: string;
  equipment: EquipmentItem[];
  stageSetup: string;
  lightingSetup: string;
  floorPlanDescription: string;
  timeline: TimelineItem[];
  fnbMinimum: number;
  serviceChargePercent: number;
  taxPercent: number;
  status: BEOStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const STATUS_CONFIG: Record<BEOStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: CheckCircle2 },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: CheckCircle2 },
};

const STATUS_FLOW: BEOStatus[] = ['draft', 'under_review', 'approved', 'confirmed', 'completed'];

const FUNCTION_TYPES = [
  { value: 'wedding', label: 'Wedding', icon: '💒' },
  { value: 'corporate', label: 'Corporate', icon: '🏢' },
  { value: 'social', label: 'Social', icon: '🎉' },
];

const SETUP_STYLES = ['Banquet Rounds', 'Theater', 'Classroom', 'U-Shape', 'Cocktail', 'Boardroom', 'Custom'];

const SERVICE_STYLES = [
  { value: 'plated', label: 'Plated Service' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'stations', label: 'Food Stations' },
];

// ─── DB Record type (from API) ─────────────────────────────────────────
interface BEOItemRecord {
  id: string;
  orderId: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  sortOrder: number;
}

interface BEORecord {
  id: string;
  tenantId: string;
  propertyId: string;
  eventId: string | null;
  orderNumber: string;
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  eventType: string;
  setupStyle: string;
  expectedPax: number;
  functionDate: string;
  startTime: string;
  endTime?: string | null;
  venueId?: string | null;
  menuNotes?: string | null;
  beverageNotes?: string | null;
  avRequirements: string;
  specialInstructions?: string | null;
  status: string;
  totalAmount: number;
  depositAmount: number;
  depositPaid: number;
  finalAmountPaid: number;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BEOItemRecord[];
}

// ─── Map DB status → component status ──────────────────────────────────
function mapDbStatus(dbStatus: string): BEOStatus {
  const map: Record<string, BEOStatus> = {
    draft: 'draft',
    confirmed: 'confirmed',
    in_progress: 'approved',
    completed: 'completed',
    cancelled: 'draft',
  };
  return map[dbStatus] || 'draft';
}

function mapComponentToDbStatus(compStatus: BEOStatus): string {
  const map: Record<BEOStatus, string> = {
    draft: 'draft',
    under_review: 'confirmed',
    approved: 'in_progress',
    confirmed: 'confirmed',
    completed: 'completed',
  };
  return map[compStatus] || compStatus;
}

// ─── Map DB event type → component function type ───────────────────────
function mapDbType(dbType: string): 'wedding' | 'corporate' | 'social' {
  const map: Record<string, 'wedding' | 'corporate' | 'social'> = {
    wedding: 'wedding', conference: 'corporate', banquet: 'social', meeting: 'corporate',
  };
  return map[dbType] || 'social';
}

// ─── Adapter: DB record → component BEO ─────────────────────────────────
function mapDbToBEO(rec: BEORecord): BEO {
  const items = rec.items || [];
  const foodItems = items.filter(i => i.category === 'food' || i.category === 'beverage');
  const avItems = items.filter(i => i.category === 'av' || i.category === 'rental');
  let avReq: Record<string, unknown> = {};
  try { avReq = JSON.parse(rec.avRequirements || '{}'); } catch {}

  return {
    id: rec.id,
    beoNumber: rec.orderNumber,
    eventName: rec.clientName,
    eventDate: rec.functionDate ? rec.functionDate.substring(0, 10) : '',
    startTime: rec.startTime ? new Date(rec.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    endTime: rec.endTime ? new Date(rec.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    venue: (avReq.venue as string) || rec.setupStyle || 'TBD',
    clientName: rec.clientName,
    contactEmail: rec.clientEmail || rec.clientContact || '',
    contactPhone: rec.clientPhone || '',
    functionType: mapDbType(rec.eventType),
    expectedGuests: rec.expectedPax,
    setupStyle: rec.setupStyle ? rec.setupStyle.charAt(0).toUpperCase() + rec.setupStyle.slice(1).replace('_', '-') : 'Theater',
    serviceStyle: 'plated',
    dietaryRequirements: rec.menuNotes ? [rec.menuNotes] : [],
    menuItems: foodItems.length > 0 ? foodItems.map(item => ({
      name: item.description,
      description: item.notes || '',
      dietaryTag: '',
      perPersonCost: item.unitPrice,
    })) : [{ name: 'Event Package', description: rec.menuNotes || '', dietaryTag: '', perPersonCost: rec.expectedPax > 0 ? rec.totalAmount / rec.expectedPax : 0 }],
    barRequirements: rec.beverageNotes || '',
    equipment: avItems.length > 0 ? avItems.map(item => ({
      name: item.description,
      quantity: item.quantity,
      costPerUnit: item.unitPrice,
    })) : [],
    stageSetup: (avReq.stageSetup as string) || '',
    lightingSetup: (avReq.lightingSetup as string) || '',
    floorPlanDescription: rec.specialInstructions || '',
    timeline: [],
    fnbMinimum: rec.totalAmount * 0.6,
    serviceChargePercent: 22,
    taxPercent: 8.5,
    status: mapDbStatus(rec.status),
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    approvedBy: rec.approvedBy || undefined,
    approvedAt: rec.approvedAt || undefined,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BEOManagement() {
  const [beos, setBeos] = useState<BEO[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedBEO, setSelectedBEO] = useState<BEO | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creatingBEO, setCreatingBEO] = useState(false);
  const [createForm, setCreateForm] = useState({
    clientName: '', eventType: 'wedding', functionDate: '', expectedPax: 100, setupStyle: 'Banquet Rounds',
  });
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ─── Financial state for folio / deposit / settlement ─────────────
  const [folioSummary, setFolioSummary] = useState<Record<string, unknown> | null>(null);
  const [folioLoading, setFolioLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('bank_transfer');
  const [depositLoading, setDepositLoading] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState('bank_transfer');
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [folioPostingLoading, setFolioPostingLoading] = useState(false);

  // ─── Menu packages state ──────────────────────────────────────────
  const [menuPackages, setMenuPackages] = useState<Array<Record<string, unknown>>>([]);
  const [menuPkgLoading, setMenuPkgLoading] = useState(false);

  // ─── Financial actions ───────────────────────────────────────────
  const handlePostToFolio = async (beoId: string) => {
    setFolioPostingLoading(true);
    try {
      const res = await fetch(`/api/events/beo/${beoId}/folio`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Posted ${json.data.lineItemsPosted} charges to folio ${json.data.folioNumber}`);
        fetchFolioSummary(beoId);
      } else {
        toast.error(json.error || 'Failed to post to folio');
      }
    } catch { toast.error('Network error posting to folio'); }
    finally { setFolioPostingLoading(false); }
  };

  const fetchFolioSummary = async (beoId: string) => {
    setFolioLoading(true);
    try {
      const res = await fetch(`/api/events/beo/${beoId}/folio`);
      const json = await res.json();
      if (json.success) setFolioSummary(json.data);
      else setFolioSummary(null);
    } catch { setFolioSummary(null); }
    finally { setFolioLoading(false); }
  };

  const handleDepositPayment = async (beoId: string) => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid deposit amount'); return; }
    setDepositLoading(true);
    try {
      const res = await fetch(`/api/events/beo/${beoId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethod: depositMethod }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Deposit of ${formatCurrency(json.data.amount)} recorded`);
        setDepositAmount('');
        fetchFolioSummary(beoId);
        fetchBeos();
      } else { toast.error(json.error || 'Failed to process deposit'); }
    } catch { toast.error('Network error processing deposit'); }
    finally { setDepositLoading(false); }
  };

  const handleFinalSettlement = async (beoId: string) => {
    setSettlementLoading(true);
    try {
      const res = await fetch(`/api/events/beo/${beoId}/settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: settlementMethod }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Settlement complete. Folio ${json.data.folioNumber} closed.`);
        fetchFolioSummary(beoId);
        fetchBeos();
      } else { toast.error(json.error || 'Failed to process settlement'); }
    } catch { toast.error('Network error processing settlement'); }
    finally { setSettlementLoading(false); }
  };

  const fetchMenuPackages = async () => {
    setMenuPkgLoading(true);
    try {
      const res = await fetch('/api/events/menu-packages');
      const json = await res.json();
      if (json.success) setMenuPackages(json.data || []);
      else setMenuPackages([]);
    } catch { setMenuPackages([]); }
    finally { setMenuPkgLoading(false); }
  };

  const handleApplyPackage = async (pkgId: string, beoId: string) => {
    try {
      const res = await fetch(`/api/events/menu-packages/${pkgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beoId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Applied ${json.data.packageName} to BEO (${json.data.itemsCreated} items)`);
        fetchBeos();
      } else { toast.error(json.error || 'Failed to apply package'); }
    } catch { toast.error('Network error applying package'); }
  };

  // ─── Fetch BEOs from API ─────────────────────────────────────────────
  const fetchBeos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/events/beo?limit=100');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBeos(json.data.map(mapDbToBEO));
      } else {
        setBeos([]);
      }
    } catch (err) {
      console.error('Failed to fetch BEOs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load BEO data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeos();
  }, []);

  // ─── Calculations ──────────────────────────────────────────────────────
  const calculateTotals = (beo: BEO) => {
    const menuTotal = beo.menuItems.reduce((sum, item) => sum + item.perPersonCost * beo.expectedGuests, 0);
    const equipmentTotal = beo.equipment.reduce((sum, eq) => sum + eq.quantity * eq.costPerUnit, 0);
    const subtotal = Math.max(menuTotal, beo.fnbMinimum) + equipmentTotal;
    const serviceCharge = subtotal * (beo.serviceChargePercent / 100);
    const tax = (subtotal + serviceCharge) * (beo.taxPercent / 100);
    const grandTotal = subtotal + serviceCharge + tax;
    return { menuTotal, equipmentTotal, subtotal, serviceCharge, tax, grandTotal, fnbActual: menuTotal };
  };

  // ─── Filters ───────────────────────────────────────────────────────────
  const filteredBeos = beos.filter(beo => {
    const matchSearch = beo.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      beo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      beo.beoNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || beo.status === statusFilter;
    const matchType = typeFilter === 'all' || beo.functionType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // ─── Status Stats ──────────────────────────────────────────────────────
  const statusCounts = STATUS_FLOW.reduce((acc, status) => {
    acc[status] = beos.filter(b => b.status === status).length;
    return acc;
  }, {} as Record<string, number>);

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleStatusAdvance = async (beo: BEO) => {
    const currentIdx = STATUS_FLOW.indexOf(beo.status);
    if (currentIdx < STATUS_FLOW.length - 1) {
      const newStatus = STATUS_FLOW[currentIdx + 1];
      try {
        const res = await fetch(`/api/events/beo/${beo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: mapComponentToDbStatus(newStatus) }),
        });
        const json = await res.json();
        if (json.success) {
          setBeos(prev => prev.map(b => {
            if (b.id === beo.id) {
              return { ...b, status: newStatus, updatedAt: new Date().toISOString() };
            }
            return b;
          }));
          toast.success(`BEO ${beo.beoNumber} status advanced to ${newStatus.replace('_', ' ')}`);
        } else {
          toast.error(json.error || 'Failed to update BEO status');
        }
      } catch (err) {
        toast.error('Network error updating BEO status');
      }
    }
    setIsStatusDialogOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.info('PDF export initiated. Document will download shortly.');
  };

  const handleCreateBEO = async () => {
    if (!createForm.clientName || !createForm.functionDate) {
      toast.error('Client name and event date are required');
      return;
    }
    setCreatingBEO(true);
    try {
      const res = await fetch('/api/events/beo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          totalAmount: 0,
          depositAmount: 0,
          status: 'draft',
          avRequirements: '{}',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('BEO created successfully');
        setIsCreateDialogOpen(false);
        setCreateForm({ clientName: '', eventType: 'wedding', functionDate: '', expectedPax: 100, setupStyle: 'Banquet Rounds' });
        fetchBeos();
      } else {
        toast.error(json.error || 'Failed to create BEO');
      }
    } catch {
      toast.error('Network error creating BEO');
    } finally {
      setCreatingBEO(false);
    }
  };

  // ─── Render: Status Badge ──────────────────────────────────────────────
  const renderStatusBadge = (status: BEOStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge className={cn('text-xs font-medium', config.color)}>
        {config.label}
      </Badge>
    );
  };

  // ─── Render: Status Progress ───────────────────────────────────────────
  const renderStatusProgress = (status: BEOStatus) => {
    const currentIdx = STATUS_FLOW.indexOf(status);
    return (
      <div className="flex items-center gap-1">
        {STATUS_FLOW.map((s, idx) => {
          const isActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={s} className="flex items-center">
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                isCurrent && 'ring-2 ring-primary/30 scale-110',
              )}>
                {isActive ? '✓' : idx + 1}
              </div>
              {idx < STATUS_FLOW.length - 1 && (
                <div className={cn('w-4 h-0.5', isActive && idx < currentIdx ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render: BEO Preview Document ──────────────────────────────────────
  const renderBEOPreview = (beo: BEO) => {
    const totals = calculateTotals(beo);
    return (
      <div ref={previewRef} className="space-y-6 text-sm print:text-xs">
        {/* Document Header */}
        <div className="border-b-2 border-primary pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Banquet Event Order</h1>
              <p className="text-muted-foreground mt-1">StaySuite HospitalityOS</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-lg">{beo.beoNumber}</p>
              {renderStatusBadge(beo.status)}
              {beo.approvedBy && (
                <p className="text-xs text-muted-foreground mt-1">Approved by: {beo.approvedBy}</p>
              )}
            </div>
          </div>
        </div>

        {/* Event Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Event Details</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{beo.eventName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.eventDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.startTime} — {beo.endTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.venue}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Client Information</h3>
            <div className="space-y-1.5">
              <div className="font-medium">{beo.clientName}</div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.contactEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.contactPhone}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Function Details */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Function Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="font-medium capitalize">{FUNCTION_TYPES.find(t => t.value === beo.functionType)?.icon} {beo.functionType}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Expected Guests</div>
              <div className="font-medium">{beo.expectedGuests}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Setup Style</div>
              <div className="font-medium">{beo.setupStyle}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Service Style</div>
              <div className="font-medium capitalize">{beo.serviceStyle}</div>
            </div>
          </div>
          {beo.dietaryRequirements.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">Dietary Requirements</div>
              <div className="flex flex-wrap gap-1.5">
                {beo.dietaryRequirements.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Food & Beverage */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" /> Food & Beverage
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="text-center">Dietary</TableHead>
                <TableHead className="text-right">Per Person</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beo.menuItems.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{item.description}</TableCell>
                  <TableCell className="text-center">
                    {item.dietaryTag ? <Badge variant="outline" className="text-[10px]">{item.dietaryTag}</Badge> : '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.perPersonCost)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.perPersonCost * beo.expectedGuests)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {beo.barRequirements && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <Wine className="h-3.5 w-3.5" /> Bar Requirements
              </div>
              <p className="text-xs text-muted-foreground">{beo.barRequirements}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Equipment & AV */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Equipment & AV
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beo.equipment.map((eq, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{eq.name}</TableCell>
                  <TableCell className="text-center">{eq.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(eq.costPerUnit)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(eq.quantity * eq.costPerUnit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <RectangleHorizontal className="h-3.5 w-3.5" /> Stage Setup
              </div>
              <p className="text-xs text-muted-foreground">{beo.stageSetup}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <Lightbulb className="h-3.5 w-3.5" /> Lighting Setup
              </div>
              <p className="text-xs text-muted-foreground">{beo.lightingSetup}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Floor Plan */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Floor Plan / Room Setup
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm">{beo.floorPlanDescription}</p>
          </div>
        </div>

        <Separator />

        {/* Timeline */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Event Timeline
          </h3>
          <div className="space-y-2">
            {beo.timeline.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="shrink-0 text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                  {item.time}
                </div>
                <div className="border-l-2 border-primary/20 pl-3 pb-2">
                  <div className="font-medium text-sm">{item.activity}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.responsible} {item.notes && `— ${item.notes}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Billing Summary */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Billing Summary
          </h3>
          <div className="rounded-lg border p-4 space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">F&B Actual</span>
              <span>{formatCurrency(totals.fnbActual)}</span>
            </div>
            {totals.fnbActual < beo.fnbMinimum && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">F&B Minimum (applied)</span>
                <span className="font-medium">{formatCurrency(beo.fnbMinimum)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Equipment Rental</span>
              <span>{formatCurrency(totals.equipmentTotal)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Charge ({beo.serviceChargePercent}%)</span>
              <span>{formatCurrency(totals.serviceCharge)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({beo.taxPercent}%)</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="border-t pt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>Generated by StaySuite HospitalityOS &mdash; {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>This document is confidential. Unauthorized distribution is prohibited.</p>
        </div>
      </div>
    );
  };

  // ─── Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              BEO Management
            </h2>
            <p className="text-muted-foreground">Banquet Event Order document generation and tracking</p>
          </div>
          <Button className="print:hidden" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New BEO
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 flex-1" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-6 w-48 mb-4" /><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              BEO Management
            </h2>
            <p className="text-muted-foreground">Banquet Event Order document generation and tracking</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">Error Loading BEO Data</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={fetchBeos}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            BEO Management
          </h2>
          <p className="text-muted-foreground">Banquet Event Order document generation and tracking</p>
        </div>
        <Button className="print:hidden" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New BEO
        </Button>
      </div>

      {/* Status Pipeline Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Status Pipeline</h3>
            <span className="text-xs text-muted-foreground">{beos.length} total BEOs</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {STATUS_FLOW.map(status => {
              const count = statusCounts[status] || 0;
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    'rounded-lg p-3 flex-1 text-center border-2 cursor-pointer transition-all hover:shadow-md',
                    statusFilter === status ? 'ring-2 ring-primary/20 ' : '',
                    count > 0 ? config.color : 'bg-muted/50 text-muted-foreground opacity-60'
                  )} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-[11px] font-medium">{config.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="list">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              BEO List
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-1.5" />
              Document Preview
            </TabsTrigger>
            <TabsTrigger value="folio">
              <Wallet className="h-4 w-4 mr-1.5" />
              Folio
            </TabsTrigger>
            <TabsTrigger value="deposit">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="settlement">
              <Receipt className="h-4 w-4 mr-1.5" />
              Settlement
            </TabsTrigger>
            <TabsTrigger value="packages">
              <Package className="h-4 w-4 mr-1.5" />
              Packages
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 print:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BEOs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_FLOW.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {FUNCTION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* BEO List Tab */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BEO #</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Venue</TableHead>
                      <TableHead className="hidden sm:table-cell">Guests</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBeos.map(beo => (
                      <TableRow key={beo.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedBEO(beo); setActiveTab('preview'); }}>
                        <TableCell className="font-mono text-xs font-medium">{beo.beoNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{beo.eventName}</div>
                          <div className="text-xs text-muted-foreground">{beo.clientName}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <div>{beo.eventDate}</div>
                          <div className="text-muted-foreground">{beo.startTime} – {beo.endTime}</div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{beo.venue}</TableCell>
                        <TableCell className="hidden sm:table-cell font-medium">{beo.expectedGuests}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {FUNCTION_TYPES.find(t => t.value === beo.functionType)?.icon} {beo.functionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(beo.status)}
                          <div className="mt-1">{renderStatusProgress(beo.status)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); setIsPreviewOpen(true); }} title="Preview">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); setIsStatusDialogOpen(true); }} title="Advance Status">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); handlePrint(); }} title="Print">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleExportPDF()} title="Export PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBeos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No BEOs found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          {selectedBEO ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Document Preview</CardTitle>
                  {renderStatusBadge(selectedBEO.status)}
                  <span className="font-mono text-sm text-muted-foreground">{selectedBEO.beoNumber}</span>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(selectedBEO.beoNumber);
                    toast.success('BEO number copied to clipboard');
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy #
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[700px] overflow-y-auto">
                {renderBEOPreview(selectedBEO)}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a BEO to preview</h3>
                <p className="text-sm mt-1">Click on any BEO in the list to view its full document</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Folio Tab */}
        <TabsContent value="folio" className="mt-4">
          {selectedBEO ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Folio Charges</CardTitle>
                  <Badge variant="outline">{folioSummary?.folioNumber || 'Not posted'}</Badge>
                </div>
                {folioSummary?.folioStatus && (
                  <Badge className={folioSummary.folioStatus === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}>
                    {String(folioSummary.folioStatus)}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {!folioSummary?.folioId && (
                    <Button disabled={folioPostingLoading || !['confirmed', 'approved', 'completed'].includes(selectedBEO.status)} onClick={() => handlePostToFolio(selectedBEO.id)}>
                      {folioPostingLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                      Post to Folio
                    </Button>
                  )}
                  {folioSummary?.folioId && (
                    <Button variant="outline" size="sm" onClick={() => { setSelectedBEO(selectedBEO); fetchFolioSummary(selectedBEO.id); }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  )}
                </div>

                {folioLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : folioSummary ? (
                  <div className="space-y-4">
                    {/* Charges by Category */}
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" /> Charges by Category
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(folioSummary.chargesByCategory || {}).map(([cat, amount]) => (
                          <div key={cat} className="rounded-lg bg-muted/50 p-3">
                            <div className="text-xs text-muted-foreground capitalize">{cat}</div>
                            <div className="font-semibold">{formatCurrency(amount as number)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Service Charge + Tax */}
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium text-sm mb-3">Taxes & Service Charge</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(folioSummary.totalCharges as number)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Service Charge (10%)</span>
                          <span>{formatCurrency(folioSummary.serviceCharge as number)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax (18%)</span>
                          <span>{formatCurrency(folioSummary.tax as number)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>Grand Total</span>
                          <span className="text-primary">{formatCurrency(folioSummary.grandTotal as number)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {(folioSummary.payments as Array)?.length > 0 && (
                      <div className="rounded-lg border p-4">
                        <h4 className="font-medium text-sm mb-3">Payment History</h4>
                        <div className="space-y-2">
                          {(folioSummary.payments as Array).map((p: Record<string, unknown>, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                              <div>
                                <div className="font-medium">{p.description || p.method}</div>
                                <div className="text-xs text-muted-foreground">{new Date(p.createdAt as string).toLocaleString()}</div>
                              </div>
                              <Badge variant={p.amount < 0 ? 'default' : 'secondary'}>
                                {formatCurrency(p.amount as number)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outstanding Balance */}
                    <div className={cn(
                      'rounded-lg border p-4',
                      (folioSummary.outstandingBalance as number) > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20'
                    )}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Outstanding Balance</span>
                        <span className={cn(
                          'text-lg font-bold',
                          (folioSummary.outstandingBalance as number) > 0 ? 'text-amber-700' : 'text-emerald-700'
                        )}>
                          {formatCurrency(folioSummary.outstandingBalance as number)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <h3 className="text-lg font-medium">Charges Not Yet Posted</h3>
                    <p className="text-sm mt-1">Post BEO charges to a folio to track payments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wallet className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a BEO</h3>
                <p className="text-sm mt-1">Click a BEO in the list to view its folio</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Deposit Tab */}
        <TabsContent value="deposit" className="mt-4">
          {selectedBEO ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deposit Management</CardTitle>
                <p className="text-sm text-muted-foreground">Track and record deposit payments for BEO {selectedBEO.beoNumber}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Deposit Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-xs text-muted-foreground">Deposit Required</div>
                    <div className="text-2xl font-bold">{folioSummary?.depositRequired ? formatCurrency(folioSummary.depositRequired as number) : '—'}</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-xs text-muted-foreground">Deposit Paid</div>
                    <div className="text-2xl font-bold text-emerald-600">{folioSummary?.depositPaid ? formatCurrency(folioSummary.depositPaid as number) : formatCurrency(0)}</div>
                  </div>
                  <div className={cn(
                    'rounded-lg border p-4 text-center',
                    folioSummary && (folioSummary.outstandingDeposit as number) > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20'
                  )}>
                    <div className="text-xs text-muted-foreground">Outstanding</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      folioSummary && (folioSummary.outstandingDeposit as number) > 0 ? 'text-amber-700' : 'text-emerald-700'
                    )}>
                      {folioSummary?.outstandingDeposit ? formatCurrency(folioSummary.outstandingDeposit as number) : formatCurrency(0)}
                    </div>
                  </div>
                </div>

                {/* Record Deposit */}
                {folioSummary && (folioSummary.outstandingDeposit as number) > 0 && (
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium text-sm mb-3">Record Deposit Payment</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Label htmlFor="deposit-amount" className="mb-1.5">Amount</Label>
                        <Input
                          id="deposit-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="deposit-method" className="mb-1.5">Payment Method</Label>
                        <Select value={depositMethod} onValueChange={setDepositMethod}>
                          <SelectTrigger id="deposit-method" className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button disabled={depositLoading || !depositAmount} onClick={() => handleDepositPayment(selectedBEO.id)}>
                          {depositLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                          Record Deposit
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CreditCard className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a BEO</h3>
                <p className="text-sm mt-1">Click a BEO in the list to manage deposits</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settlement Tab */}
        <TabsContent value="settlement" className="mt-4">
          {selectedBEO ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Final Settlement</CardTitle>
                <p className="text-sm text-muted-foreground">Process final payment and close the event folio</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Settlement Overview */}
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium text-sm mb-3">Settlement Overview</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Charges</span>
                      <span className="font-medium">{folioSummary?.grandTotal ? formatCurrency(folioSummary.grandTotal as number) : '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deposit Paid</span>
                      <span className="text-emerald-600 font-medium">{folioSummary?.depositPaid ? formatCurrency(folioSummary.depositPaid as number) : formatCurrency(0)}</span>
                    </div>
                    {(folioSummary?.payments as Array)?.length > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payments Made</span>
                        <span className="font-medium">{formatCurrency((folioSummary.payments as Array).reduce((s: number, p: Record<string, unknown>) => s + Math.abs(p.amount as number), 0))}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Outstanding Balance</span>
                      <span className={folioSummary?.outstandingBalance !== undefined && (folioSummary.outstandingBalance as number) > 0 ? 'text-destructive' : 'text-emerald-600'}>
                        {folioSummary?.outstandingBalance !== undefined ? formatCurrency(folioSummary.outstandingBalance as number) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settlement Actions */}
                {folioSummary?.outstandingBalance !== undefined && (folioSummary.outstandingBalance as number) > 0 ? (
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                    <h4 className="font-medium text-sm mb-3">Process Final Payment</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      This will charge the remaining balance of <span className="font-bold">{formatCurrency(folioSummary.outstandingBalance as number)}</span> and close the folio.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div>
                        <Label htmlFor="settlement-method" className="mb-1.5">Payment Method</Label>
                        <Select value={settlementMethod} onValueChange={setSettlementMethod}>
                          <SelectTrigger id="settlement-method" className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button disabled={settlementLoading} onClick={() => handleFinalSettlement(selectedBEO.id)}>
                        {settlementLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                        Settle & Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
                    <div className="font-medium text-emerald-700">Fully Settled</div>
                    <p className="text-xs text-muted-foreground mt-1">All charges have been paid and the folio is closed.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a BEO</h3>
                <p className="text-sm mt-1">Click a BEO in the list to manage settlement</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Menu Packages Tab */}
        <TabsContent value="packages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Menu Package Templates</CardTitle>
                <p className="text-sm text-muted-foreground">Reusable F&B packages for quick BEO creation</p>
              </div>
              <Button onClick={fetchMenuPackages} variant="outline" size="sm" disabled={menuPkgLoading}>
                {menuPkgLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookOpen className="h-4 w-4 mr-2" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {menuPkgLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : menuPackages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                  {menuPackages.map((pkg: Record<string, unknown>) => (
                    <Card key={pkg.id as string} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-sm">{pkg.name as string}</h3>
                            <Badge variant="outline" className="text-xs mt-1 capitalize">{pkg.category as string}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{pkg.itemCount} items</span>
                        </div>
                        <div className="text-sm font-semibold mb-2">{formatCurrency(pkg.itemsTotal as number)}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mb-3">{pkg.description as string}</div>
                        {selectedBEO && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleApplyPackage(pkg.id as string, selectedBEO.id)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Apply to BEO
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <h3 className="text-lg font-medium">No Menu Packages</h3>
                  <p className="text-sm mt-1">Create reusable F&B packages for quick BEO setup via the API</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Advance Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance BEO Status</DialogTitle>
            <DialogDescription>
              Move <span className="font-mono font-medium">{selectedBEO?.beoNumber}</span> from{' '}
              <span className="font-medium">{STATUS_CONFIG[selectedBEO?.status || 'draft']?.label}</span> to the next stage.
            </DialogDescription>
          </DialogHeader>
          {selectedBEO && (
            <div className="py-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg border px-3 py-2 flex-1 text-center">
                  <div className="text-xs text-muted-foreground">Current</div>
                  {renderStatusBadge(selectedBEO.status)}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="rounded-lg border px-3 py-2 flex-1 text-center">
                  <div className="text-xs text-muted-foreground">Next</div>
                  {renderStatusBadge(STATUS_FLOW[STATUS_FLOW.indexOf(selectedBEO.status) + 1] || 'completed')}
                </div>
              </div>
              {selectedBEO.status === 'under_review' && (
                <div className="space-y-2">
                  <Label>Approved By</Label>
                  <Input placeholder="Enter approver name" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedBEO && handleStatusAdvance(selectedBEO)}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Advance Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create BEO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New BEO</DialogTitle>
            <DialogDescription>Start a new Banquet Event Order</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Client / Event Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g., Smith Wedding Reception" value={createForm.clientName} onChange={e => setCreateForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={createForm.eventType} onValueChange={v => setCreateForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNCTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Guests</Label>
                <Input type="number" value={createForm.expectedPax} onChange={e => setCreateForm(f => ({ ...f, expectedPax: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={createForm.functionDate} onChange={e => setCreateForm(f => ({ ...f, functionDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Setup Style</Label>
                <Select value={createForm.setupStyle} onValueChange={v => setCreateForm(f => ({ ...f, setupStyle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETUP_STYLES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBEO} disabled={creatingBEO}>
              {creatingBEO && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create BEO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Document Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedBEO?.beoNumber} — {selectedBEO?.eventName}
            </DialogTitle>
            <DialogDescription>Full BEO document preview</DialogDescription>
          </DialogHeader>
          {selectedBEO && renderBEOPreview(selectedBEO)}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
