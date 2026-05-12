'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Smartphone,
  Tablet,
  Users,
  Bell,
  BellRing,
  QrCode,
  Download,
  Settings,
  RefreshCw,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  MessageSquare,
  CalendarCheck,
  ShoppingBag,
  CreditCard,
  DoorOpen,
  ClipboardList,
  Radio,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
  Send,
  Eye,
  FileText,
  Tag,
  Layers,
  ChevronRight,
  SmartphoneNfc,
  Globe,
  Zap,
  TrendingUp,
  AlertTriangle,
  Copy,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

interface StaffDevice {
  id: string;
  deviceName: string;
  staffName: string;
  role: string;
  deviceModel: string;
  os: string;
  appVersion: string;
  status: 'active' | 'inactive' | 'suspended';
  lastActive: string;
  batteryLevel: number;
}

interface PushTemplate {
  id: string;
  name: string;
  category: 'booking' | 'promotional' | 'service' | 'transactional' | 'emergency';
  title: string;
  message: string;
  language: string;
  status: 'active' | 'draft' | 'paused';
  sentCount: number;
  openRate: number;
  lastSent: string;
}

interface PushDeliveryLog {
  id: string;
  recipient: string;
  templateName: string;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  status: 'delivered' | 'failed' | 'pending' | 'bounced';
  timestamp: string;
  deviceType: 'ios' | 'android' | 'web';
  openCount: number;
}

interface AppVersion {
  id: string;
  app: 'guest' | 'staff';
  version: string;
  buildNumber: number;
  platform: 'ios' | 'android' | 'both';
  releaseType: 'major' | 'minor' | 'patch';
  releaseDate: string;
  releaseNotes: string;
  downloads: number;
  activeUsers: number;
  status: 'current' | 'deprecated' | 'rolled_back';
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const guestAppFeatures: FeatureToggle[] = [
  { id: 'gf-digital-key', name: 'Digital Key', description: 'Unlock room door with smartphone BLE/NFC', enabled: true, icon: <DoorOpen className="h-4 w-4" /> },
  { id: 'gf-chat', name: 'Guest Chat', description: 'Real-time messaging with front desk and concierge', enabled: true, icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'gf-booking', name: 'Room Booking', description: 'Book rooms, view availability, manage reservations', enabled: true, icon: <CalendarCheck className="h-4 w-4" /> },
  { id: 'gf-in-room', name: 'In-Room Services', description: 'Order room service, housekeeping, spa, and amenities', enabled: true, icon: <ShoppingBag className="h-4 w-4" /> },
  { id: 'gf-checkout', name: 'Express Checkout', description: 'Review folio, settle bills, and checkout from the app', enabled: false, icon: <CreditCard className="h-4 w-4" /> },
  { id: 'gf-feedback', name: 'Feedback & Reviews', description: 'Submit satisfaction surveys and write reviews', enabled: true, icon: <Tag className="h-4 w-4" /> },
  { id: 'gf-loyalty', name: 'Loyalty Program', description: 'View points, redeem rewards, and track tier progress', enabled: true, icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'gf-digital-ids', name: 'Digital IDs', description: 'Store and present KYC/ID documents digitally', enabled: false, icon: <FileText className="h-4 w-4" /> },
];

const staffAppFeatures: FeatureToggle[] = [
  { id: 'sf-tasks', name: 'Task Management', description: 'View and manage housekeeping, maintenance, and service tasks', enabled: true, icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'sf-room-status', name: 'Room Status', description: 'Update room cleanliness and maintenance status in real time', enabled: true, icon: <Layers className="h-4 w-4" /> },
  { id: 'sf-messaging', name: 'Staff Messaging', description: 'Internal communication between departments and team members', enabled: true, icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'sf-attendance', name: 'Attendance', description: 'Clock in/out, view shift schedules, and request time off', enabled: true, icon: <UserCheck className="h-4 w-4" /> },
  { id: 'sf-notifications', name: 'Alert Notifications', description: 'Receive real-time alerts for emergencies and urgent tasks', enabled: true, icon: <BellRing className="h-4 w-4" /> },
  { id: 'sf-handover', name: 'Shift Handover', description: 'Document and review shift handover notes and pending items', enabled: false, icon: <FileText className="h-4 w-4" /> },
];

const staffDevices: StaffDevice[] = [
  { id: 'sd-1', deviceName: 'Front Desk iPad Pro', staffName: 'Priya Sharma', role: 'Front Desk Agent', deviceModel: 'iPad Pro 12.9"', os: 'iPadOS 18.5', appVersion: 'V2.4.1', status: 'active', lastActive: '2026-06-14T08:30:00Z', batteryLevel: 82 },
  { id: 'sd-2', deviceName: 'Housekeeping iPhone', staffName: 'Ramesh Kumar', role: 'Housekeeping Supervisor', deviceModel: 'iPhone 15', os: 'iOS 18.5', appVersion: 'V2.4.1', status: 'active', lastActive: '2026-06-14T08:25:00Z', batteryLevel: 45 },
  { id: 'sd-3', deviceName: 'Maintenance Tab', staffName: 'Suresh Patel', role: 'Maintenance Tech', deviceModel: 'Samsung Galaxy Tab S9', os: 'Android 15', appVersion: 'V2.4.0', status: 'active', lastActive: '2026-06-14T08:20:00Z', batteryLevel: 67 },
  { id: 'sd-4', deviceName: 'Concierge Phone', staffName: 'Anita Desai', role: 'Concierge Manager', deviceModel: 'iPhone 14 Pro', os: 'iOS 18.5', appVersion: 'V2.4.1', status: 'active', lastActive: '2026-06-14T08:28:00Z', batteryLevel: 91 },
  { id: 'sd-5', deviceName: 'Security Radio Tab', staffName: 'Vikram Singh', role: 'Security Officer', deviceModel: 'Samsung Galaxy Tab A9', os: 'Android 14', appVersion: 'V2.3.8', status: 'suspended', lastActive: '2026-06-13T22:00:00Z', batteryLevel: 12 },
  { id: 'sd-6', deviceName: 'Spa Booking iPad', staffName: 'Meera Joshi', role: 'Spa Receptionist', deviceModel: 'iPad Air 5th Gen', os: 'iPadOS 18.5', appVersion: 'V2.4.1', status: 'active', lastActive: '2026-06-14T08:15:00Z', batteryLevel: 73 },
  { id: 'sd-7', deviceName: 'F&B Manager Phone', staffName: 'Arjun Nair', role: 'F&B Manager', deviceModel: 'iPhone 15 Pro', os: 'iOS 18.5', appVersion: 'V2.4.1', status: 'inactive', lastActive: '2026-06-12T17:00:00Z', batteryLevel: 0 },
];

const pushTemplates: PushTemplate[] = [
  { id: 'pt-1', name: 'Welcome Greeting', category: 'booking', title: 'Welcome to {{property_name}}!', message: 'Hello {{guest_name}}, we\'re delighted to have you. Your room {{room_number}} is ready. Enjoy your stay!', language: 'en', status: 'active', sentCount: 1247, openRate: 78.3, lastSent: '2026-06-14T07:00:00Z' },
  { id: 'pt-2', name: 'Pre-Arrival Reminder', category: 'booking', title: 'Your stay starts tomorrow!', message: 'Hi {{guest_name}}, your check-in at {{property_name}} is tomorrow. Complete express check-in now to skip the queue.', language: 'en', status: 'active', sentCount: 892, openRate: 65.1, lastSent: '2026-06-13T10:00:00Z' },
  { id: 'pt-3', name: 'Weekend Spa Offer', category: 'promotional', title: 'Relax & Rejuvenate 💆', message: 'Exclusive 25% off spa treatments this weekend! Book now through the app and treat yourself.', language: 'en', status: 'active', sentCount: 3420, openRate: 42.7, lastSent: '2026-06-14T06:00:00Z' },
  { id: 'pt-4', name: 'Room Ready', category: 'service', title: 'Your room is ready!', message: 'Your room {{room_number}} has been cleaned and inspected. Head to your room or enjoy our lobby amenities.', language: 'en', status: 'active', sentCount: 1056, openRate: 72.8, lastSent: '2026-06-14T08:00:00Z' },
  { id: 'pt-5', name: 'Folio Receipt', category: 'transactional', title: 'Payment Confirmation', message: 'Your payment of {{amount}} has been processed. Receipt available in your digital folio.', language: 'en', status: 'active', sentCount: 678, openRate: 81.2, lastSent: '2026-06-14T08:30:00Z' },
  { id: 'pt-6', name: 'Checkout Reminder', category: 'booking', title: 'Time to say goodbye?', message: 'Your checkout is at {{checkout_time}}. Need a late checkout? Request it with one tap.', language: 'en', status: 'draft', sentCount: 0, openRate: 0, lastSent: '' },
  { id: 'pt-7', name: 'Emergency Alert', category: 'emergency', title: '⚠️ Important Safety Notice', message: '{{message}}. Please follow staff instructions immediately.', language: 'en', status: 'active', sentCount: 2, openRate: 100, lastSent: '2026-06-10T03:00:00Z' },
  { id: 'pt-8', name: 'Welcome (Hindi)', category: 'booking', title: '{{property_name}} में आपका स्वागत है!', message: 'नमस्ते {{guest_name}}, आपका कमरा {{room_number}} तैयार है। अपने प्रवास का आनंद लें!', language: 'hi', status: 'active', sentCount: 234, openRate: 71.5, lastSent: '2026-06-14T07:00:00Z' },
];

const deliveryLogs: PushDeliveryLog[] = [
  { id: 'dl-1', recipient: 'James Anderson', templateName: 'Welcome Greeting', channel: 'push', status: 'delivered', timestamp: '2026-06-14T08:30:00Z', deviceType: 'ios', openCount: 1 },
  { id: 'dl-2', recipient: 'Maria Chen', templateName: 'Room Ready', channel: 'push', status: 'delivered', timestamp: '2026-06-14T08:00:00Z', deviceType: 'android', openCount: 1 },
  { id: 'dl-3', recipient: 'Tom Williams', templateName: 'Weekend Spa Offer', channel: 'push', status: 'delivered', timestamp: '2026-06-14T06:00:00Z', deviceType: 'ios', openCount: 0 },
  { id: 'dl-4', recipient: 'Emily Brown', templateName: 'Folio Receipt', channel: 'email', status: 'delivered', timestamp: '2026-06-14T08:30:00Z', deviceType: 'web', openCount: 1 },
  { id: 'dl-5', recipient: 'Ahmed Hassan', templateName: 'Pre-Arrival Reminder', channel: 'sms', status: 'failed', timestamp: '2026-06-14T08:15:00Z', deviceType: 'android', openCount: 0 },
  { id: 'dl-6', recipient: 'Lisa Nakamura', templateName: 'Welcome Greeting', channel: 'push', status: 'bounced', timestamp: '2026-06-14T07:45:00Z', deviceType: 'ios', openCount: 0 },
  { id: 'dl-7', recipient: 'Sarah Johnson', templateName: 'Room Ready', channel: 'in_app', status: 'delivered', timestamp: '2026-06-14T08:10:00Z', deviceType: 'android', openCount: 1 },
  { id: 'dl-8', recipient: 'Priya Patel', templateName: 'Weekend Spa Offer', channel: 'push', status: 'pending', timestamp: '2026-06-14T08:32:00Z', deviceType: 'ios', openCount: 0 },
  { id: 'dl-9', recipient: 'David Kumar', templateName: 'Folio Receipt', channel: 'email', status: 'delivered', timestamp: '2026-06-14T08:25:00Z', deviceType: 'web', openCount: 0 },
  { id: 'dl-10', recipient: 'Robert Müller', templateName: 'Welcome Greeting', channel: 'push', status: 'delivered', timestamp: '2026-06-14T07:30:00Z', deviceType: 'android', openCount: 1 },
];

const appVersions: AppVersion[] = [
  { id: 'av-1', app: 'guest', version: '3.2.0', buildNumber: 842, platform: 'both', releaseType: 'major', releaseDate: '2026-06-01T00:00:00Z', releaseNotes: 'Major redesign with digital key BLE 5.0 support, in-room ordering, and loyalty program integration. Added Hindi and Marathi languages.', downloads: 12840, activeUsers: 8421, status: 'current' },
  { id: 'av-2', app: 'guest', version: '3.1.2', buildNumber: 810, platform: 'both', releaseType: 'patch', releaseDate: '2026-05-10T00:00:00Z', releaseNotes: 'Fixed push notification delivery on Android 15, improved offline mode reliability, and resolved check-in flow crash.', downloads: 14500, activeUsers: 120, status: 'deprecated' },
  { id: 'av-3', app: 'guest', version: '3.1.0', buildNumber: 795, platform: 'both', releaseType: 'minor', releaseDate: '2026-04-15T00:00:00Z', releaseNotes: 'Added express checkout, guest feedback surveys, and dark mode support for Android.', downloads: 15200, activeUsers: 45, status: 'deprecated' },
  { id: 'av-4', app: 'staff', version: '2.4.1', buildNumber: 523, platform: 'both', releaseType: 'patch', releaseDate: '2026-06-08T00:00:00Z', releaseNotes: 'Fixed task assignment notifications, improved room status sync speed, and resolved attendance clock-in issue.', downloads: 2100, activeUsers: 156, status: 'current' },
  { id: 'av-5', app: 'staff', version: '2.4.0', buildNumber: 510, platform: 'both', releaseType: 'minor', releaseDate: '2026-05-20T00:00:00Z', releaseNotes: 'Added shift handover notes, improved messaging with read receipts, and new room inspection checklist.', downloads: 1980, activeUsers: 12, status: 'deprecated' },
  { id: 'av-6', app: 'staff', version: '2.3.8', buildNumber: 492, platform: 'android', releaseType: 'patch', releaseDate: '2026-04-28T00:00:00Z', releaseNotes: 'Hotfix for Samsung Galaxy Tab S9 compatibility and Android 14 notification channels.', downloads: 1850, activeUsers: 5, status: 'deprecated' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function deliveryStatusBadge(status: string) {
  switch (status) {
    case 'delivered':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1"><CheckCircle2 className="h-3 w-3" /> Delivered</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Pending</Badge>;
    case 'bounced':
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Bounced</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function templateCategoryBadge(category: string) {
  switch (category) {
    case 'booking':
      return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0 text-xs">Booking</Badge>;
    case 'promotional':
      return <Badge className="bg-violet-500 hover:bg-violet-600 text-white border-0 text-xs">Promotional</Badge>;
    case 'service':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">Service</Badge>;
    case 'transactional':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">Transactional</Badge>;
    case 'emergency':
      return <Badge variant="destructive" className="text-xs">Emergency</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{category}</Badge>;
  }
}

function templateStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">Active</Badge>;
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>;
    case 'paused':
      return <Badge variant="outline">Paused</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function deviceStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1"><Wifi className="h-3 w-3" /> Active</Badge>;
    case 'inactive':
      return <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Inactive</Badge>;
    case 'suspended':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function versionStatusBadge(status: string) {
  switch (status) {
    case 'current':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1"><CheckCircle2 className="h-3 w-3" /> Current</Badge>;
    case 'deprecated':
      return <Badge variant="secondary" className="gap-1">Deprecated</Badge>;
    case 'rolled_back':
      return <Badge variant="destructive" className="gap-1">Rolled Back</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function releaseTypeBadge(type: string) {
  switch (type) {
    case 'major':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">Major</Badge>;
    case 'minor':
      return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0 text-xs">Minor</Badge>;
    case 'patch':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0 text-xs">Patch</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{type}</Badge>;
  }
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'push': return <Bell className="h-3.5 w-3.5 text-violet-500" />;
    case 'sms': return <Smartphone className="h-3.5 w-3.5 text-sky-500" />;
    case 'email': return <Globe className="h-3.5 w-3.5 text-emerald-500" />;
    case 'in_app': return <Eye className="h-3.5 w-3.5 text-amber-500" />;
    default: return <Bell className="h-3.5 w-3.5" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileAppManagement() {
  const { formatCurrency } = useCurrency();

  // Stats
  const guestAppInstalls = 8421;
  const staffAppUsers = 156;
  const activeSessions = 890;
  const pushDeliveryRate = 94.7;

  // State
  const [activeTab, setActiveTab] = useState('guest-app');
  const [refreshing, setRefreshing] = useState(false);
  const [guestFeatures, setGuestFeatures] = useState(guestAppFeatures);
  const [staffFeatures, setStaffFeatures] = useState(staffAppFeatures);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [templateDetailOpen, setTemplateDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PushTemplate | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('App data refreshed');
    }, 1200);
  };

  const toggleGuestFeature = (id: string) => {
    setGuestFeatures(prev =>
      prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    );
    const feature = guestFeatures.find(f => f.id === id);
    toast.success(
      `${feature?.name} ${feature?.enabled ? 'disabled' : 'enabled'} for Guest App`
    );
  };

  const toggleStaffFeature = (id: string) => {
    setStaffFeatures(prev =>
      prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    );
    const feature = staffFeatures.find(f => f.id === id);
    toast.success(
      `${feature?.name} ${feature?.enabled ? 'disabled' : 'enabled'} for Staff App`
    );
  };

  const handleCopyDownloadLink = () => {
    toast.success('Download link copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            Mobile App Management
          </h2>
          <p className="text-muted-foreground">
            Configure Guest and Staff apps, manage push notifications, and track app versions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setQrDialogOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" />
            Download QR
          </Button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Smartphone className="h-4 w-4" /> Guest App Installs
            </CardDescription>
            <CardTitle className="text-2xl">{guestAppInstalls.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12.3% this month
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Staff App Users
            </CardDescription>
            <CardTitle className="text-2xl">{staffAppUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {staffDevices.filter(d => d.status === 'active').length} devices active
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Active Sessions
            </CardDescription>
            <CardTitle className="text-2xl">{activeSessions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Real-time across both apps</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Bell className="h-4 w-4" /> Push Delivery Rate
            </CardDescription>
            <CardTitle className="text-2xl">{pushDeliveryRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={pushDeliveryRate} className="h-2 mt-1 [&>div]:bg-amber-500" />
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="guest-app" className="gap-1.5">
            <Smartphone className="h-4 w-4 hidden sm:block" />
            Guest App
          </TabsTrigger>
          <TabsTrigger value="staff-app" className="gap-1.5">
            <Tablet className="h-4 w-4 hidden sm:block" />
            Staff App
          </TabsTrigger>
          <TabsTrigger value="push-notifications" className="gap-1.5">
            <BellRing className="h-4 w-4 hidden sm:block" />
            Push Notifications
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <Layers className="h-4 w-4 hidden sm:block" />
            App Versions
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Guest App ─── */}
        <TabsContent value="guest-app" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Guest App Feature Toggles</CardTitle>
                  <CardDescription>Enable or disable features available to hotel guests</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {guestFeatures.filter(f => f.enabled).length}/{guestFeatures.length} enabled
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {guestFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                      feature.enabled
                        ? 'bg-background'
                        : 'bg-muted/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        feature.enabled
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {feature.icon}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{feature.name}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {feature.enabled ? (
                        <Badge className="bg-emerald-500 text-white border-0 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> On
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <XCircle className="h-3 w-3" /> Off
                        </Badge>
                      )}
                      <Switch
                        checked={feature.enabled}
                        onCheckedChange={() => toggleGuestFeature(feature.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Download Section */}
          <Card className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 border-sky-200 dark:border-sky-800">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shrink-0">
                    <Smartphone className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">StaySuite Guest App</h4>
                    <p className="text-sm text-muted-foreground">Current Version: 3.2.0 • iOS &amp; Android</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">4.8 ★</Badge>
                      <Badge variant="outline" className="text-xs">12.8K downloads</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyDownloadLink}>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy Link
                  </Button>
                  <Button size="sm" onClick={() => setQrDialogOpen(true)}>
                    <QrCode className="h-4 w-4 mr-1.5" />
                    Show QR
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Staff App ─── */}
        <TabsContent value="staff-app" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Staff App Feature Toggles</CardTitle>
                  <CardDescription>Control which features are available to hotel staff members</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {staffFeatures.filter(f => f.enabled).length}/{staffFeatures.length} enabled
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {staffFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                      feature.enabled
                        ? 'bg-background'
                        : 'bg-muted/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        feature.enabled
                          ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {feature.icon}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{feature.name}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {feature.enabled ? (
                        <Badge className="bg-emerald-500 text-white border-0 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> On
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <XCircle className="h-3 w-3" /> Off
                        </Badge>
                      )}
                      <Switch
                        checked={feature.enabled}
                        onCheckedChange={() => toggleStaffFeature(feature.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Device Management */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Device Management</CardTitle>
                  <CardDescription>All registered staff devices and their status</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {staffDevices.filter(d => d.status === 'active').length} active
                  </Badge>
                  <Badge variant="outline" className="text-xs text-amber-500">
                    {staffDevices.filter(d => d.status === 'suspended').length} suspended
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead className="hidden sm:table-cell">Staff</TableHead>
                      <TableHead className="hidden md:table-cell">Model / OS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">App Ver</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                      <TableHead className="hidden md:table-cell">Battery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tablet className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{device.deviceName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div>
                            <p className="text-sm">{device.staffName}</p>
                            <p className="text-xs text-muted-foreground">{device.role}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {device.deviceModel}<br />{device.os}
                        </TableCell>
                        <TableCell>{deviceStatusBadge(device.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell font-mono text-xs">
                          {device.appVersion}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDateTime(device.lastActive)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${
                              device.batteryLevel > 60 ? 'bg-emerald-500' :
                              device.batteryLevel > 25 ? 'bg-amber-500' :
                              device.batteryLevel > 0 ? 'bg-red-500' : 'bg-gray-300'
                            }`} />
                            <span className="text-xs">{device.batteryLevel}%</span>
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

        {/* ─── Tab: Push Notifications ─── */}
        <TabsContent value="push-notifications" className="mt-6 space-y-4">
          {/* Template Management */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Notification Templates</CardTitle>
                  <CardDescription>Manage push notification, SMS, and email templates</CardDescription>
                </div>
                <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Sent</TableHead>
                      <TableHead className="hidden md:table-cell">Open Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pushTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium text-sm">{template.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {templateCategoryBadge(template.category)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                          {template.title}
                        </TableCell>
                        <TableCell>{templateStatusBadge(template.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {template.sentCount > 0 ? template.sentCount.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {template.openRate > 0 ? `${template.openRate}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setTemplateDetailOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Delivery Logs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Delivery Logs</CardTitle>
                  <CardDescription>Recent notification delivery attempts across all channels</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {deliveryLogs.filter(d => d.status === 'delivered').length} delivered
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-500">
                    {deliveryLogs.filter(d => d.status === 'failed' || d.status === 'bounced').length} failed
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="hidden sm:table-cell">Template</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Device</TableHead>
                      <TableHead className="hidden lg:table-cell">Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryLogs.map((log) => (
                      <TableRow key={log.id} className={
                        log.status === 'failed' || log.status === 'bounced'
                          ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                      }>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{log.recipient}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {log.templateName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {channelIcon(log.channel)}
                            <span className="text-sm capitalize">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>{deliveryStatusBadge(log.status)}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs capitalize text-muted-foreground">
                          {log.deviceType}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {log.openCount > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                              <Eye className="h-3 w-3 mr-1" /> Opened
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not opened</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: App Versions ─── */}
        <TabsContent value="versions" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Version History</CardTitle>
                  <CardDescription>All app releases with download stats and release notes</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {appVersions.filter(v => v.app === 'guest').length} guest
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {appVersions.filter(v => v.app === 'staff').length} staff
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead className="hidden sm:table-cell">App</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Platform</TableHead>
                      <TableHead className="hidden md:table-cell">Downloads</TableHead>
                      <TableHead className="hidden lg:table-cell">Active Users</TableHead>
                      <TableHead className="hidden lg:table-cell">Released</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appVersions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">{version.version}</p>
                              <p className="text-xs text-muted-foreground font-mono">Build {version.buildNumber}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {version.app === 'guest' ? (
                              <><Smartphone className="h-3 w-3 mr-1" /> Guest</>
                            ) : (
                              <><Users className="h-3 w-3 mr-1" /> Staff</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {releaseTypeBadge(version.releaseType)}
                        </TableCell>
                        <TableCell>{versionStatusBadge(version.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs capitalize text-muted-foreground">
                          {version.platform}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {version.downloads.toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <span className={version.activeUsers > 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                            {version.activeUsers}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDate(version.releaseDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── QR Code Dialog ─── */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              App Download QR Code
            </DialogTitle>
            <DialogDescription>
              Guests can scan this QR code to download the StaySuite Guest App
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            {/* Simulated QR code placeholder */}
            <div className="w-48 h-48 rounded-xl bg-white border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2">
              <QrCode className="h-20 w-20 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">QR Code</p>
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-sm">StaySuite Guest App</p>
              <p className="text-xs text-muted-foreground">iOS &amp; Android • Auto-detects platform</p>
            </div>
            <div className="w-full rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Download URL</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono flex-1 truncate">
                  https://staysuite.app/download/rso-1
                </code>
                <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={handleCopyDownloadLink}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Close</Button>
            <Button onClick={handleCopyDownloadLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Template Detail Dialog ─── */}
      <Dialog open={templateDetailOpen} onOpenChange={setTemplateDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Template preview and statistics
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <div className="mt-1">{templateCategoryBadge(selectedTemplate.category)}</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{templateStatusBadge(selectedTemplate.status)}</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                  <p className="font-semibold">{selectedTemplate.sentCount.toLocaleString()}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                  <p className="font-semibold">{selectedTemplate.openRate > 0 ? `${selectedTemplate.openRate}%` : 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <div className="rounded-md border p-3 bg-muted/50">
                  <p className="text-sm font-medium">{selectedTemplate.title}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <div className="rounded-md border p-3 bg-muted/50">
                  <p className="text-sm">{selectedTemplate.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Language: {selectedTemplate.language.toUpperCase()}</span>
                {selectedTemplate.lastSent && (
                  <>
                    <span>•</span>
                    <span>Last sent: {formatDateTime(selectedTemplate.lastSent)}</span>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDetailOpen(false)}>Close</Button>
            <Button onClick={() => {
              setTemplateDetailOpen(false);
              toast.success('Test notification sent to your device');
            }}>
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New Template Dialog ─── */}
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Notification Template
            </DialogTitle>
            <DialogDescription>
              Design a new push notification, SMS, or email template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Template Name</Label>
                <Input id="tpl-name" placeholder="e.g. Check-in Reminder" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Notification Title</Label>
              <Input id="tpl-title" placeholder="e.g. Your room is ready!" />
              <p className="text-xs text-muted-foreground">Use {{guest_name}}, {{room_number}}, {{property_name}} for dynamic values</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-message">Message Body</Label>
              <textarea
                id="tpl-message"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Write your notification message here..."
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select defaultValue="en">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="mr">Marathi</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => {
              setNewTemplateOpen(false);
              toast.success('Template saved as draft');
            }}>
              Save as Draft
            </Button>
            <Button onClick={() => {
              setNewTemplateOpen(false);
              toast.success('Notification template created and activated');
            }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Create &amp; Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Info Banner ─── */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">Mobile App Best Practices</h4>
              <p className="text-sm text-muted-foreground">
                Feature toggles take effect immediately for all users. Major changes should be communicated
                via push notification first. Staff devices should be updated to the latest version within 48 hours
                of a release. Emergency notification templates are exempt from the A/B testing queue and are
                sent immediately to all devices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
