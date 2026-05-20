'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  Building2,
  ChevronRight,
  Filter,
  RefreshCw,
  Eye,
  Pencil,
  Download,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  ArrowLeftRight,
  FileCheck,
  FileMinus,
  FilePlus,
  FolderOpen,
  Tag,
  History,
  UserCircle,
  CreditCard,
  Stamp,
  Timer,
  CalendarClock,
  Paperclip,
  GitCompare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, addDays, addWeeks, addMonths } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────

interface APInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  vendorCode: string;
  amount: number;
  tax: number;
  total: number;
  invoiceDate: string;
  dueDate: string;
  category: string;
  department: string;
  status: 'received' | 'verified' | 'approved' | 'scheduled' | 'paid' | 'rejected' | 'overdue' | 'pending' | 'reviewed' | 'void' | 'department_review' | 'manager_review' | 'finance_review' | 'completed';
  assignee: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  poNumber?: string;
  notes?: string;
  stage?: string;
}

interface WorkflowStage {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  isActive: boolean;
}

interface PaymentSchedule {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  scheduledDate: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  paymentMethod: string;
  reference?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  category: string;
  type: 'invoice' | 'contract' | 'po' | 'receipt' | 'report' | 'other';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  versions: number;
  tags: string[];
}

// ── Mock Data removed — fetched from /api/billing/ap-workflow ───────

// ── API response types ───────────────────────────────────────────

interface ApiWorkflowStage {
  id: string; name: string; order: number; description: string; approverRole: string | null; avgTurnaroundHours: number; currentInQueue: number | null; slas: { warning: number; breach: number } | null;
}

interface ApiWorkflowStats {
  totalInvoices: number; pendingApproval: number; approved: number; paid: number; overdue: number; rejected: number; totalPayable: number; overdueAmount: number;
}

// ── Status label mapping for API statuses ─────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Received', reviewed: 'Verified', approved: 'Approved', paid: 'Paid',
  rejected: 'Rejected', void: 'Void', department_review: 'Dept Review',
  manager_review: 'Manager Review', finance_review: 'Finance Review', completed: 'Completed',
};

function getDisplayStatus(inv: APInvoice): string {
  return STATUS_LABELS[inv.status] || inv.stage || inv.status;
}

function getInvoiceStatus(inv: APInvoice): 'received' | 'verified' | 'approved' | 'scheduled' | 'paid' | 'rejected' | 'overdue' {
  const now = new Date();
  const isOverdue = !['paid', 'rejected', 'void', 'completed'].includes(inv.status) && inv.dueDate && new Date(inv.dueDate) < now;
  if (isOverdue) return 'overdue';
  const map: Record<string, 'received' | 'verified' | 'approved' | 'scheduled' | 'paid' | 'rejected' | 'overdue'> = {
    pending: 'received', department_review: 'received',
    reviewed: 'verified', manager_review: 'verified',
    approved: 'approved', finance_review: 'approved',
    paid: 'paid', completed: 'paid',
    rejected: 'rejected', void: 'rejected',
  };
  return map[inv.status] || 'received';
}

function getPriority(inv: APInvoice): 'low' | 'medium' | 'high' | 'urgent' {
  if (inv.priority) return inv.priority;
  if (getInvoiceStatus(inv) === 'overdue') return 'urgent';
  return 'medium';
}

const INVOICE_STATUS: Record<string, { label: string; color: string; badgeClass: string }> = {
  received: { label: 'Received', color: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  verified: { label: 'Verified', color: 'bg-violet-500', badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  approved: { label: 'Approved', color: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  scheduled: { label: 'Scheduled', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  paid: { label: 'Paid', color: 'bg-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: 'Rejected', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  overdue: { label: 'Overdue', color: 'bg-red-600', badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  low: { label: 'Low', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  medium: { label: 'Medium', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  high: { label: 'High', badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  urgent: { label: 'Urgent', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const PAYMENT_STATUS: Record<string, { label: string; badgeClass: string }> = {
  scheduled: { label: 'Scheduled', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  processing: { label: 'Processing', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  completed: { label: 'Completed', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Failed', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const DOC_TYPE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  invoice: { icon: <FileText className="h-4 w-4" />, color: 'text-sky-500' },
  contract: { icon: <FileCheck className="h-4 w-4" />, color: 'text-violet-500' },
  po: { icon: <FilePlus className="h-4 w-4" />, color: 'text-emerald-500' },
  receipt: { icon: <Stamp className="h-4 w-4" />, color: 'text-amber-500' },
  report: { icon: <FileText className="h-4 w-4" />, color: 'text-orange-500' },
  other: { icon: <FileMinus className="h-4 w-4" />, color: 'text-gray-500' },
};

const WORKFLOW_STAGES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'received', label: 'Received', icon: <FileText className="h-4 w-4" /> },
  { key: 'verified', label: 'Verified', icon: <FileCheck className="h-4 w-4" /> },
  { key: 'approved', label: 'Approved', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'scheduled', label: 'Scheduled', icon: <Calendar className="h-4 w-4" /> },
  { key: 'paid', label: 'Paid', icon: <CreditCard className="h-4 w-4" /> },
];

// ── Component ──────────────────────────────────────────────────────────

export default function APWorkflow() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<APInvoice | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [isDocDetailOpen, setIsDocDetailOpen] = useState(false);
  const [docCategoryFilter, setDocCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<APInvoice[]>([]);
  const [payments, setPayments] = useState<PaymentSchedule[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [workflowStages, setWorkflowStages] = useState<ApiWorkflowStage[]>([]);
  const [apiStats, setApiStats] = useState<ApiWorkflowStats | null>(null);

  // ── Fetch data from API ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch('/api/billing/ap-workflow')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success) {
          const d = data.data;

          // Map invoices from API to APInvoice
          if (d.invoices) {
            const mapped: APInvoice[] = d.invoices.map((inv: Record<string, unknown>) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber || '',
              vendor: inv.vendorName || 'Unknown',
              vendorCode: inv.vendorId ? `V-${String(inv.vendorId).substring(0, 6)}` : '',
              amount: Number(inv.amount) || 0,
              tax: Number(inv.tax) || 0,
              total: Number(inv.total) || 0,
              invoiceDate: inv.invoiceDate || '',
              dueDate: inv.dueDate || '',
              category: inv.category || inv.department || '',
              department: inv.department || '',
              status: inv.status || 'pending',
              assignee: '',
              priority: 'medium' as const,
              notes: inv.notes || undefined,
              stage: inv.stage || undefined,
            }));
            setInvoices(mapped);
          }

          // Map payments from API
          if (d.paymentSchedule) {
            const mapped: PaymentSchedule[] = d.paymentSchedule.map((p: Record<string, unknown>) => ({
              id: p.id,
              vendor: p.vendorName || 'Unknown',
              description: `Payment ${p.reference || p.id}`,
              amount: Number(p.amount) || 0,
              scheduledDate: p.scheduledDate || new Date().toISOString(),
              status: p.status === 'completed' ? 'completed' as const : p.status === 'failed' ? 'failed' as const : 'scheduled' as const,
              paymentMethod: p.paymentMethod || 'Bank Transfer',
              reference: p.reference || undefined,
            }));
            setPayments(mapped);
          }

          // Map documents from API
          if (d.documents && Array.isArray(d.documents) && d.documents.length > 0) {
            const mapped: DocumentItem[] = d.documents.map((doc: Record<string, unknown>) => ({
              id: doc.id,
              name: doc.name || 'Document',
              category: doc.category || 'Other',
              type: (doc.type as DocumentItem['type']) || 'other',
              size: doc.size || '0 KB',
              uploadedBy: doc.uploadedBy || 'System',
              uploadedAt: doc.uploadedAt || new Date().toISOString(),
              versions: doc.versions || 1,
              tags: doc.tags || [],
            }));
            setDocuments(mapped);
          } else {
            setDocuments([]);
          }

          if (d.workflowStages) setWorkflowStages(d.workflowStages);
          if (data.stats) setApiStats(data.stats);
        } else {
          setInvoices([]);
          setPayments([]);
          setDocuments([]);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load AP workflow data');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Computed ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (apiStats) {
      return {
        pending: apiStats.pendingApproval,
        approved: apiStats.approved,
        scheduled: payments.filter(p => p.status === 'scheduled').length,
        overdue: apiStats.overdue,
        totalOverdueAmount: apiStats.overdueAmount,
      };
    }
    const pending = invoices.filter(i => ['received', 'pending', 'department_review'].includes(i.status)).length;
    const approved = invoices.filter(i => ['approved', 'finance_review'].includes(i.status)).length;
    const scheduled = payments.filter(p => p.status === 'scheduled').length;
    const overdue = invoices.filter(i => getInvoiceStatus(i) === 'overdue').length;
    const totalOverdueAmount = invoices.filter(i => getInvoiceStatus(i) === 'overdue').reduce((s, i) => s + i.total, 0);
    return { pending, approved, scheduled, overdue, totalOverdueAmount };
  }, [invoices, payments, apiStats]);

  const workflowCounts = useMemo(() => {
    if (workflowStages.length > 0) {
      return WORKFLOW_STAGES.map(stage => {
        const matchingApiStage = workflowStages.find(ws => ws.name.toLowerCase().includes(stage.key));
        return {
          ...stage,
          count: matchingApiStage?.currentInQueue ?? invoices.filter(i => i.status === stage.key).length,
        };
      });
    }
    return WORKFLOW_STAGES.map(stage => ({
      ...stage,
      count: invoices.filter(i => i.status === stage.key).length,
    }));
  }, [invoices, workflowStages]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'all') {
        const effectiveStatus = getInvoiceStatus(inv);
        if (effectiveStatus !== statusFilter && inv.status !== statusFilter) return false;
      }
      if (categoryFilter !== 'all' && inv.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return inv.vendor.toLowerCase().includes(q) || inv.invoiceNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [invoices, searchQuery, statusFilter, categoryFilter]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (docCategoryFilter !== 'all' && doc.category !== docCategoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return doc.name.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q) || doc.tags.some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [documents, searchQuery, docCategoryFilter]);

  const upcomingPayments = useMemo(() => {
    return [...payments]
      .filter(p => p.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [payments]);

  const totalScheduled = useMemo(() => {
    return payments.filter(p => p.status === 'scheduled').reduce((s, p) => s + p.amount, 0);
  }, [payments]);

  const categories = useMemo(() => [...new Set(invoices.map(i => i.category).filter(Boolean))], [invoices]);
  const docCategories = useMemo(() => [...new Set(documents.map(d => d.category).filter(Boolean))], [documents]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAction = (action: string) => {
    toast({ title: 'Success', description: `Invoice ${action} successfully` });
    setIsDetailOpen(false);
  };

  const handleUpload = () => {
    toast({ title: 'Document Uploaded', description: 'File uploaded successfully' });
    setIsUploadOpen(false);
  };

  // ── Render: Stat cards ───────────────────────────────────────────

  const renderStatCards = () => (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-400 bg-clip-text text-transparent">
              {stats.pending}
            </div>
            <div className="text-xs text-muted-foreground">Pending Invoices</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
              {stats.approved}
            </div>
            <div className="text-xs text-muted-foreground">Approved This Month</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <CalendarClock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
              {stats.scheduled}
            </div>
            <div className="text-xs text-muted-foreground">Payment Scheduled</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-400 bg-clip-text text-transparent">
              {stats.overdue}
            </div>
            <div className="text-xs text-muted-foreground">
              Overdue ({formatCurrency(stats.totalOverdueAmount)})
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Invoice Queue tab ────────────────────────────────────

  const renderInvoiceQueue = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by vendor, invoice #, or assignee..."
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
            {Object.entries(INVOICE_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => {
                  const effectiveStatus = getInvoiceStatus(inv);
                  const statusCfg = INVOICE_STATUS[effectiveStatus];
                  const priCfg = PRIORITY_CONFIG[getPriority(inv)];
                  const isDueSoon = !['paid', 'rejected', 'void', 'completed'].includes(inv.status) && inv.dueDate && new Date(inv.dueDate) <= addDays(new Date(), 3);
                  return (
                    <TableRow
                      key={inv.id}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/50',
                        effectiveStatus === 'overdue' && 'bg-red-50/30 dark:bg-red-950/10',
                        isDueSoon && effectiveStatus !== 'overdue' && 'bg-amber-50/30 dark:bg-amber-950/10',
                      )}
                      onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                          {inv.poNumber && (
                            <p className="text-[10px] text-muted-foreground">PO: {inv.poNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{inv.vendor}</p>
                            <p className="text-[10px] text-muted-foreground">{inv.vendorCode}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">{inv.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={cn(isDueSoon && 'text-amber-600 font-medium', effectiveStatus === 'overdue' && 'text-red-600 font-medium')}>
                            {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{formatCurrency(inv.total)}</span>
                        <p className="text-[10px] text-muted-foreground">Tax: {formatCurrency(inv.tax)}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <UserCircle className="h-3 w-3 text-muted-foreground" />
                          {inv.assignee || inv.vendorCode || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className={cn('text-xs gap-1 w-fit', statusCfg?.badgeClass)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg?.color)} />
                            {statusCfg?.label}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] w-fit', priCfg?.badgeClass)}>
                            {priCfg?.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); setIsDetailOpen(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ── Render: Approval Workflow tab ────────────────────────────────

  const renderApprovalWorkflow = () => (
    <div className="space-y-6">
      {/* Visual pipeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Invoice Pipeline
          </CardTitle>
          <CardDescription>Visual overview of the approval workflow stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 items-start sm:items-center">
            {workflowCounts.map((stage, idx) => (
              <React.Fragment key={stage.key}>
                <div className="flex-1 flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer min-w-[100px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      'p-1.5 rounded-md',
                      stage.count > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      {stage.icon}
                    </div>
                    <span className="text-xl font-bold">{stage.count}</span>
                  </div>
                  <span className="text-xs font-medium text-center">{stage.label}</span>
                </div>
                {idx < workflowCounts.length - 1 && (
                  <ChevronRight className="hidden sm:block h-5 w-5 text-muted-foreground -mx-1 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage breakdown */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {workflowCounts.filter(s => s.count > 0).map(stage => {
          const stageInvoices = invoices.filter(i => i.status === stage.key);
          const total = stageInvoices.reduce((s, i) => s + i.total, 0);
          return (
            <Card key={stage.key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">{stage.icon}</div>
                    <span className="font-semibold text-sm">{stage.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stage.count} invoices</Badge>
                </div>
                <p className="text-lg font-bold">{formatCurrency(total)}</p>
                <ScrollArea className="max-h-[120px]">
                  <div className="space-y-2">
                    {stageInvoices.slice(0, 5).map(inv => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between text-xs p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground shrink-0">{inv.invoiceNumber.slice(-4)}</span>
                          <span className="truncate">{inv.vendor}</span>
                        </div>
                        <span className="font-medium shrink-0">{formatCurrency(inv.total)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // ── Render: Payment Schedule tab ─────────────────────────────────

  const renderPaymentSchedule = () => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CalendarClock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-bold">{formatCurrency(totalScheduled)}</div>
              <div className="text-[10px] text-muted-foreground">Total Upcoming</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <Timer className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="text-xl font-bold">{upcomingPayments.length}</div>
              <div className="text-[10px] text-muted-foreground">Scheduled Payments</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-xl font-bold">
                {payments.filter(p => p.status === 'failed').length}
              </div>
              <div className="text-[10px] text-muted-foreground">Failed Payments</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Timeline / Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(payment => {
                  const statusCfg = PAYMENT_STATUS[payment.status];
                  const dateObj = new Date(payment.scheduledDate);
                  const isPast = dateObj < new Date() && payment.status === 'scheduled';
                  return (
                    <TableRow
                      key={payment.id}
                      className={cn(
                        payment.status === 'failed' && 'bg-red-50/30 dark:bg-red-950/10',
                        isPast && 'bg-amber-50/30 dark:bg-amber-950/10',
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={cn(
                            'text-sm',
                            isPast && 'text-amber-600 font-medium',
                            payment.status === 'failed' && 'text-red-600 font-medium',
                          )}>
                            {format(dateObj, 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(dateObj, { addSuffix: true })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">{payment.vendor}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{payment.description}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{formatCurrency(payment.amount)}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">{payment.paymentMethod}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs gap-1', statusCfg?.badgeClass)}>
                          {statusCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Eye className="h-3 w-3 mr-2" />View Details</DropdownMenuItem>
                            {payment.status === 'failed' && (
                              <DropdownMenuItem className="text-amber-600"><RefreshCw className="h-3 w-3 mr-2" />Retry Payment</DropdownMenuItem>
                            )}
                            {payment.status === 'scheduled' && (
                              <>
                                <DropdownMenuItem className="text-sky-600"><Pencil className="h-3 w-3 mr-2" />Reschedule</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600"><XCircle className="h-3 w-3 mr-2" />Cancel Payment</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ── Render: Documents tab ────────────────────────────────────────

  const renderDocuments = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={docCategoryFilter} onValueChange={setDocCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {docCategories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setIsUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Upload area */}
      <Card className="border-dashed-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setIsUploadOpen(true)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Upload className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-xs mt-1">PDF, DOC, XLS, JPG up to 25MB</p>
        </CardContent>
      </Card>

      {/* Document list */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead className="hidden lg:table-cell">Uploaded By</TableHead>
                  <TableHead className="hidden lg:table-cell">Versions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map(doc => {
                  const typeCfg = DOC_TYPE_ICONS[doc.type];
                  return (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => { setSelectedDocument(doc); setIsDocDetailOpen(true); }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1.5 rounded bg-muted', typeCfg?.color)}>
                            {typeCfg?.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[200px]">{doc.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{doc.size}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{doc.uploadedBy}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <GitCompare className="h-3 w-3 text-muted-foreground" />
                          v{doc.versions}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast({ title: 'Download', description: `${doc.name} downloaded` }); }}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setIsDocDetailOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ── Render: Invoice detail dialog ────────────────────────────────

  const renderInvoiceDetail = () => {
    if (!selectedInvoice) return null;
    const inv = selectedInvoice;
    const effectiveStatus = getInvoiceStatus(inv);
    const statusCfg = INVOICE_STATUS[effectiveStatus];
    return (
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-500" />
              {inv.invoiceNumber}
            </DialogTitle>
            <DialogDescription>{inv.vendor} — {inv.category}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="font-medium text-sm">{inv.vendor} ({inv.vendorCode})</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium text-sm">{inv.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Invoice Date</p>
                <p className="font-medium text-sm">{format(new Date(inv.invoiceDate), 'MMM d, yyyy')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className={cn('font-medium text-sm', effectiveStatus === 'overdue' && 'text-red-600')}>
                  {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-medium text-sm">{formatCurrency(inv.amount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tax</p>
                <p className="font-medium text-sm">{formatCurrency(inv.tax)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-xl">{formatCurrency(inv.total)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Vendor Code</p>
                <p className="font-medium text-sm">{inv.vendorCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priority</p>
                <Badge variant="outline" className={cn('text-xs', PRIORITY_CONFIG[getPriority(inv)]?.badgeClass)}>
                  {PRIORITY_CONFIG[getPriority(inv)]?.label}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="secondary" className={cn('text-xs gap-1', statusCfg?.badgeClass)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg?.color)} />
                  {statusCfg?.label}
                </Badge>
              </div>
            </div>
            {inv.notes && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm text-muted-foreground italic">{inv.notes}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {inv.status === 'received' && (
              <Button variant="outline" onClick={() => handleAction('verified')}>
                <FileCheck className="h-4 w-4 mr-2" />
                Verify
              </Button>
            )}
            {inv.status === 'verified' && (
              <Button onClick={() => handleAction('approved')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {inv.status === 'approved' && (
              <Button onClick={() => handleAction('scheduled for payment')}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Payment
              </Button>
            )}
            {(inv.status === 'received' || inv.status === 'verified') && (
              <Button variant="outline" onClick={() => handleAction('rejected')} className="text-red-500 border-red-200 hover:bg-red-50 ml-auto">
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Render: Document detail dialog ───────────────────────────────

  const renderDocDetail = () => {
    if (!selectedDocument) return null;
    const doc = selectedDocument;
    return (
      <Dialog open={isDocDetailOpen} onOpenChange={setIsDocDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-violet-500" />
              Document Details
            </DialogTitle>
            <DialogDescription>{doc.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Category</p>
                <Badge variant="outline">{doc.category}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Type</p>
                <Badge variant="secondary" className="capitalize">{doc.type}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Size</p>
                <p className="font-medium text-sm">{doc.size}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Versions</p>
                <div className="flex items-center gap-1">
                  <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-medium text-sm">{doc.versions} versions</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Uploaded By</p>
                <p className="font-medium text-sm">{doc.uploadedBy}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Uploaded At</p>
                <p className="font-medium text-sm">{format(new Date(doc.uploadedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
            {doc.tags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => toast({ title: 'Download', description: `${doc.name} downloaded` })}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Render: Upload dialog ────────────────────────────────────────

  const renderUploadDialog = () => (
    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </DialogTitle>
          <DialogDescription>Add a new document to the repository</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Click or drag file here</p>
            <p className="text-xs mt-1">PDF, DOC, XLS, JPG up to 25MB</p>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {docCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags (comma separated)</Label>
            <Input placeholder="e.g., invoice, june, vendor" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input placeholder="Optional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
          <Button onClick={handleUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Main render ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading AP workflow data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-sm font-medium text-red-600">Failed to load AP workflow data</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-emerald-500" />
            AP Workflow &amp; Document Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage invoices, approvals, payment schedules, and documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      {renderStatCards()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setDocCategoryFilter('all'); }}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="invoices" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="workflow" className="text-xs sm:text-sm">
            <ArrowLeftRight className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Workflow
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm">
            <Calendar className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">
            <FolderOpen className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Documents
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="invoices">
            {renderInvoiceQueue()}
          </TabsContent>
          <TabsContent value="workflow">
            {renderApprovalWorkflow()}
          </TabsContent>
          <TabsContent value="payments">
            {renderPaymentSchedule()}
          </TabsContent>
          <TabsContent value="documents">
            {renderDocuments()}
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialogs */}
      {renderInvoiceDetail()}
      {renderDocDetail()}
      {renderUploadDialog()}
    </div>
  );
}
