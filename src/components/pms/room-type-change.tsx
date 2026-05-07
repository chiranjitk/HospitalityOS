'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowRightLeft,
  BedDouble,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Search,
  Key,
  Luggage,
  Wine,
  Users,
  ShieldCheck,
  History,
  Loader2,
  FileText,
  Plus,
  ChevronRight,
  BadgeCheck,
  Star,
  MoveRight,
  XCircle,
  ThumbsUp,
  ClipboardCheck,
  RotateCcw,
  TrendingUp,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChangeStatus = 'requested' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'declined';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  icon: React.ElementType;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  baseRate: number;
  maxOccupancy: number;
  bedType: string;
  view: string;
  amenities: string[];
}

interface Room {
  id: string;
  number: string;
  typeId: string;
  floor: number;
  status: 'occupied' | 'vacant' | 'maintenance';
}

interface RoomChangeRequest {
  id: string;
  requestNumber: string;
  guestName: string;
  bookingNumber: string;
  currentRoom: Room;
  currentRoomType: RoomType;
  newRoomType: RoomType;
  selectedNewRoom?: Room;
  moveDate: string;
  moveTime: string;
  reason: string;
  rateDifferencePerNight: number;
  totalNightsAffected: number;
  totalRateImpact: number;
  changeType: 'upgrade' | 'downgrade' | 'lateral';
  requiresApproval: boolean;
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  status: ChangeStatus;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  notes?: string;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const STATUS_CONFIG: Record<ChangeStatus, { label: string; color: string; icon: React.ElementType }> = {
  requested: { label: 'Requested', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: FileText },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: ShieldCheck },
  approved: { label: 'Approved', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: BadgeCheck },
  in_progress: { label: 'In Progress', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

const CHANGE_TYPE_CONFIG = {
  upgrade: { label: 'Upgrade', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', icon: ArrowUpRight },
  downgrade: { label: 'Downgrade', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/20', icon: ArrowDownRight },
  lateral: { label: 'Lateral', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/20', icon: ArrowRightLeft },
};

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'key-reencode', label: 'Key card re-encoded for new room', completed: false, icon: Key },
  { id: 'luggage-transfer', label: 'Luggage transfer coordinated', completed: false, icon: Luggage },
  { id: 'minibar-restock', label: 'New room minibar restocked', completed: false, icon: Wine },
  { id: 'old-room-clean', label: 'Old room marked for cleaning', completed: false, icon: BedDouble },
  { id: 'new-room-inspected', label: 'New room inspected & ready', completed: false, icon: CheckCircle2 },
  { id: 'room-status-updated', label: 'Room status updated in PMS', completed: false, icon: Building2 },
  { id: 'guest-notified', label: 'Guest notified of move time', completed: false, icon: Users },
  { id: 'folio-updated', label: 'Folio updated with rate changes', completed: false, icon: DollarSign },
];

// ─── Room Types ──────────────────────────────────────────────────────────────

const ROOM_TYPES: RoomType[] = [
  { id: 'rt-01', name: 'Standard Room', code: 'STD', baseRate: 159, maxOccupancy: 2, bedType: 'Queen', view: 'City', amenities: ['WiFi', 'TV', 'AC', 'Mini Fridge'] },
  { id: 'rt-02', name: 'Deluxe Room', code: 'DLX', baseRate: 229, maxOccupancy: 2, bedType: 'King', view: 'City', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe'] },
  { id: 'rt-03', name: 'Deluxe Twin', code: 'DLT', baseRate: 239, maxOccupancy: 2, bedType: 'Twin', view: 'Garden', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe'] },
  { id: 'rt-04', name: 'Executive Room', code: 'EXC', baseRate: 289, maxOccupancy: 2, bedType: 'King', view: 'Park', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe', 'Lounge Access'] },
  { id: 'rt-05', name: 'Ocean View Room', code: 'OVR', baseRate: 329, maxOccupancy: 2, bedType: 'King', view: 'Ocean', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe', 'Balcony'] },
  { id: 'rt-06', name: 'Junior Suite', code: 'JST', baseRate: 449, maxOccupancy: 3, bedType: 'King + Sofa', view: 'Ocean', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe', 'Balcony', 'Living Area'] },
  { id: 'rt-07', name: 'Ocean View Suite', code: 'OVS', baseRate: 589, maxOccupancy: 3, bedType: 'King', view: 'Ocean', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe', 'Balcony', 'Living Area', 'Jacuzzi'] },
  { id: 'rt-08', name: 'Presidential Suite', code: 'PST', baseRate: 1200, maxOccupancy: 4, bedType: 'King + Guest', view: 'Panoramic', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Safe', 'Bathrobe', 'Balcony', 'Living Area', 'Jacuzzi', 'Butler Service'] },
];

const MOCK_ROOMS: Room[] = [
  { id: 'rm-101', number: '101', typeId: 'rt-01', floor: 1, status: 'occupied' },
  { id: 'rm-205', number: '205', typeId: 'rt-01', floor: 2, status: 'vacant' },
  { id: 'rm-302', number: '302', typeId: 'rt-02', floor: 3, status: 'occupied' },
  { id: 'rm-308', number: '308', typeId: 'rt-02', floor: 3, status: 'vacant' },
  { id: 'rm-401', number: '401', typeId: 'rt-03', floor: 4, status: 'occupied' },
  { id: 'rm-410', number: '410', typeId: 'rt-03', floor: 4, status: 'vacant' },
  { id: 'rm-501', number: '501', typeId: 'rt-04', floor: 5, status: 'occupied' },
  { id: 'rm-505', number: '505', typeId: 'rt-04', floor: 5, status: 'vacant' },
  { id: 'rm-601', number: '601', typeId: 'rt-05', floor: 6, status: 'occupied' },
  { id: 'rm-612', number: '612', typeId: 'rt-05', floor: 6, status: 'vacant' },
  { id: 'rm-701', number: '701', typeId: 'rt-06', floor: 7, status: 'occupied' },
  { id: 'rm-705', number: '705', typeId: 'rt-06', floor: 7, status: 'vacant' },
  { id: 'rm-801', number: '801', typeId: 'rt-07', floor: 8, status: 'occupied' },
  { id: 'rm-803', number: '803', typeId: 'rt-07', floor: 8, status: 'vacant' },
  { id: 'rm-901', number: '901', typeId: 'rt-08', floor: 9, status: 'occupied' },
];

// ─── Mock Change Requests ────────────────────────────────────────────────────

const MOCK_REQUESTS: RoomChangeRequest[] = [
  {
    id: 'rc-001', requestNumber: 'RC-2025-001',
    guestName: 'James & Sarah Mitchell', bookingNumber: 'BK-2025-1042',
    currentRoom: { id: 'rm-302', number: '302', typeId: 'rt-02', floor: 3, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-02')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-05')!,
    selectedNewRoom: { id: 'rm-612', number: '612', typeId: 'rt-05', floor: 6, status: 'vacant' },
    moveDate: '2025-09-17', moveTime: '10:00', reason: 'Guest requested ocean view for anniversary celebration',
    rateDifferencePerNight: 100, totalNightsAffected: 3, totalRateImpact: 300,
    changeType: 'upgrade', requiresApproval: true, approvalReason: 'Upgrade surcharge exceeds $200',
    approvedBy: 'Lisa Park', approvedAt: '2025-09-15T14:00:00Z',
    status: 'approved',
    checklist: DEFAULT_CHECKLIST.map((item, i) => ({ ...item, completed: i < 3 })),
    createdAt: '2025-09-14T09:30:00Z', updatedAt: '2025-09-16T16:00:00Z',
    notes: 'Guest confirmed move at 10 AM. Luggage team notified.',
  },
  {
    id: 'rc-002', requestNumber: 'RC-2025-002',
    guestName: 'Dr. Emily Watson', bookingNumber: 'BK-2025-1098',
    currentRoom: { id: 'rm-601', number: '601', typeId: 'rt-05', floor: 6, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-05')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-07')!,
    moveDate: '2025-08-26', moveTime: '14:00', reason: 'Noise complaint from adjacent rooms, guest wants quieter floor',
    rateDifferencePerNight: 260, totalNightsAffected: 2, totalRateImpact: 520,
    changeType: 'upgrade', requiresApproval: true, approvalReason: 'Complimentary upgrade due to noise complaint',
    approvedBy: 'Michael Torres', approvedAt: '2025-08-25T11:30:00Z',
    status: 'completed', completedAt: '2025-08-26T14:30:00Z',
    checklist: DEFAULT_CHECKLIST.map(item => ({ ...item, completed: true })),
    createdAt: '2025-08-25T10:00:00Z', updatedAt: '2025-08-26T14:30:00Z',
    notes: 'Complimentary upgrade approved by GM. Guest very satisfied.',
  },
  {
    id: 'rc-003', requestNumber: 'RC-2025-003',
    guestName: 'Hans Mueller', bookingNumber: 'BK-2025-1067',
    currentRoom: { id: 'rm-501', number: '501', typeId: 'rt-04', floor: 5, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-04')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-02')!,
    moveDate: '2025-08-19', moveTime: '12:00', reason: 'Guest requested lower room rate for extended stay',
    rateDifferencePerNight: -60, totalNightsAffected: 1, totalRateImpact: -60,
    changeType: 'downgrade', requiresApproval: false,
    status: 'pending_approval',
    checklist: DEFAULT_CHECKLIST.map(item => ({ ...item, completed: false })),
    createdAt: '2025-08-18T15:00:00Z', updatedAt: '2025-08-18T15:00:00Z',
  },
  {
    id: 'rc-004', requestNumber: 'RC-2025-004',
    guestName: 'Carlos & Maria Gonzalez', bookingNumber: 'BK-2025-1115',
    currentRoom: { id: 'rm-801', number: '801', typeId: 'rt-07', floor: 8, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-07')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-08')!,
    moveDate: '2025-10-03', moveTime: '11:00', reason: 'Guest celebrating 25th wedding anniversary, upgraded to Presidential',
    rateDifferencePerNight: 611, totalNightsAffected: 4, totalRateImpact: 2444,
    changeType: 'upgrade', requiresApproval: true, approvalReason: 'Significant rate increase requires GM approval',
    status: 'pending_approval',
    checklist: DEFAULT_CHECKLIST.map(item => ({ ...item, completed: false })),
    createdAt: '2025-10-01T08:00:00Z', updatedAt: '2025-10-01T08:00:00Z',
  },
  {
    id: 'rc-005', requestNumber: 'RC-2025-005',
    guestName: 'Sophie Laurent', bookingNumber: 'BK-2025-1087',
    currentRoom: { id: 'rm-401', number: '401', typeId: 'rt-03', floor: 4, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-03')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-03')!,
    selectedNewRoom: { id: 'rm-410', number: '410', typeId: 'rt-03', floor: 4, status: 'vacant' },
    moveDate: '2025-09-03', moveTime: '15:00', reason: 'Guest prefers room further from elevator for noise reduction',
    rateDifferencePerNight: 0, totalNightsAffected: 2, totalRateImpact: 0,
    changeType: 'lateral', requiresApproval: false,
    status: 'completed', completedAt: '2025-09-03T15:15:00Z',
    checklist: DEFAULT_CHECKLIST.map(item => ({ ...item, completed: true })),
    createdAt: '2025-09-02T10:00:00Z', updatedAt: '2025-09-03T15:15:00Z',
    notes: 'Same room type, same floor. Quick lateral move completed.',
  },
  {
    id: 'rc-006', requestNumber: 'RC-2025-006',
    guestName: 'Akira Tanaka', bookingNumber: 'BK-2025-1203',
    currentRoom: { id: 'rm-101', number: '101', typeId: 'rt-01', floor: 1, status: 'occupied' },
    currentRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-01')!,
    newRoomType: ROOM_TYPES.find(rt => rt.id === 'rt-04')!,
    moveDate: '2025-08-11', moveTime: '09:00', reason: 'Guest discovered accessibility needs require executive room configuration',
    rateDifferencePerNight: 130, totalNightsAffected: 1, totalRateImpact: 130,
    changeType: 'upgrade', requiresApproval: true, approvalReason: 'Accessibility accommodation — approve at current rate',
    approvedBy: 'Lisa Park', approvedAt: '2025-08-10T16:00:00Z',
    status: 'in_progress',
    checklist: [
      { id: 'key-reencode', label: 'Key card re-encoded for new room', completed: true, icon: Key },
      { id: 'luggage-transfer', label: 'Luggage transfer coordinated', completed: true, icon: Luggage },
      { id: 'minibar-restock', label: 'New room minibar restocked', completed: true, icon: Wine },
      { id: 'old-room-clean', label: 'Old room marked for cleaning', completed: false, icon: BedDouble },
      { id: 'new-room-inspected', label: 'New room inspected & ready', completed: true, icon: CheckCircle2 },
      { id: 'room-status-updated', label: 'Room status updated in PMS', completed: false, icon: Building2 },
      { id: 'guest-notified', label: 'Guest notified of move time', completed: true, icon: Users },
      { id: 'folio-updated', label: 'Folio updated with rate changes', completed: false, icon: DollarSign },
    ],
    createdAt: '2025-08-10T11:00:00Z', updatedAt: '2025-08-11T08:30:00Z',
    notes: 'Complimentary upgrade for accessibility. Guest moving to room 505.',
  },
];

const MOCK_HISTORY: HistoryEntry[] = [
  { id: 'h-001', timestamp: '2025-08-26T14:30:00Z', action: 'Room Change Completed', performedBy: 'Front Desk - Amy Chen', details: 'RC-2025-002: Dr. Watson moved from Room 601 to Room 803 (Ocean View Suite). Complimentary upgrade.' },
  { id: 'h-002', timestamp: '2025-08-26T14:00:00Z', action: 'Checklist Updated', performedBy: 'Housekeeping - Maria Lopez', details: 'RC-2025-002: All checklist items completed. Room 803 inspected and ready.' },
  { id: 'h-003', timestamp: '2025-08-25T11:30:00Z', action: 'Request Approved', performedBy: 'GM - Michael Torres', details: 'RC-2025-002: Approved complimentary upgrade due to noise complaint. Rate impact waived.' },
  { id: 'h-004', timestamp: '2025-08-25T10:00:00Z', action: 'Change Requested', performedBy: 'Front Desk - Amy Chen', details: 'RC-2025-002: Dr. Watson requested room change from 601 due to noise complaint.' },
  { id: 'h-005', timestamp: '2025-09-03T15:15:00Z', action: 'Lateral Move Completed', performedBy: 'Front Desk - John Davis', details: 'RC-2025-005: Sophie Laurent moved from Room 401 to Room 410. Same room type.' },
  { id: 'h-006', timestamp: '2025-09-15T14:00:00Z', action: 'Request Approved', performedBy: 'Duty Manager - Lisa Park', details: 'RC-2025-001: Upgrade approved for Mitchell anniversary. Surcharge $300 added to folio.' },
  { id: 'h-007', timestamp: '2025-08-11T08:30:00Z', action: 'Move In Progress', performedBy: 'Concierge - Tom Wilson', details: 'RC-2025-006: Akira Tanaka move in progress. Luggage transferred, key re-encoded.' },
  { id: 'h-008', timestamp: '2025-08-10T16:00:00Z', action: 'Request Approved', performedBy: 'Duty Manager - Lisa Park', details: 'RC-2025-006: Complimentary upgrade approved for accessibility needs.' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomTypeChange() {
  const [requests, setRequests] = useState<RoomChangeRequest[]>(MOCK_REQUESTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<RoomChangeRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'decline'>('approve');
  const [approvalNote, setApprovalNote] = useState('');
  const [activeTab, setActiveTab] = useState('requests');

  // ─── Filtering ────────────────────────────────────────────────────────
  const filteredRequests = requests.filter(r => {
    const matchSearch = r.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.currentRoom.number.includes(searchTerm) ||
      r.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.changeType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending_approval').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    upgrades: requests.filter(r => r.changeType === 'upgrade').length,
    totalRateImpact: requests.filter(r => r.status !== 'declined').reduce((sum, r) => sum + r.totalRateImpact, 0),
  }), [requests]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const handleApproval = () => {
    if (!selectedRequest) return;
    const newStatus: ChangeStatus = approvalAction === 'approve' ? 'approved' : 'declined';
    setRequests(prev => prev.map(r => {
      if (r.id === selectedRequest.id) {
        return {
          ...r,
          status: newStatus,
          approvedBy: approvalAction === 'approve' ? 'Current User' : undefined,
          approvedAt: approvalAction === 'approve' ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
          notes: approvalNote ? `${r.notes || ''}\n[${approvalAction === 'approve' ? 'APPROVED' : 'DECLINED'}] ${approvalNote}`.trim() : r.notes,
        };
      }
      return r;
    }));
    toast.success(approvalAction === 'approve' ? `Request ${selectedRequest.requestNumber} approved` : `Request ${selectedRequest.requestNumber} declined`);
    setIsApprovalDialogOpen(false);
    setSelectedRequest(null);
    setApprovalNote('');
  };

  const handleChecklistToggle = (requestId: string, checklistId: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          checklist: r.checklist.map(c => c.id === checklistId ? { ...c, completed: !c.completed } : c),
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    }));
  };

  const handleStartMove = (requestId: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        return { ...r, status: 'in_progress' as ChangeStatus, updatedAt: new Date().toISOString() };
      }
      return r;
    }));
    toast.success('Room move has been started');
  };

  const handleCompleteMove = (requestId: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        return { ...r, status: 'completed' as ChangeStatus, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), checklist: r.checklist.map(c => ({ ...c, completed: true })) };
      }
      return r;
    }));
    toast.success('Room move completed successfully');
  };

  const renderStatusBadge = (status: ChangeStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs font-medium gap-1', config.color)}>
        <Icon className={cn('h-3 w-3', status === 'in_progress' && 'animate-spin')} />
        {config.label}
      </Badge>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Room Type Changes
          </h2>
          <p className="text-muted-foreground">Manage during-stay room type changes and upgrades</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending Approval</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10">
              <Loader2 className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">In Progress</div>
              <div className="text-xl font-bold text-violet-600 dark:text-violet-400">{stats.inProgress}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Rate Impact Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">Rate Impact Summary</h3>
              <p className="text-xs text-muted-foreground">Total folio impact from all room changes</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total Rate Impact</div>
                <div className={cn('text-xl font-bold', stats.totalRateImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400')}>
                  {stats.totalRateImpact >= 0 ? '+' : ''}{formatCurrency(stats.totalRateImpact)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Upgrade Requests</div>
                <div className="text-xl font-bold">{stats.upgrades}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="requests">
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
              Change Requests
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1.5" />
              History Log
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-56"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="upgrade">Upgrade</SelectItem>
                <SelectItem value="downgrade">Downgrade</SelectItem>
                <SelectItem value="lateral">Lateral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Change Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead className="hidden sm:table-cell">Room Change</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Rate Impact</TableHead>
                      <TableHead>Move Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map(request => {
                      const ctConfig = CHANGE_TYPE_CONFIG[request.changeType];
                      const CtIcon = ctConfig.icon;
                      return (
                        <TableRow key={request.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-mono text-xs font-medium">{request.requestNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{request.guestName}</div>
                            <div className="text-xs text-muted-foreground">{request.bookingNumber}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{request.currentRoom.number}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">
                                {request.selectedNewRoom?.number || request.newRoomType.code}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {request.currentRoomType.name} → {request.newRoomType.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', ctConfig.color, ctConfig.bg)}>
                              <CtIcon className="h-3 w-3" />
                              {ctConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn('text-right hidden md:table-cell font-medium text-sm',
                            request.totalRateImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                            request.totalRateImpact < 0 ? 'text-orange-600 dark:text-orange-400' :
                            'text-muted-foreground'
                          )}>
                            {request.totalRateImpact > 0 ? '+' : ''}{formatCurrency(request.totalRateImpact)}
                          </TableCell>
                          <TableCell className="text-sm">{request.moveDate}</TableCell>
                          <TableCell>{renderStatusBadge(request.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedRequest(request); setIsDetailOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {request.status === 'pending_approval' && request.requiresApproval && (
                                <Button variant="ghost" size="sm" className="text-amber-600" onClick={() => { setSelectedRequest(request); setIsApprovalDialogOpen(true); setApprovalAction('approve'); }}>
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                              )}
                              {request.status === 'approved' && (
                                <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => handleStartMove(request.id)}>
                                  <MoveRight className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No change requests found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-4">
                  {MOCK_HISTORY.map(entry => (
                    <div key={entry.id} className="flex gap-3 items-start">
                      <div className="shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1 pb-4 border-l-2 border-muted pl-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-medium text-sm">{entry.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{entry.details}</p>
                        <p className="text-xs text-muted-foreground mt-1">by {entry.performedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Room Change Detail
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.requestNumber} — {selectedRequest?.guestName}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (() => {
            const req = selectedRequest;
            const ctConfig = CHANGE_TYPE_CONFIG[req.changeType];
            const CtIcon = ctConfig.icon;
            const completedChecklist = req.checklist.filter(c => c.completed).length;
            const totalChecklist = req.checklist.length;
            const checklistProgress = totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0;

            return (
              <div className="space-y-5 py-2">
                {/* Status & Change Type */}
                <div className="flex items-center justify-between">
                  {renderStatusBadge(req.status)}
                  <Badge variant="outline" className={cn('gap-1', ctConfig.color, ctConfig.bg)}>
                    <CtIcon className="h-3.5 w-3.5" />
                    {ctConfig.label}
                  </Badge>
                </div>

                {/* Room Change Visual */}
                <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                  <div className="rounded-lg border-2 border-muted p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Current Room</div>
                    <div className="text-3xl font-bold font-mono">{req.currentRoom.number}</div>
                    <div className="text-sm font-medium mt-1">{req.currentRoomType.name}</div>
                    <div className="text-xs text-muted-foreground">{req.currentRoomType.bedType} · {req.currentRoomType.view} · Floor {req.currentRoom.floor}</div>
                    <div className="text-sm font-medium mt-2">{formatCurrency(req.currentRoomType.baseRate)}<span className="text-xs text-muted-foreground">/night</span></div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
                      <MoveRight className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="rounded-lg border-2 border-primary/50 p-4 text-center bg-primary/5">
                    <div className="text-xs text-primary mb-1">New Room</div>
                    <div className="text-3xl font-bold font-mono text-primary">
                      {req.selectedNewRoom?.number || req.newRoomType.code}
                    </div>
                    <div className="text-sm font-medium mt-1">{req.newRoomType.name}</div>
                    <div className="text-xs text-muted-foreground">{req.newRoomType.bedType} · {req.newRoomType.view}</div>
                    <div className="text-sm font-medium mt-2">{formatCurrency(req.newRoomType.baseRate)}<span className="text-xs text-muted-foreground">/night</span></div>
                  </div>
                </div>

                {/* Rate Impact */}
                <div className={cn('rounded-lg p-4', ctConfig.bg)}>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className={cn('h-4 w-4', ctConfig.color)} />
                    <span className="font-semibold text-sm">Rate Impact</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Per Night</div>
                      <div className={cn('text-lg font-bold', ctConfig.color)}>
                        {req.rateDifferencePerNight > 0 ? '+' : ''}{formatCurrency(req.rateDifferencePerNight)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Nights</div>
                      <div className="text-lg font-bold">{req.totalNightsAffected}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Impact</div>
                      <div className={cn('text-lg font-bold', ctConfig.color)}>
                        {req.totalRateImpact > 0 ? '+' : ''}{formatCurrency(req.totalRateImpact)}
                      </div>
                    </div>
                  </div>
                  {req.requiresApproval && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Manager approval required: {req.approvalReason}
                      {req.approvedBy && (
                        <Badge variant="outline" className="text-[10px] ml-1">
                          Approved by {req.approvedBy}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Move Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Move Date</div>
                    <div className="font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {req.moveDate}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Move Time</div>
                    <div className="font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {req.moveTime}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Reason</div>
                  <div className="text-sm">{req.reason}</div>
                </div>

                {req.notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-line">{req.notes}</div>
                  </div>
                )}

                <Separator />

                {/* Move Logistics Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Move Logistics Checklist
                    </h4>
                    <span className="text-xs text-muted-foreground">{completedChecklist}/{totalChecklist}</span>
                  </div>
                  <Progress value={checklistProgress} className="h-2 mb-3" />
                  <div className="space-y-2">
                    {req.checklist.map(item => {
                      const ItemIcon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
                            item.completed && 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/50',
                            !item.completed && 'hover:bg-muted/50',
                          )}
                          onClick={() => (req.status === 'approved' || req.status === 'in_progress') && handleChecklistToggle(req.id, item.id)}
                        >
                          <Checkbox
                            checked={item.completed}
                            disabled={req.status !== 'approved' && req.status !== 'in_progress'}
                          />
                          <ItemIcon className={cn('h-4 w-4', item.completed ? 'text-emerald-600' : 'text-muted-foreground')} />
                          <span className={cn('text-sm flex-1', item.completed && 'line-through text-muted-foreground')}>
                            {item.label}
                          </span>
                          {item.completed && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Folio Impact */}
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4" />
                    Folio Impact Preview
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current room rate</span>
                      <span>{formatCurrency(req.currentRoomType.baseRate)}/night</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New room rate</span>
                      <span>{formatCurrency(req.newRoomType.baseRate)}/night</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Rate difference</span>
                      <span className={cn(ctConfig.color)}>
                        {req.rateDifferencePerNight > 0 ? '+' : ''}{formatCurrency(req.rateDifferencePerNight)}/night
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total ({req.totalNightsAffected} nights)</span>
                      <span className={cn(ctConfig.color)}>
                        {req.totalRateImpact > 0 ? '+' : ''}{formatCurrency(req.totalRateImpact)}
                      </span>
                    </div>
                    {req.totalRateImpact > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Est. tax & service</span>
                        <span>+{formatCurrency(req.totalRateImpact * 0.22)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
            {selectedRequest?.status === 'approved' && (
              <Button onClick={() => { handleStartMove(selectedRequest.id); setIsDetailOpen(false); }}>
                <MoveRight className="h-4 w-4 mr-2" />
                Start Move
              </Button>
            )}
            {selectedRequest?.status === 'in_progress' && (
              <Button onClick={() => { handleCompleteMove(selectedRequest.id); setIsDetailOpen(false); }}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Move
              </Button>
            )}
            {selectedRequest?.status === 'pending_approval' && selectedRequest.requiresApproval && (
              <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => { setIsDetailOpen(false); setIsApprovalDialogOpen(true); setApprovalAction('approve'); }}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Review & Approve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Decline'} Room Change
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.requestNumber} — {selectedRequest?.changeType === 'upgrade' ? 'Upgrade' : selectedRequest?.changeType === 'downgrade' ? 'Downgrade' : 'Lateral change'}
              {' '}from Room {selectedRequest?.currentRoom.number} to {selectedRequest?.selectedNewRoom?.number || selectedRequest?.newRoomType.code}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest</span>
                  <span className="font-medium">{selectedRequest.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate Impact</span>
                  <span className={cn('font-medium', selectedRequest.totalRateImpact > 0 ? 'text-emerald-600' : 'text-orange-600')}>
                    {selectedRequest.totalRateImpact > 0 ? '+' : ''}{formatCurrency(selectedRequest.totalRateImpact)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="font-medium text-right max-w-[200px]">{selectedRequest.reason}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={approvalAction === 'approve' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setApprovalAction('approve')}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  variant={approvalAction === 'decline' ? 'destructive' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setApprovalAction('decline')}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Decline
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Note {approvalAction === 'decline' && '(required)'}</Label>
                <Input
                  placeholder={approvalAction === 'approve' ? 'Approval notes (optional)' : 'Reason for declining'}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>Cancel</Button>
            <Button
              variant={approvalAction === 'decline' ? 'destructive' : 'default'}
              onClick={handleApproval}
              disabled={approvalAction === 'decline' && !approvalNote.trim()}
            >
              {approvalAction === 'approve' ? (
                <>
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Confirm Approval
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirm Decline
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
