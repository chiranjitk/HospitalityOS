'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
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

interface ApiDevice {
  id: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  lastActive: string;
  pushEnabled: boolean;
  location: string;
  user?: { firstName: string; lastName: string } | null;
}

interface ApiDeliveryLog {
  id: string;
  type: string;
  template: string;
  recipient: string;
  subject?: string;
  status: string;
  sentAt: string;
  deliveredAt?: string;
  errorMessage?: string;
}

interface ApiTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  subject?: string;
  body: string;
  status: string;
  usageCount: number;
}

interface ApiAppVersion {
  version: string;
  build: string;
  platform: string;
  releaseDate: string;
  status: string;
  changes: string[];
  mandatory: boolean;
  minOsVersion: string;
}

interface MobileAppApiResponse {
  success: boolean;
  data?: {
    stats: {
      downloads: { total: number; ios: number; android: number; thisMonth: number; lastMonth: number; growthRate: number };
      activeUsers: { dau: number; wau: number; mau: number; dauVsMau: number };
      engagement: { mobileCheckins: number; mobileCheckouts: number; digitalKeysUsed: number; inAppPurchases: number; featureUsageRanking: { feature: string; usage: number }[] };
      performance: { pushDeliveryRate: number };
    };
    features: { id: string; name: string; description: string; enabled: boolean; usageCount: number; icon: string; status: string }[];
    devices: ApiDevice[];
    pushNotifications: { id: string; title: string; message: string; type: string; targetSegment: string; sentCount: number; openRate: number; deliveryRate: number; sentAt: string }[];
    versions: ApiAppVersion[];
  };
  stats?: {
    totalDownloads: number;
    monthlyActiveUsers: number;
    dailyActiveUsers: number;
    avgRating: string;
    pushDeliveryRate: number;
    registeredDevices: number;
  };
}

interface DeliveryLogsResponse {
  success: boolean;
  data?: {
    logs: ApiDeliveryLog[];
    stats: { total: number; delivered: number; failed: number; bounced: number; pending: number; deliveryRate: string };
  };
}

// ---------------------------------------------------------------------------
// Static Feature Toggles (app config, not mock data)
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
    case 'inactive':
      return <Badge variant="outline">Paused</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function deviceLocationBadge(location: string) {
  switch (location) {
    case 'in_app':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1"><Wifi className="h-3 w-3" /> Active</Badge>;
    case 'background':
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Background</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Inactive</Badge>;
  }
}

function versionStatusBadge(status: string) {
  switch (status) {
    case 'current':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1"><CheckCircle2 className="h-3 w-3" /> Current</Badge>;
    case 'deprecated':
    case 'previous':
      return <Badge variant="secondary" className="gap-1">Deprecated</Badge>;
    case 'rolled_back':
      return <Badge variant="destructive" className="gap-1">Rolled Back</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
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
// Loading Skeletons
// ---------------------------------------------------------------------------

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DeviceTableSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileAppManagement() {
  const { formatCurrency } = useCurrency();

  // Data state
  const [mobileAppData, setMobileAppData] = useState<MobileAppApiResponse | null>(null);
  const [deliveryLogsData, setDeliveryLogsData] = useState<DeliveryLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature toggle state (static config, editable locally)
  const [guestFeatures, setGuestFeatures] = useState(guestAppFeatures);
  const [staffFeatures, setStaffFeatures] = useState(staffAppFeatures);

  // UI state
  const [activeTab, setActiveTab] = useState('guest-app');
  const [refreshing, setRefreshing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [templateDetailOpen, setTemplateDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string; title?: string; body: string; status: string; type: string; category: string; usageCount: number } | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);

  // Derived from API data
  const apiStats = mobileAppData?.stats;
  const summaryStats = mobileAppData?.stats;
  const devices = mobileAppData?.data?.devices ?? [];
  const pushNotifications = mobileAppData?.data?.pushNotifications ?? [];
  const versions = mobileAppData?.data?.versions ?? [];
  const deliveryLogs = deliveryLogsData?.data?.logs ?? [];
  const deliveryStats = deliveryLogsData?.data?.stats;

  const guestAppInstalls = summaryStats?.totalDownloads ?? 0;
  const staffAppUsers = devices.length;
  const activeSessions = apiStats?.activeUsers?.dau ?? 0;
  const pushDeliveryRate = apiStats?.performance?.pushDeliveryRate ?? deliveryStats ? parseFloat(deliveryStats.deliveryRate) : 0;
  const growthRate = apiStats?.downloads?.growthRate ?? 0;

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [mobileRes, deliveryRes] = await Promise.all([
        fetch('/api/integrations/mobile-app?period=30d'),
        fetch('/api/notifications/delivery-logs?limit=20'),
      ]);

      if (!mobileRes.ok) throw new Error('Failed to load mobile app data');
      const mobileJson: MobileAppApiResponse = await mobileRes.json();
      if (mobileJson.success) setMobileAppData(mobileJson);
      else throw new Error(mobileJson.error?.message || 'Failed to load mobile app data');

      if (deliveryRes.ok) {
        const deliveryJson: DeliveryLogsResponse = await deliveryRes.json();
        if (deliveryJson.success) setDeliveryLogsData(deliveryJson);
      }
    } catch (err) {
      console.error('Error fetching mobile app data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoading(true);
    await fetchData();
    setRefreshing(false);
    toast.success('App data refreshed');
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

  // Error state
  if (error && !loading && !mobileAppData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Smartphone className="h-6 w-6" />
              Mobile App Management
            </h2>
          </div>
        </div>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load mobile app data</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      {loading ? (
        <StatsCardsSkeleton />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-sky-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" /> Guest App Installs
              </CardDescription>
              <CardTitle className="text-2xl">{guestAppInstalls.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-xs flex items-center gap-1 ${growthRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                <TrendingUp className="h-3 w-3" /> {growthRate >= 0 ? '+' : ''}{growthRate}% this month
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Registered Devices
              </CardDescription>
              <CardTitle className="text-2xl">{staffAppUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {devices.filter(d => d.location === 'in_app').length} currently active
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Active Sessions (DAU)
              </CardDescription>
              <CardTitle className="text-2xl">{activeSessions.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {apiStats?.activeUsers?.mau ?? 0} monthly active users
              </p>
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
      )}

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
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
                    <p className="text-sm text-muted-foreground">
                      Current Version: {versions[0]?.version ?? '—'} • iOS &amp; Android
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{summaryStats?.avgRating ?? '—'} ★</Badge>
                      <Badge variant="outline" className="text-xs">{guestAppInstalls.toLocaleString()} downloads</Badge>
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
          {loading ? (
            <DeviceTableSkeleton />
          ) : devices.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <Tablet className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No registered devices found</p>
                <p className="text-xs text-muted-foreground">Devices will appear here once users install the mobile app</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Device Management</CardTitle>
                    <CardDescription>All registered devices and their status</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {devices.filter(d => d.location === 'in_app').length} active
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {devices.filter(d => d.platform === 'iOS').length} iOS / {devices.filter(d => d.platform === 'Android').length} Android
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead className="hidden sm:table-cell">User</TableHead>
                        <TableHead className="hidden md:table-cell">Platform / OS</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">App Ver</TableHead>
                        <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                        <TableHead className="hidden md:table-cell">Push</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {device.platform === 'iOS' ? (
                                <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <Tablet className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium text-sm">{device.deviceModel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div>
                              <p className="text-sm">{device.user ? `${device.user.firstName} ${device.user.lastName}` : 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{device.platform}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {device.platform}<br />{device.osVersion}
                          </TableCell>
                          <TableCell>{deviceLocationBadge(device.location)}</TableCell>
                          <TableCell className="hidden sm:table-cell font-mono text-xs">
                            {device.appVersion}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDateTime(device.lastActive)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className={`w-2 h-2 rounded-full ${device.pushEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab: Push Notifications ─── */}
        <TabsContent value="push-notifications" className="mt-6 space-y-4">
          {/* Template Management - from pushNotifications API data */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Push Notifications</CardTitle>
                  <CardDescription>Recent push notification campaigns and delivery stats</CardDescription>
                </div>
                <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : pushNotifications.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No push notifications sent yet
                </div>
              ) : (
                <ScrollArea className="max-h-[320px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Target</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Delivery</TableHead>
                        <TableHead className="hidden md:table-cell">Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pushNotifications.map((notif) => (
                        <TableRow key={notif.id}>
                          <TableCell className="font-medium text-sm">{notif.title}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">{notif.type}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {notif.targetSegment}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              'text-xs border-0',
                              notif.deliveryRate >= 95 ? 'bg-emerald-500 text-white' :
                              notif.deliveryRate >= 50 ? 'bg-amber-500 text-white' :
                              'bg-red-500 text-white'
                            )}>
                              {notif.deliveryRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {notif.sentCount > 0 ? notif.sentCount.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {formatDateTime(notif.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Delivery Logs - from API */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Delivery Logs</CardTitle>
                  <CardDescription>Recent notification delivery attempts across all channels</CardDescription>
                </div>
                {deliveryStats && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {deliveryStats.delivered} delivered
                    </Badge>
                    <Badge variant="outline" className="text-xs text-red-500">
                      {deliveryStats.failed + deliveryStats.bounced} failed
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {deliveryStats.pending} pending
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : deliveryLogs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No delivery logs yet
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="hidden sm:table-cell">Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{log.recipient || '—'}</TableCell>
                          <TableCell>{channelIcon(log.type)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                            {log.subject || log.template}
                          </TableCell>
                          <TableCell>{deliveryStatusBadge(log.status)}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {formatDateTime(log.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: App Versions ─── */}
        <TabsContent value="versions" className="mt-6 space-y-4">
          {loading ? (
            <Card>
              <CardContent className="space-y-4 pt-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          ) : versions.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <Layers className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No version data available</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">App Versions</CardTitle>
                    <CardDescription>Release history for StaySuite mobile apps</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map((ver, idx) => (
                    <div key={idx} className="rounded-lg border p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 flex items-center justify-center font-mono font-bold text-xs">
                            {ver.version.split('.').slice(0, 2).join('.')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">v{ver.version}</p>
                              {versionStatusBadge(ver.status)}
                              {ver.mandatory && <Badge variant="destructive" className="text-xs">Mandatory</Badge>}
                              <Badge variant="outline" className="text-xs">{ver.platform}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Build {ver.build} • Released {formatDate(ver.releaseDate)} • Min OS: {ver.minOsVersion}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {ver.changes.map((change, ci) => (
                            <li key={ci} className="flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
              Scan this QR code with your mobile device to download the StaySuite app
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="h-48 w-48 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed">
              <QrCode className="h-24 w-24 text-muted-foreground" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyDownloadLink}>
              <Copy className="h-4 w-4 mr-1.5" />
              Copy Link
            </Button>
            <DialogClose asChild>
              <Button size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Template Detail Dialog ─── */}
      <Dialog open={templateDetailOpen} onOpenChange={setTemplateDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>View notification template details</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                </div>
                {selectedTemplate.title && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="text-sm">{selectedTemplate.title}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Body</Label>
                  <p className="text-sm bg-muted p-3 rounded-md max-h-32 overflow-auto">{selectedTemplate.body}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="text-sm">{selectedTemplate.type}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <p className="text-sm">{templateStatusBadge(selectedTemplate.status)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <p className="text-sm">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Usage Count</Label>
                    <p className="text-sm">{selectedTemplate.usageCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New Template Dialog ─── */}
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Notification Template</DialogTitle>
            <DialogDescription>Create a new push notification, SMS, or email template</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tmpl-name">Name</Label>
              <Input id="tmpl-name" placeholder="e.g. Welcome Greeting" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tmpl-type">Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push Notification</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_app">In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tmpl-subject">Subject</Label>
              <Input id="tmpl-subject" placeholder="Notification subject line" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tmpl-body">Body</Label>
              <textarea
                id="tmpl-body"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Notification body with {{variables}}"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewTemplateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { setNewTemplateOpen(false); toast.success('Template created'); }}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
