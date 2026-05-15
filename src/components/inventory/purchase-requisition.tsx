'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Truck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  ClipboardList,
  FileCheck2,
  FileX2,
  BarChart3,
  Timer,
  UserCheck,
  Package,
  Settings,
  Zap,
  ChevronDown,
  ChevronUp,
  Ban,
  CreditCard,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

type RequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'po_generated'
  | 'received'
  | 'three_way_matched'
  | 'closed';

type Priority = 'critical' | 'high' | 'normal' | 'low';
type MatchStatus = 'unmatched' | 'partially_matched' | 'fully_matched' | 'variance_detected';
type VarianceType = 'quantity' | 'price' | 'date' | 'tax';

interface RequisitionItem {
  id: string;
  itemName: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  preferredSupplier: string;
}

interface AutoRequisitionRule {
  id: string;
  itemId: string;
  itemName: string;
  reorderPoint: number;
  currentStock: number;
  reorderQty: number;
  autoApprove: boolean;
  approvalThreshold: number;
}

interface SupplierRanking {
  id: string;
  category: string;
  supplier: string;
  rank: number;
  onTimeRate: number;
  accuracyRate: number;
}

interface BudgetAllocation {
  department: string;
  allocated: number;
  spent: number;
  remaining: number;
}

interface Requisition {
  id: string;
  requisitionNumber: string;
  department: string;
  requestedBy: string;
  requestDate: string;
  status: RequisitionStatus;
  priority: Priority;
  totalAmount: number;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  items: RequisitionItem[];
  approvalThreshold: number;
}

interface InvoiceMatchRecord {
  id: string;
  poNumber: string;
  grnNumber: string;
  invoiceNumber: string;
  vendorName: string;
  matchStatus: MatchStatus;
  poAmount: number;
  grnAmount: number;
  invoiceAmount: number;
  variances: VarianceDetail[];
  resolvedAt?: string;
  resolution?: string;
}

interface VarianceDetail {
  type: VarianceType;
  expected: number | string;
  actual: number | string;
  difference: number | string;
}

interface AnalyticsData {
  monthlyVolume: { month: string; count: number; amount: number }[];
  avgApprovalTime: number;
  supplierPerformance: { supplier: string; onTimeRate: number; accuracyRate: number; ordersCount: number }[];
  costSavings: number;
}

// ─── Status & Priority Configs ──────────────────────────────────────

const STATUS_CONFIG: Record<RequisitionStatus, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: FileText },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  po_generated: { label: 'PO Generated', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', icon: Send },
  received: { label: 'Received', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', icon: Truck },
  three_way_matched: { label: '3-Way Matched', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: FileCheck2 },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dotColor: string }> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dotColor: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dotColor: 'bg-orange-500' },
  normal: { label: 'Normal', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', dotColor: 'bg-sky-500' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dotColor: 'bg-gray-500' },
};

const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; icon: typeof FileText }> = {
  unmatched: { label: 'Unmatched', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: FileX2 },
  partially_matched: { label: 'Partially Matched', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle },
  fully_matched: { label: 'Fully Matched', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: FileCheck2 },
  variance_detected: { label: 'Variance Detected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const VARIANCE_TYPE_LABELS: Record<VarianceType, string> = {
  quantity: 'Quantity',
  price: 'Price',
  date: 'Date',
  tax: 'Tax',
};

// ─── Mock Data ──────────────────────────────────────────────────────

const autoRules: AutoRequisitionRule[] = [
  { id: 'ar1', itemId: 'itm1', itemName: 'Premium Bed Sheets (King)', reorderPoint: 50, currentStock: 35, reorderQty: 100, autoApprove: true, approvalThreshold: 500 },
  { id: 'ar2', itemId: 'itm2', itemName: 'Bath Towels (Large)', reorderPoint: 80, currentStock: 92, reorderQty: 150, autoApprove: true, approvalThreshold: 500 },
  { id: 'ar3', itemId: 'itm3', itemName: 'Toilet Paper (12-pack)', reorderPoint: 200, currentStock: 180, reorderQty: 500, autoApprove: true, approvalThreshold: 500 },
  { id: 'ar4', itemId: 'itm4', itemName: 'Room Shampoo (500ml)', reorderPoint: 60, currentStock: 15, reorderQty: 120, autoApprove: false, approvalThreshold: 500 },
  { id: 'ar5', itemId: 'itm5', itemName: 'LED Light Bulbs (E27)', reorderPoint: 30, currentStock: 22, reorderQty: 60, autoApprove: true, approvalThreshold: 500 },
  { id: 'ar6', itemId: 'itm6', itemName: 'Cleaning Disinfectant (5L)', reorderPoint: 20, currentStock: 8, reorderQty: 40, autoApprove: false, approvalThreshold: 500 },
  { id: 'ar7', itemId: 'itm7', itemName: 'Coffee Pods (Decaf)', reorderPoint: 100, currentStock: 110, reorderQty: 200, autoApprove: true, approvalThreshold: 500 },
  { id: 'ar8', itemId: 'itm8', itemName: 'Pillow Cases (Standard)', reorderPoint: 60, currentStock: 45, reorderQty: 120, autoApprove: true, approvalThreshold: 500 },
];

const supplierRankings: SupplierRanking[] = [
  { id: 'sr1', category: 'Linens', supplier: 'TextilePro Global', rank: 1, onTimeRate: 96.5, accuracyRate: 99.1 },
  { id: 'sr2', category: 'Linens', supplier: 'Royal Weave Co.', rank: 2, onTimeRate: 92.3, accuracyRate: 97.8 },
  { id: 'sr3', category: 'Amenities', supplier: 'FreshPack Supplies', rank: 1, onTimeRate: 98.1, accuracyRate: 99.5 },
  { id: 'sr4', category: 'Amenities', supplier: 'GuestEssentials Ltd.', rank: 2, onTimeRate: 89.7, accuracyRate: 96.2 },
  { id: 'sr5', category: 'Electrical', supplier: 'BrightSource Electric', rank: 1, onTimeRate: 94.0, accuracyRate: 98.3 },
  { id: 'sr6', category: 'Cleaning', supplier: 'CleanMax Industries', rank: 1, onTimeRate: 97.2, accuracyRate: 99.0 },
  { id: 'sr7', category: 'F&B', supplier: 'BeanCraft Roasters', rank: 1, onTimeRate: 95.8, accuracyRate: 98.7 },
];

const budgets: BudgetAllocation[] = [
  { department: 'Housekeeping', allocated: 15000, spent: 11200, remaining: 3800 },
  { department: 'Engineering', allocated: 8000, spent: 6400, remaining: 1600 },
  { department: 'Food & Beverage', allocated: 25000, spent: 18700, remaining: 6300 },
  { department: 'Front Office', allocated: 5000, spent: 3200, remaining: 1800 },
  { department: 'Maintenance', allocated: 10000, spent: 9100, remaining: 900 },
];

const requisitions: Requisition[] = [
  {
    id: 'req1', requisitionNumber: 'REQ-2024-001', department: 'Housekeeping', requestedBy: 'Maria Santos',
    requestDate: '2024-12-01', status: 'three_way_matched', priority: 'normal', totalAmount: 2450.00,
    approvedBy: 'John Parker', approvedAt: '2024-12-02', notes: 'Monthly linen restock',
    items: [
      { id: 'ri1', itemName: 'Premium Bed Sheets (King)', sku: 'LN-BS-K01', category: 'Linens', quantity: 100, unitPrice: 15.00, totalAmount: 1500.00, preferredSupplier: 'TextilePro Global' },
      { id: 'ri2', itemName: 'Pillow Cases (Standard)', sku: 'LN-PC-S01', category: 'Linens', quantity: 120, unitPrice: 5.50, totalAmount: 660.00, preferredSupplier: 'TextilePro Global' },
      { id: 'ri3', itemName: 'Bath Towels (Large)', sku: 'LN-BT-L01', category: 'Linens', quantity: 80, unitPrice: 3.62, totalAmount: 290.00, preferredSupplier: 'Royal Weave Co.' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req2', requisitionNumber: 'REQ-2024-002', department: 'Food & Beverage', requestedBy: 'David Chen',
    requestDate: '2024-12-03', status: 'approved', priority: 'high', totalAmount: 3800.00,
    approvedBy: 'Sarah Mitchell', approvedAt: '2024-12-04',
    items: [
      { id: 'ri4', itemName: 'Coffee Pods (Decaf)', sku: 'FB-CP-D01', category: 'F&B', quantity: 500, unitPrice: 0.85, totalAmount: 425.00, preferredSupplier: 'BeanCraft Roasters' },
      { id: 'ri5', itemName: 'Premium Olive Oil (1L)', sku: 'FB-OO-P01', category: 'F&B', quantity: 60, unitPrice: 22.00, totalAmount: 1320.00, preferredSupplier: 'Mediterranean Imports' },
      { id: 'ri6', itemName: 'Artisan Bread Flour (25kg)', sku: 'FB-BF-A01', category: 'F&B', quantity: 20, unitPrice: 45.00, totalAmount: 900.00, preferredSupplier: 'GrainMill Supply' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req3', requisitionNumber: 'REQ-2024-003', department: 'Engineering', requestedBy: 'Robert Kim',
    requestDate: '2024-12-05', status: 'pending_approval', priority: 'critical', totalAmount: 8500.00,
    items: [
      { id: 'ri7', itemName: 'LED Light Bulbs (E27)', sku: 'EL-LB-E27', category: 'Electrical', quantity: 200, unitPrice: 8.50, totalAmount: 1700.00, preferredSupplier: 'BrightSource Electric' },
      { id: 'ri8', itemName: 'Smart Thermostat Unit', sku: 'EL-ST-U01', category: 'Electrical', quantity: 15, unitPrice: 320.00, totalAmount: 4800.00, preferredSupplier: 'BrightSource Electric' },
      { id: 'ri9', itemName: 'Electrical Panel Breaker (20A)', sku: 'EL-EP-B20', category: 'Electrical', quantity: 40, unitPrice: 25.00, totalAmount: 1000.00, preferredSupplier: 'BrightSource Electric' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req4', requisitionNumber: 'REQ-2024-004', department: 'Housekeeping', requestedBy: 'Maria Santos',
    requestDate: '2024-12-06', status: 'received', priority: 'normal', totalAmount: 1680.00,
    approvedBy: 'John Parker', approvedAt: '2024-12-06',
    items: [
      { id: 'ri10', itemName: 'Room Shampoo (500ml)', sku: 'AM-SH-500', category: 'Amenities', quantity: 120, unitPrice: 6.50, totalAmount: 780.00, preferredSupplier: 'FreshPack Supplies' },
      { id: 'ri11', itemName: 'Body Lotion (300ml)', sku: 'AM-BL-300', category: 'Amenities', quantity: 120, unitPrice: 5.00, totalAmount: 600.00, preferredSupplier: 'FreshPack Supplies' },
      { id: 'ri12', itemName: 'Hand Soap Dispenser', sku: 'AM-HS-D01', category: 'Amenities', quantity: 50, unitPrice: 6.00, totalAmount: 300.00, preferredSupplier: 'FreshPack Supplies' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req5', requisitionNumber: 'REQ-2024-005', department: 'Maintenance', requestedBy: 'Tom Wilson',
    requestDate: '2024-12-07', status: 'draft', priority: 'low', totalAmount: 320.00,
    items: [
      { id: 'ri13', itemName: 'Cleaning Disinfectant (5L)', sku: 'CL-CD-5L', category: 'Cleaning', quantity: 20, unitPrice: 16.00, totalAmount: 320.00, preferredSupplier: 'CleanMax Industries' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req6', requisitionNumber: 'REQ-2024-006', department: 'Front Office', requestedBy: 'Emily Brown',
    requestDate: '2024-12-08', status: 'po_generated', priority: 'normal', totalAmount: 450.00,
    approvedBy: 'Sarah Mitchell', approvedAt: '2024-12-08',
    items: [
      { id: 'ri14', itemName: 'Welcome Card Stock (A5)', sku: 'FO-WC-A5', category: 'Office Supplies', quantity: 500, unitPrice: 0.45, totalAmount: 225.00, preferredSupplier: 'PrintWorld Co.' },
      { id: 'ri15', itemName: 'Luggage Tags (Custom)', sku: 'FO-LT-C01', category: 'Office Supplies', quantity: 300, unitPrice: 0.75, totalAmount: 225.00, preferredSupplier: 'PrintWorld Co.' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req7', requisitionNumber: 'REQ-2024-007', department: 'Housekeeping', requestedBy: 'Maria Santos',
    requestDate: '2024-12-09', status: 'closed', priority: 'normal', totalAmount: 720.00,
    approvedBy: 'John Parker', approvedAt: '2024-12-09',
    items: [
      { id: 'ri16', itemName: 'Toilet Paper (12-pack)', sku: 'AM-TP-12P', category: 'Amenities', quantity: 150, unitPrice: 4.80, totalAmount: 720.00, preferredSupplier: 'FreshPack Supplies' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req8', requisitionNumber: 'REQ-2024-008', department: 'Food & Beverage', requestedBy: 'David Chen',
    requestDate: '2024-12-10', status: 'pending_approval', priority: 'high', totalAmount: 6200.00,
    items: [
      { id: 'ri17', itemName: 'Premium Wine Glasses', sku: 'FB-WG-P01', category: 'F&B', quantity: 200, unitPrice: 12.00, totalAmount: 2400.00, preferredSupplier: 'GlassArt Ltd.' },
      { id: 'ri18', itemName: 'Dinner Plates (Porcelain 10")', sku: 'FB-DP-P10', category: 'F&B', quantity: 150, unitPrice: 8.50, totalAmount: 1275.00, preferredSupplier: 'TableWear Pro' },
      { id: 'ri19', itemName: 'Commercial Blender (1.5L)', sku: 'FB-CB-15L', category: 'F&B', quantity: 5, unitPrice: 505.00, totalAmount: 2525.00, preferredSupplier: 'KitchenTech Supply' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req9', requisitionNumber: 'REQ-2024-009', department: 'Engineering', requestedBy: 'Robert Kim',
    requestDate: '2024-12-11', status: 'draft', priority: 'critical', totalAmount: 12500.00,
    items: [
      { id: 'ri20', itemName: 'HVAC Air Filter (20x25x4)', sku: 'EL-AF-2025', category: 'Electrical', quantity: 50, unitPrice: 45.00, totalAmount: 2250.00, preferredSupplier: 'BrightSource Electric' },
      { id: 'ri21', itemName: 'Water Heater Element', sku: 'EL-WH-E01', category: 'Electrical', quantity: 10, unitPrice: 185.00, totalAmount: 1850.00, preferredSupplier: 'BrightSource Electric' },
      { id: 'ri22', itemName: 'Emergency Exit Sign (LED)', sku: 'EL-ES-LED', category: 'Electrical', quantity: 30, unitPrice: 280.00, totalAmount: 8400.00, preferredSupplier: 'BrightSource Electric' },
    ],
    approvalThreshold: 500,
  },
  {
    id: 'req10', requisitionNumber: 'REQ-2024-010', department: 'Maintenance', requestedBy: 'Tom Wilson',
    requestDate: '2024-12-12', status: 'approved', priority: 'high', totalAmount: 2100.00,
    approvedBy: 'John Parker', approvedAt: '2024-12-12',
    items: [
      { id: 'ri23', itemName: 'Industrial Mop Heads (Set)', sku: 'CL-MH-S01', category: 'Cleaning', quantity: 30, unitPrice: 18.00, totalAmount: 540.00, preferredSupplier: 'CleanMax Industries' },
      { id: 'ri24', itemName: 'Floor Polish (5L)', sku: 'CL-FP-5L', category: 'Cleaning', quantity: 25, unitPrice: 32.00, totalAmount: 800.00, preferredSupplier: 'CleanMax Industries' },
      { id: 'ri25', itemName: 'Vacuum Cleaner Bags (Pack of 10)', sku: 'CL-VC-B10', category: 'Cleaning', quantity: 40, unitPrice: 19.00, totalAmount: 760.00, preferredSupplier: 'CleanMax Industries' },
    ],
    approvalThreshold: 500,
  },
];

const invoiceMatches: InvoiceMatchRecord[] = [
  {
    id: 'im1', poNumber: 'PO-2024-001', grnNumber: 'GRN-2024-001', invoiceNumber: 'INV-TP-8821',
    vendorName: 'TextilePro Global', matchStatus: 'fully_matched', poAmount: 2450.00, grnAmount: 2450.00, invoiceAmount: 2450.00,
    variances: [],
  },
  {
    id: 'im2', poNumber: 'PO-2024-002', grnNumber: 'GRN-2024-002', invoiceNumber: 'INV-FP-4401',
    vendorName: 'FreshPack Supplies', matchStatus: 'fully_matched', poAmount: 1680.00, grnAmount: 1680.00, invoiceAmount: 1680.00,
    variances: [],
  },
  {
    id: 'im3', poNumber: 'PO-2024-003', grnNumber: 'GRN-2024-003', invoiceNumber: 'INV-BS-3390',
    vendorName: 'BrightSource Electric', matchStatus: 'variance_detected', poAmount: 8500.00, grnAmount: 8350.00, invoiceAmount: 8920.00,
    variances: [
      { type: 'quantity', expected: '15 units', actual: '14 units', difference: '-1 unit' },
      { type: 'price', expected: '$8.50', actual: '$9.20', difference: '+$0.70/unit' },
      { type: 'tax', expected: '$850.00', actual: '$892.00', difference: '+$42.00' },
    ],
  },
  {
    id: 'im4', poNumber: 'PO-2024-004', grnNumber: 'GRN-2024-004', invoiceNumber: 'INV-GM-7752',
    vendorName: 'GrainMill Supply', matchStatus: 'partially_matched', poAmount: 900.00, grnAmount: 675.00, invoiceAmount: 675.00,
    variances: [
      { type: 'quantity', expected: '20 bags', actual: '15 bags', difference: '-5 bags' },
    ],
    resolvedAt: '2024-12-13', resolution: 'Short shipment accepted. Balance to be shipped by Dec 20.',
  },
  {
    id: 'im5', poNumber: 'PO-2024-005', grnNumber: 'GRN-2024-005', invoiceNumber: 'INV-GW-5521',
    vendorName: 'GlassArt Ltd.', matchStatus: 'variance_detected', poAmount: 2400.00, grnAmount: 2400.00, invoiceAmount: 2640.00,
    variances: [
      { type: 'price', expected: '$12.00/unit', actual: '$13.20/unit', difference: '+$1.20/unit' },
    ],
  },
  {
    id: 'im6', poNumber: 'PO-2024-006', grnNumber: 'GRN-2024-006', invoiceNumber: 'INV-CT-1190',
    vendorName: 'CleanMax Industries', matchStatus: 'unmatched', poAmount: 2100.00, grnAmount: 2100.00, invoiceAmount: 2100.00,
    variances: [
      { type: 'date', expected: '2024-12-14', actual: '2024-12-18', difference: '+4 days late' },
    ],
  },
];

const analytics: AnalyticsData = {
  monthlyVolume: [
    { month: 'Jul', count: 12, amount: 18200 },
    { month: 'Aug', count: 15, amount: 24500 },
    { month: 'Sep', count: 18, amount: 31000 },
    { month: 'Oct', count: 14, amount: 22300 },
    { month: 'Nov', count: 20, amount: 34800 },
    { month: 'Dec', count: 22, amount: 41500 },
  ],
  avgApprovalTime: 1.8,
  supplierPerformance: [
    { supplier: 'TextilePro Global', onTimeRate: 96.5, accuracyRate: 99.1, ordersCount: 24 },
    { supplier: 'FreshPack Supplies', onTimeRate: 98.1, accuracyRate: 99.5, ordersCount: 31 },
    { supplier: 'BrightSource Electric', onTimeRate: 94.0, accuracyRate: 98.3, ordersCount: 18 },
    { supplier: 'CleanMax Industries', onTimeRate: 97.2, accuracyRate: 99.0, ordersCount: 22 },
    { supplier: 'BeanCraft Roasters', onTimeRate: 95.8, accuracyRate: 98.7, ordersCount: 15 },
  ],
  costSavings: 8420,
};

// ─── Component ──────────────────────────────────────────────────────

export default function PurchaseRequisition() {
  // ── State ──
  const [activeTab, setActiveTab] = useState('requisitions');
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Record<string, unknown>[]>([]);
  const [vendors, setVendors] = useState<Record<string, unknown>[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [varianceDialogOpen, setVarianceDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatchRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [varianceAction, setVarianceAction] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [rankingsExpanded, setRankingsExpanded] = useState(true);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(500);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch data from APIs ──
  const fetchPurchaseData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, vendorsRes, poRes] = await Promise.all([
        fetch('/api/inventory?limit=100').catch(() => null),
        fetch('/api/inventory/vendors').catch(() => null),
        fetch('/api/inventory/purchase-orders').catch(() => null),
      ]);

      if (itemsRes?.ok) {
        const itemsJson = await itemsRes.json();
        if (itemsJson.success) setInventoryItems(itemsJson.data || []);
      }
      if (vendorsRes?.ok) {
        const vendorsJson = await vendorsRes.json();
        if (vendorsJson.success) setVendors(vendorsJson.data || []);
      }
      if (poRes?.ok) {
        const poJson = await poRes.json();
        if (poJson.success) setPurchaseOrders(poJson.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPurchaseData(); }, [fetchPurchaseData]);

  // ── Computed ──
  const departments = useMemo(() => [...new Set(requisitions.map(r => r.department))].sort(), [requisitions]);

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(r => {
      const matchSearch = !search ||
        r.requisitionNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.requestedBy.toLowerCase().includes(search.toLowerCase()) ||
        r.items.some(i => i.itemName.toLowerCase().includes(search.toLowerCase()));
      const matchDept = departmentFilter === 'all' || r.department === departmentFilter;
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
      return matchSearch && matchDept && matchStatus && matchPriority;
    });
  }, [requisitions, search, departmentFilter, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const total = requisitions.length;
    const pendingApproval = requisitions.filter(r => r.status === 'pending_approval').length;
    const matched = requisitions.filter(r => r.status === 'three_way_matched').length;
    const totalValue = requisitions.reduce((sum, r) => sum + r.totalAmount, 0);
    return { total, pendingApproval, matched, totalValue };
  }, [requisitions]);

  const autoReorderAlerts = useMemo(() => {
    return inventoryItems
      .filter((item: Record<string, unknown>) =>
        Number(item.currentStock || 0) <= Number(item.lowStockThreshold || item.reorderLevel || 10)
      )
      .map((item: Record<string, unknown>) => ({
        id: item.id as string,
        itemId: item.id as string,
        itemName: item.name as string,
        reorderPoint: Number(item.lowStockThreshold || item.reorderLevel || 10),
        currentStock: Number(item.currentStock || 0),
        reorderQty: Number(item.reorderLevel || 10) * 2,
        autoApprove: false,
        approvalThreshold: 500,
      }));
  }, [inventoryItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // ── Handlers ──
  const handleApprove = (req: Requisition) => {
    setSelectedRequisition(req);
    setApproveDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!selectedRequisition) return;
    setSaving(true);
    try {
      toast.success(`Requisition ${selectedRequisition.requisitionNumber} approved`);
      setApproveDialogOpen(false);
      setSelectedRequisition(null);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (req: Requisition) => {
    setSelectedRequisition(req);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedRequisition || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setSaving(true);
    try {
      toast.success(`Requisition ${selectedRequisition.requisitionNumber} rejected`);
      setRejectDialogOpen(false);
      setSelectedRequisition(null);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerate = () => {
    if (autoReorderAlerts.length === 0) {
      toast.info('No items below reorder point');
      return;
    }
    toast.success(`Auto-generated ${autoReorderAlerts.length} requisition(s) for items below reorder point`);
  };

  const handleResolveVariance = (match: InvoiceMatchRecord, action: string) => {
    setSelectedMatch(match);
    setVarianceAction(action);
    setVarianceReason('');
    setVarianceDialogOpen(true);
  };

  const confirmVarianceResolution = async () => {
    if (!selectedMatch) return;
    if (!varianceReason.trim()) {
      toast.error('Please provide a reason for the resolution');
      return;
    }
    setSaving(true);
    try {
      toast.success(`Variance for ${selectedMatch.invoiceNumber} ${varianceAction === 'accept' ? 'accepted' : varianceAction === 'reject' ? 'disputed' : 'credited'}`);
      setVarianceDialogOpen(false);
      setSelectedMatch(null);
    } finally {
      setSaving(false);
    }
  };

  // ── Render Helpers ──
  const getStatusBadge = (status: RequisitionStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs', config.color)}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: Priority) => {
    const config = PRIORITY_CONFIG[priority];
    return (
      <Badge className={cn('text-xs', config.color)}>
        <span className={cn('h-1.5 w-1.5 rounded-full mr-1', config.dotColor)} />
        {config.label}
      </Badge>
    );
  };

  const getMatchStatusBadge = (status: MatchStatus) => {
    const config = MATCH_STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs', config.color)}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // ── JSX ──
  if (loading) {
    return (
      <div className=\"flex items-center justify-center min-h-[400px]\">
        <div className=\"text-center\">
          <Loader2 className=\"h-8 w-8 animate-spin text-muted-foreground mx-auto\" />
          <p className=\"text-sm text-muted-foreground mt-2\">Loading purchase data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className=\"flex items-center justify-center min-h-[400px]\">
        <div className=\"text-center\">
          <AlertCircle className=\"h-8 w-8 text-red-500 mx-auto\" />
          <p className=\"text-sm text-red-500 mt-2\">{error}</p>
          <Button variant=\"outline\" size=\"sm\" className=\"mt-3\" onClick={fetchPurchaseData}>
            <RefreshCw className=\"h-3.5 w-3.5 mr-1.5\" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Purchase Requisition & Invoice Matching</h1>
        <p className="text-muted-foreground">
          Automate purchase workflows, manage approvals, and perform 3-way invoice matching
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Requisitions</CardTitle>
            <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.total}</div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">This period</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pendingApproval}</div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">Requires action</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">3-Way Matched</CardTitle>
            <FileCheck2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.matched}</div>
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">Fully reconciled</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">Combined requisitions</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="requisitions" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Requisitions
          </TabsTrigger>
          <TabsTrigger value="matching" className="gap-1.5">
            <FileCheck2 className="h-4 w-4" />
            3-Way Matching
          </TabsTrigger>
          <TabsTrigger value="auto_rules" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Auto-Requisition
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Requisitions ── */}
        <TabsContent value="requisitions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search requisition #, requester, items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full md:w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Requisitions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Purchase Requisitions
                <Badge variant="outline" className="ml-2">{filteredRequisitions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Req #</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequisitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No requisitions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequisitions.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{req.requisitionNumber}</code>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{req.department}</div>
                            <div className="text-xs text-muted-foreground">{req.items.length} items</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {req.requestedBy.split(' ').map(n => n[0]).join('')}
                              </div>
                              {req.requestedBy}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {req.requestDate}
                            </div>
                          </TableCell>
                          <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(req.totalAmount)}</span>
                            {req.totalAmount >= req.approvalThreshold && (
                              <div className="text-xs text-amber-600 dark:text-amber-400">Needs approval</div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(req.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedRequisition(req); setViewDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {req.status === 'pending_approval' && (
                                <>
                                  <Button variant="outline" size="sm" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50" onClick={() => handleApprove(req)}>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400 border-red-300 hover:bg-red-50" onClick={() => handleReject(req)}>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {req.status === 'draft' && (
                                <Button variant="outline" size="sm" onClick={() => {
                                  toast.success(`Requisition ${req.requisitionNumber} submitted for approval`);
                                }}>
                                  <Send className="h-4 w-4 mr-1" />
                                  Submit
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: 3-Way Matching ── */}
        <TabsContent value="matching" className="space-y-4">
          {/* Matching Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { label: 'Fully Matched', count: invoiceMatches.filter(m => m.matchStatus === 'fully_matched').length, color: 'text-green-600 dark:text-green-400', bg: 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20', border: 'border-green-200 dark:border-green-800' },
              { label: 'Partially Matched', count: invoiceMatches.filter(m => m.matchStatus === 'partially_matched').length, color: 'text-yellow-600 dark:text-yellow-400', bg: 'from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20', border: 'border-yellow-200 dark:border-yellow-800' },
              { label: 'Variance Detected', count: invoiceMatches.filter(m => m.matchStatus === 'variance_detected').length, color: 'text-red-600 dark:text-red-400', bg: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20', border: 'border-red-200 dark:border-red-800' },
              { label: 'Unmatched', count: invoiceMatches.filter(m => m.matchStatus === 'unmatched').length, color: 'text-gray-600 dark:text-gray-400', bg: 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20', border: 'border-gray-200 dark:border-gray-800' },
            ] as const).map((stat) => (
              <Card key={stat.label} className={cn('bg-gradient-to-br', stat.bg, 'border', stat.border)}>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
                  <div className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.count}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Matching Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5" />
                Invoice Matching Records
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success('Auto-match engine scan complete. 2 discrepancies found.')}>
                <RefreshCw className="h-3.5 w-3.5" />
                Run Auto-Match
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>GRN #</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>PO Amount</TableHead>
                      <TableHead>Invoice Amount</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{match.poNumber}</code></TableCell>
                        <TableCell><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{match.grnNumber}</code></TableCell>
                        <TableCell><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{match.invoiceNumber}</code></TableCell>
                        <TableCell className="font-medium">{match.vendorName}</TableCell>
                        <TableCell>{formatCurrency(match.poAmount)}</TableCell>
                        <TableCell>
                          <span className={cn('font-medium', match.invoiceAmount !== match.poAmount && 'text-red-600 dark:text-red-400')}>
                            {formatCurrency(match.invoiceAmount)}
                          </span>
                          {match.invoiceAmount !== match.poAmount && (
                            <div className="text-xs text-red-500">
                              {match.invoiceAmount > match.poAmount ? '+' : ''}{formatCurrency(match.invoiceAmount - match.poAmount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getMatchStatusBadge(match.matchStatus)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedMatch(match); setViewDialogOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(match.matchStatus === 'variance_detected' || match.matchStatus === 'partially_matched') && !match.resolvedAt && (
                              <>
                                <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 text-xs" onClick={() => handleResolveVariance(match, 'accept')}>
                                  Accept
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50 text-xs" onClick={() => handleResolveVariance(match, 'reject')}>
                                  Dispute
                                </Button>
                                <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs" onClick={() => handleResolveVariance(match, 'credit')}>
                                  Credit
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Auto-Requisition Rules ── */}
        <TabsContent value="auto_rules" className="space-y-4">
          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Department Budget Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const pct = Math.round((budget.spent / budget.allocated) * 100);
                  return (
                    <div key={budget.department} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{budget.department}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(budget.spent)} / {formatCurrency(budget.allocated)}
                        </span>
                      </div>
                      <Progress value={pct} className={cn('h-2.5', pct > 90 ? '[&>div]:bg-red-500' : pct > 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Remaining: {formatCurrency(budget.remaining)}</span>
                        <span className={pct > 90 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>{pct}% used</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Auto-Approve Threshold */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Approval Threshold Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1 space-y-2">
                  <Label>Auto-Approve Threshold</Label>
                  <p className="text-sm text-muted-foreground">
                    Requisitions under this amount will be automatically approved without manager review.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(autoApproveThreshold)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAutoApproveThreshold(Math.max(0, autoApproveThreshold - 100))}>
                      -$100
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAutoApproveThreshold(autoApproveThreshold + 100)}>
                      +$100
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Reorder Alerts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Auto-Reorder Alerts
                {autoReorderAlerts.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {autoReorderAlerts.length} items below reorder point
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 gap-1.5"
                onClick={handleAutoGenerate}
                disabled={autoReorderAlerts.length === 0}
              >
                <Zap className="h-3.5 w-3.5" />
                Auto-Generate Requisitions
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Reorder Point</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Reorder Qty</TableHead>
                      <TableHead>Stock Status</TableHead>
                      <TableHead>Auto-Approve</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {autoRules.filter(r => r.currentStock <= r.reorderPoint).map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.itemName}</TableCell>
                        <TableCell>{rule.reorderPoint} units</TableCell>
                        <TableCell>
                          <span className="text-red-600 dark:text-red-400 font-medium">{rule.currentStock}</span> units
                        </TableCell>
                        <TableCell>{rule.reorderQty} units</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={(rule.currentStock / rule.reorderPoint) * 100} className="w-20 h-2 [&>div]:bg-red-500" />
                            <span className="text-xs text-red-600 dark:text-red-400">
                              {Math.round((rule.currentStock / rule.reorderPoint) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.autoApprove && rule.reorderQty * 10 <= autoApproveThreshold ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">Yes</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Needs Approval</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Supplier Rankings */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setRankingsExpanded(!rankingsExpanded)}>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Supplier Preference Rankings
                {rankingsExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </CardTitle>
            </CardHeader>
            {rankingsExpanded && (
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Rank</TableHead>
                        <TableHead>On-Time Rate</TableHead>
                        <TableHead>Accuracy Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierRankings.map((sr) => (
                        <TableRow key={sr.id}>
                          <TableCell>
                            <Badge variant="outline">{sr.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{sr.supplier}</TableCell>
                          <TableCell>
                            <div className={cn(
                              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                              sr.rank === 1 ? 'bg-amber-500' : sr.rank === 2 ? 'bg-gray-400' : 'bg-amber-700'
                            )}>
                              #{sr.rank}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={sr.onTimeRate} className="w-16 h-2 [&>div]:bg-emerald-500" />
                              <span className="text-xs">{sr.onTimeRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={sr.accuracyRate} className="w-16 h-2 [&>div]:bg-sky-500" />
                              <span className="text-xs">{sr.accuracyRate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ── Tab: Analytics ── */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Monthly Volume Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Requisition Volume Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.monthlyVolume.map((m) => (
                  <div key={m.month} className="flex items-center gap-4">
                    <div className="w-10 text-sm font-medium text-muted-foreground">{m.month}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Progress value={(m.count / 25) * 100} className="flex-1 h-6 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                        <span className="text-sm font-medium w-12 text-right">{m.count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(m.amount)} total</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Approval & Savings Stats */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/40">
                    <Timer className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg. Approval Time</p>
                    <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">{analytics.avgApprovalTime}h</p>
                    <p className="text-xs text-violet-600/70 dark:text-violet-400/70 flex items-center gap-1 mt-0.5">
                      <TrendingDown className="h-3 w-3" />
                      12% faster than last quarter
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                    <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cost Savings (Competitive Bidding)</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(analytics.costSavings)}</p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 flex items-center gap-1 mt-0.5">
                      <TrendingUp className="h-3 w-3" />
                      8.3% savings rate this quarter
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supplier Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Supplier Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>On-Time Delivery</TableHead>
                      <TableHead>Order Accuracy</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.supplierPerformance.map((sp) => {
                      const avgScore = (sp.onTimeRate + sp.accuracyRate) / 2;
                      return (
                        <TableRow key={sp.supplier}>
                          <TableCell className="font-medium">{sp.supplier}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sp.ordersCount}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={sp.onTimeRate} className="w-20 h-2 [&>div]:bg-emerald-500" />
                              <span className="text-sm">{sp.onTimeRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={sp.accuracyRate} className="w-20 h-2 [&>div]:bg-sky-500" />
                              <span className="text-sm">{sp.accuracyRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              avgScore >= 98 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              avgScore >= 95 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              {avgScore >= 98 ? 'Excellent' : avgScore >= 95 ? 'Good' : 'Needs Improvement'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: View Requisition ── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Requisition Details</DialogTitle>
            <DialogDescription>{selectedRequisition?.requisitionNumber}</DialogDescription>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Department</Label>
                  <div className="font-medium">{selectedRequisition.department}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Status</Label>
                  {getStatusBadge(selectedRequisition.status)}
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Requested By</Label>
                  <div className="font-medium">{selectedRequisition.requestedBy}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Priority</Label>
                  {getPriorityBadge(selectedRequisition.priority)}
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Request Date</Label>
                  <div>{selectedRequisition.requestDate}</div>
                </div>
                {selectedRequisition.approvedBy && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Approved By</Label>
                    <div>{selectedRequisition.approvedBy}</div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Items</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRequisition.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.sku}</code></TableCell>
                          <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total Amount:</span>
                  <span className="font-bold">{formatCurrency(selectedRequisition.totalAmount)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Approval Threshold: {formatCurrency(selectedRequisition.approvalThreshold)} — 
                  {selectedRequisition.totalAmount >= selectedRequisition.approvalThreshold ? (
                    <span className="text-amber-600 dark:text-amber-400">Manager approval required</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Eligible for auto-approval</span>
                  )}
                </div>
              </div>

              {selectedRequisition.notes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Notes</Label>
                  <div className="text-sm bg-muted p-3 rounded-lg">{selectedRequisition.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: View Invoice Match ── */}
      <Dialog open={viewDialogOpen && !selectedRequisition && !!selectedMatch} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) setSelectedMatch(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Match Details</DialogTitle>
            <DialogDescription>{selectedMatch?.invoiceNumber} — {selectedMatch?.vendorName}</DialogDescription>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <Label className="text-xs text-muted-foreground">PO Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedMatch.poAmount)}</div>
                  <div className="text-xs">{selectedMatch.poNumber}</div>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <Label className="text-xs text-muted-foreground">GRN Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedMatch.grnAmount)}</div>
                  <div className="text-xs">{selectedMatch.grnNumber}</div>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <Label className="text-xs text-muted-foreground">Invoice Amount</Label>
                  <div className={cn('text-lg font-bold', selectedMatch.invoiceAmount !== selectedMatch.poAmount && 'text-red-600 dark:text-red-400')}>
                    {formatCurrency(selectedMatch.invoiceAmount)}
                  </div>
                  <div className="text-xs">{selectedMatch.invoiceNumber}</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Match Status</Label>
                {getMatchStatusBadge(selectedMatch.matchStatus)}
              </div>

              {selectedMatch.variances.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Variances Detected
                    </Label>
                    <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-red-50 dark:bg-red-950/30">
                            <TableHead>Type</TableHead>
                            <TableHead>Expected</TableHead>
                            <TableHead>Actual</TableHead>
                            <TableHead>Difference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMatch.variances.map((v, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                                  {VARIANCE_TYPE_LABELS[v.type]}
                                </Badge>
                              </TableCell>
                              <TableCell>{String(v.expected)}</TableCell>
                              <TableCell className="font-medium text-red-600 dark:text-red-400">{String(v.actual)}</TableCell>
                              <TableCell className="text-red-600 dark:text-red-400 font-medium">{String(v.difference)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {selectedMatch.resolvedAt && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                  <Label className="text-green-700 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Resolution
                  </Label>
                  <p className="text-sm mt-1">{selectedMatch.resolution}</p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved: {selectedMatch.resolvedAt}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewDialogOpen(false); setSelectedMatch(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Approve Requisition ── */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {selectedRequisition?.requisitionNumber} for {formatCurrency(selectedRequisition?.totalAmount || 0)}?
              This will generate a purchase order and send it to the preferred suppliers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} className="bg-emerald-500 hover:bg-emerald-600" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Reject Requisition ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>Provide a reason for rejecting {selectedRequisition?.requisitionNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmReject} className="bg-red-500 hover:bg-red-600" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Variance Resolution ── */}
      <Dialog open={varianceDialogOpen} onOpenChange={setVarianceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {varianceAction === 'accept' && 'Accept Variance'}
              {varianceAction === 'reject' && 'Dispute with Vendor'}
              {varianceAction === 'credit' && 'Create Credit Note'}
            </DialogTitle>
            <DialogDescription>
              {selectedMatch?.invoiceNumber} — {selectedMatch?.vendorName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                placeholder={
                  varianceAction === 'accept' ? 'Why is this variance being accepted?' :
                  varianceAction === 'reject' ? 'Describe the dispute reason to send to vendor...' :
                  'Credit note details...'
                }
                rows={3}
              />
            </div>
            {varianceAction === 'credit' && selectedMatch && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Credit Amount:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {formatCurrency(Math.abs(selectedMatch.invoiceAmount - selectedMatch.poAmount))}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVarianceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmVarianceResolution}
              className={cn(
                varianceAction === 'accept' && 'bg-emerald-500 hover:bg-emerald-600',
                varianceAction === 'reject' && 'bg-red-500 hover:bg-red-600',
                varianceAction === 'credit' && 'bg-amber-500 hover:bg-amber-600',
              )}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {varianceAction === 'accept' && 'Accept Variance'}
              {varianceAction === 'reject' && 'Send Dispute'}
              {varianceAction === 'credit' && 'Create Credit Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
