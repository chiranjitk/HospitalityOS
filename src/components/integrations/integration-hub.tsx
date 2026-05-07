'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import {
  Plug,
  RefreshCw,
  Settings,
  Link2,
  Unlink,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  HeartPulse,
  Key,
  Shield,
  Webhook,
  RotateCw,
  Plus,
  Trash2,
  XCircle,
  Wifi,
  WifiOff,
  Zap,
  CreditCard,
  Globe,
  Mail,
  MessageSquare,
  Lock,
  BarChart3,
  Users,
  Home,
  Sparkles,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'configuring';
  lastSync: string;
  syncInterval: string;
  recordsSynced: number;
  uptime: number;
  avgLatency: number;
  errorRate: number;
  logoColor: string;
  icon: React.ReactNode;
}

interface SyncLogEntry {
  id: string;
  integrationId: string;
  integrationName: string;
  type: 'push' | 'pull' | 'error';
  direction: 'outgoing' | 'incoming';
  records: number;
  status: 'success' | 'failed' | 'retrying';
  timestamp: string;
  duration: string;
  errorMessage?: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret: string;
  lastDelivery: string;
  successRate: number;
  deliveries: number;
}

interface ApiKeyEntry {
  id: string;
  name: string;
  integration: string;
  key: string;
  maskedKey: string;
  createdAt: string;
  lastUsed: string;
  expiresAt: string;
  usageCount: number;
  status: 'active' | 'expired' | 'rotated';
  rotationScheduled?: string;
}

interface HealthMetric {
  integrationId: string;
  integrationName: string;
  uptime7d: number;
  avgLatency: number;
  errorRate: number;
  dataVolume: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const integrations: Integration[] = [
  { id: 'int-1', name: 'Stripe', description: 'Online payment processing platform', category: 'Payment', status: 'connected', lastSync: '2 min ago', syncInterval: 'Real-time', recordsSynced: 12500, uptime: 99.9, avgLatency: 120, errorRate: 0.1, logoColor: 'bg-violet-600', icon: <CreditCard className="h-5 w-5" /> },
  { id: 'int-2', name: 'PayPal', description: 'Global payment gateway', category: 'Payment', status: 'connected', lastSync: '5 min ago', syncInterval: 'Real-time', recordsSynced: 8900, uptime: 99.8, avgLatency: 150, errorRate: 0.2, logoColor: 'bg-blue-600', icon: <CreditCard className="h-5 w-5" /> },
  { id: 'int-3', name: 'Razorpay', description: 'India-focused payment gateway', category: 'Payment', status: 'connected', lastSync: '1 min ago', syncInterval: 'Real-time', recordsSynced: 5200, uptime: 99.7, avgLatency: 180, errorRate: 0.3, logoColor: 'bg-cyan-600', icon: <CreditCard className="h-5 w-5" /> },
  { id: 'int-4', name: 'Booking.com', description: 'Global hotel booking channel', category: 'Channel Manager', status: 'connected', lastSync: '15 min ago', syncInterval: '15 min', recordsSynced: 34200, uptime: 99.5, avgLatency: 800, errorRate: 0.5, logoColor: 'bg-blue-700', icon: <Globe className="h-5 w-5" /> },
  { id: 'int-5', name: 'Expedia', description: 'Online travel agency channel', category: 'Channel Manager', status: 'connected', lastSync: '20 min ago', syncInterval: '20 min', recordsSynced: 22800, uptime: 99.3, avgLatency: 950, errorRate: 0.8, logoColor: 'bg-yellow-600', icon: <Globe className="h-5 w-5" /> },
  { id: 'int-6', name: 'Airbnb', description: 'Vacation rental marketplace', category: 'Channel Manager', status: 'connected', lastSync: '30 min ago', syncInterval: '30 min', recordsSynced: 18500, uptime: 99.1, avgLatency: 1100, errorRate: 1.2, logoColor: 'bg-rose-500', icon: <Home className="h-5 w-5" /> },
  { id: 'int-7', name: 'MakeMyTrip', description: 'India travel booking platform', category: 'Channel Manager', status: 'error', lastSync: '2 hours ago', syncInterval: '15 min', recordsSynced: 9800, uptime: 95.2, avgLatency: 2200, errorRate: 4.8, logoColor: 'bg-red-600', icon: <Globe className="h-5 w-5" /> },
  { id: 'int-8', name: 'Goibibo', description: 'India hotel and flight booking', category: 'Channel Manager', status: 'connected', lastSync: '10 min ago', syncInterval: '15 min', recordsSynced: 7600, uptime: 98.8, avgLatency: 1300, errorRate: 1.5, logoColor: 'bg-green-600', icon: <Globe className="h-5 w-5" /> },
  { id: 'int-9', name: 'Mailchimp', description: 'Email marketing automation', category: 'Communication', status: 'connected', lastSync: '1 hour ago', syncInterval: 'Hourly', recordsSynced: 45000, uptime: 99.9, avgLatency: 350, errorRate: 0.1, logoColor: 'bg-amber-600', icon: <Mail className="h-5 w-5" /> },
  { id: 'int-10', name: 'SendGrid', description: 'Transactional email delivery', category: 'Communication', status: 'connected', lastSync: '5 min ago', syncInterval: 'Real-time', recordsSynced: 67000, uptime: 99.95, avgLatency: 80, errorRate: 0.05, logoColor: 'bg-sky-600', icon: <Mail className="h-5 w-5" /> },
  { id: 'int-11', name: 'Twilio', description: 'SMS and voice communication', category: 'Communication', status: 'connected', lastSync: '3 min ago', syncInterval: 'Real-time', recordsSynced: 23000, uptime: 99.9, avgLatency: 200, errorRate: 0.2, logoColor: 'bg-red-500', icon: <MessageSquare className="h-5 w-5" /> },
  { id: 'int-12', name: 'MSG91', description: 'SMS gateway for India', category: 'Communication', status: 'disconnected', lastSync: 'N/A', syncInterval: 'N/A', recordsSynced: 0, uptime: 0, avgLatency: 0, errorRate: 0, logoColor: 'bg-orange-500', icon: <MessageSquare className="h-5 w-5" /> },
  { id: 'int-13', name: 'ASSA ABLOY', description: 'Smart lock access control', category: 'IoT', status: 'connected', lastSync: '1 min ago', syncInterval: 'Real-time', recordsSynced: 8900, uptime: 99.8, avgLatency: 150, errorRate: 0.3, logoColor: 'bg-blue-800', icon: <Lock className="h-5 w-5" /> },
  { id: 'int-14', name: 'SALTO', description: 'Electronic access control systems', category: 'IoT', status: 'connected', lastSync: '2 min ago', syncInterval: 'Real-time', recordsSynced: 6200, uptime: 99.6, avgLatency: 180, errorRate: 0.4, logoColor: 'bg-emerald-700', icon: <Lock className="h-5 w-5" /> },
  { id: 'int-15', name: 'Dormakaba', description: 'Security and access solutions', category: 'IoT', status: 'configuring', lastSync: 'N/A', syncInterval: 'Real-time', recordsSynced: 0, uptime: 0, avgLatency: 0, errorRate: 0, logoColor: 'bg-gray-700', icon: <Lock className="h-5 w-5" /> },
  { id: 'int-16', name: 'Google Analytics', description: 'Web analytics and reporting', category: 'Analytics', status: 'connected', lastSync: '30 min ago', syncInterval: '30 min', recordsSynced: 156000, uptime: 99.9, avgLatency: 400, errorRate: 0.1, logoColor: 'bg-orange-500', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'int-17', name: 'Mixpanel', description: 'Product analytics platform', category: 'Analytics', status: 'disconnected', lastSync: 'N/A', syncInterval: 'N/A', recordsSynced: 0, uptime: 0, avgLatency: 0, errorRate: 0, logoColor: 'bg-indigo-600', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'int-18', name: 'Salesforce CRM', description: 'Customer relationship management', category: 'CRM', status: 'connected', lastSync: '10 min ago', syncInterval: '10 min', recordsSynced: 42000, uptime: 99.7, avgLatency: 500, errorRate: 0.6, logoColor: 'bg-blue-500', icon: <Users className="h-5 w-5" /> },
];

const syncLogEntries: SyncLogEntry[] = [
  { id: 'log-1', integrationId: 'int-1', integrationName: 'Stripe', type: 'push', direction: 'outgoing', records: 45, status: 'success', timestamp: '2 min ago', duration: '120ms' },
  { id: 'log-2', integrationId: 'int-4', integrationName: 'Booking.com', type: 'pull', direction: 'incoming', records: 23, status: 'success', timestamp: '5 min ago', duration: '850ms' },
  { id: 'log-3', integrationId: 'int-7', integrationName: 'MakeMyTrip', type: 'push', direction: 'outgoing', records: 0, status: 'failed', timestamp: '8 min ago', duration: '5000ms', errorMessage: 'Connection timeout - API endpoint unreachable' },
  { id: 'log-4', integrationId: 'int-3', integrationName: 'Razorpay', type: 'push', direction: 'outgoing', records: 12, status: 'success', timestamp: '10 min ago', duration: '180ms' },
  { id: 'log-5', integrationId: 'int-9', integrationName: 'Mailchimp', type: 'pull', direction: 'incoming', records: 156, status: 'success', timestamp: '15 min ago', duration: '350ms' },
  { id: 'log-6', integrationId: 'int-13', integrationName: 'ASSA ABLOY', type: 'push', direction: 'outgoing', records: 3, status: 'success', timestamp: '18 min ago', duration: '150ms' },
  { id: 'log-7', integrationId: 'int-5', integrationName: 'Expedia', type: 'pull', direction: 'incoming', records: 18, status: 'success', timestamp: '20 min ago', duration: '950ms' },
  { id: 'log-8', integrationId: 'int-7', integrationName: 'MakeMyTrip', type: 'push', direction: 'outgoing', records: 0, status: 'retrying', timestamp: '25 min ago', duration: '4500ms', errorMessage: 'Retrying (attempt 2/3) - 503 Service Unavailable' },
  { id: 'log-9', integrationId: 'int-11', integrationName: 'Twilio', type: 'push', direction: 'outgoing', records: 28, status: 'success', timestamp: '30 min ago', duration: '200ms' },
  { id: 'log-10', integrationId: 'int-10', integrationName: 'SendGrid', type: 'push', direction: 'outgoing', records: 89, status: 'success', timestamp: '32 min ago', duration: '80ms' },
  { id: 'log-11', integrationId: 'int-2', integrationName: 'PayPal', type: 'push', direction: 'outgoing', records: 7, status: 'success', timestamp: '35 min ago', duration: '150ms' },
  { id: 'log-12', integrationId: 'int-6', integrationName: 'Airbnb', type: 'pull', direction: 'incoming', records: 14, status: 'success', timestamp: '40 min ago', duration: '1100ms' },
  { id: 'log-13', integrationId: 'int-14', integrationName: 'SALTO', type: 'push', direction: 'outgoing', records: 5, status: 'success', timestamp: '42 min ago', duration: '180ms' },
  { id: 'log-14', integrationId: 'int-16', integrationName: 'Google Analytics', type: 'pull', direction: 'incoming', records: 342, status: 'success', timestamp: '45 min ago', duration: '400ms' },
  { id: 'log-15', integrationId: 'int-8', integrationName: 'Goibibo', type: 'pull', direction: 'incoming', records: 9, status: 'success', timestamp: '50 min ago', duration: '1300ms' },
  { id: 'log-16', integrationId: 'int-18', integrationName: 'Salesforce CRM', type: 'pull', direction: 'incoming', records: 67, status: 'success', timestamp: '55 min ago', duration: '500ms' },
  { id: 'log-17', integrationId: 'int-4', integrationName: 'Booking.com', type: 'push', direction: 'outgoing', records: 31, status: 'failed', timestamp: '1 hour ago', duration: '3200ms', errorMessage: 'Rate limit exceeded - 429 Too Many Requests' },
  { id: 'log-18', integrationId: 'int-7', integrationName: 'MakeMyTrip', type: 'push', direction: 'outgoing', records: 0, status: 'failed', timestamp: '1.5 hours ago', duration: '5000ms', errorMessage: 'Authentication failed - Invalid API credentials' },
  { id: 'log-19', integrationId: 'int-1', integrationName: 'Stripe', type: 'pull', direction: 'incoming', records: 22, status: 'success', timestamp: '1.5 hours ago', duration: '130ms' },
  { id: 'log-20', integrationId: 'int-9', integrationName: 'Mailchimp', type: 'push', direction: 'outgoing', records: 89, status: 'success', timestamp: '2 hours ago', duration: '320ms' },
  { id: 'log-21', integrationId: 'int-5', integrationName: 'Expedia', type: 'push', direction: 'outgoing', records: 15, status: 'success', timestamp: '2 hours ago', duration: '900ms' },
  { id: 'log-22', integrationId: 'int-11', integrationName: 'Twilio', type: 'pull', direction: 'incoming', records: 12, status: 'failed', timestamp: '2.5 hours ago', duration: '3000ms', errorMessage: 'SMS delivery failed - carrier rejection' },
];

const webhookConfigs: WebhookConfig[] = [
  { id: 'wh-1', name: 'Booking Confirmation Webhook', url: 'https://api.example.com/webhooks/bookings', events: ['booking.created', 'booking.updated', 'booking.cancelled'], status: 'active', secret: 'whsec_***...a3f2', lastDelivery: '5 min ago', successRate: 98.5, deliveries: 2450 },
  { id: 'wh-2', name: 'Payment Events', url: 'https://api.example.com/webhooks/payments', events: ['payment.completed', 'payment.failed', 'refund.processed'], status: 'active', secret: 'whsec_***...b7e1', lastDelivery: '2 min ago', successRate: 99.2, deliveries: 8920 },
  { id: 'wh-3', name: 'Guest Check-in/out', url: 'https://api.example.com/webhooks/checkin', events: ['guest.checked_in', 'guest.checked_out'], status: 'active', secret: 'whsec_***...c4d8', lastDelivery: '1 hour ago', successRate: 100, deliveries: 1240 },
  { id: 'wh-4', name: 'Review Notifications', url: 'https://api.example.com/webhooks/reviews', events: ['review.submitted', 'review.responded'], status: 'inactive', secret: 'whsec_***...e2f5', lastDelivery: 'N/A', successRate: 95.0, deliveries: 320 },
  { id: 'wh-5', name: 'Revenue Alerts', url: 'https://api.example.com/webhooks/revenue', events: ['revenue.threshold_crossed', 'occupancy.changed'], status: 'active', secret: 'whsec_***...f6a9', lastDelivery: '30 min ago', successRate: 97.8, deliveries: 1560 },
];

const availableEvents = [
  'booking.created', 'booking.updated', 'booking.cancelled',
  'payment.completed', 'payment.failed', 'refund.processed',
  'guest.checked_in', 'guest.checked_out', 'guest.registered',
  'review.submitted', 'review.responded',
  'revenue.threshold_crossed', 'occupancy.changed',
  'room.status_changed', 'service_request.created',
];

const apiKeys: ApiKeyEntry[] = [
  { id: 'key-1', name: 'Stripe Production Key', integration: 'Stripe', key: 'sk_live_51N4x2xAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTt', maskedKey: 'sk_live_****...SsTt', createdAt: 'Jan 15, 2024', lastUsed: '2 min ago', expiresAt: 'Jan 15, 2025', usageCount: 12500, status: 'active' },
  { id: 'key-2', name: 'Booking.com API Key', integration: 'Booking.com', key: 'bcom_v3_99887766554433221100AaBbCcDdEeFfGg', maskedKey: 'bcom_v3_****...FfGg', createdAt: 'Feb 20, 2024', lastUsed: '15 min ago', expiresAt: 'Feb 20, 2025', usageCount: 34200, status: 'active' },
  { id: 'key-3', name: 'Twilio Auth Token', integration: 'Twilio', key: 'tw_auth_ac1234567890abcdef1234567890abcdef', maskedKey: 'tw_auth_****...cdef', createdAt: 'Mar 10, 2024', lastUsed: '3 min ago', expiresAt: 'Never', usageCount: 23000, status: 'active' },
  { id: 'key-4', name: 'Mailchimp API Key (Legacy)', integration: 'Mailchimp', key: 'mc_us1_abcdef1234567890abcdef1234567890', maskedKey: 'mc_us1_****...7890', createdAt: 'Jun 1, 2023', lastUsed: 'N/A', expiresAt: 'Jun 1, 2024', usageCount: 12500, status: 'expired', rotationScheduled: undefined },
  { id: 'key-5', name: 'ASSA ABLOY Access Key', integration: 'ASSA ABLOY', key: 'assa_prod_xYz123AbC456DeF789GhI012JkLmNoP', maskedKey: 'assa_prod_****...mNoP', createdAt: 'Nov 5, 2024', lastUsed: '1 min ago', expiresAt: 'May 5, 2025', usageCount: 8900, status: 'active', rotationScheduled: 'Apr 5, 2025' },
  { id: 'key-6', name: 'Google Analytics OAuth', integration: 'Google Analytics', key: 'ga4_oauth_9876543210abcdef9876543210abcdef', maskedKey: 'ga4_oauth_****...cdef', createdAt: 'Aug 15, 2024', lastUsed: '30 min ago', expiresAt: 'Aug 15, 2025', usageCount: 156000, status: 'active', rotationScheduled: 'Jul 15, 2025' },
  { id: 'key-7', name: 'Razorpay Test Key', integration: 'Razorpay', key: 'rzp_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', maskedKey: 'rzp_test_****...o5p6', createdAt: 'Dec 1, 2024', lastUsed: '1 min ago', expiresAt: 'Never', usageCount: 5200, status: 'active' },
  { id: 'key-8', name: 'Expedia Partner Key (Rotated)', integration: 'Expedia', key: 'exp_v2_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4', maskedKey: 'exp_v2_****...l5k4', createdAt: 'Oct 20, 2024', lastUsed: '20 min ago', expiresAt: 'Apr 20, 2025', usageCount: 22800, status: 'rotated' },
];

const errorRateTrend = [
  { day: 'Mon', rate: 1.2, errors: 8 },
  { day: 'Tue', rate: 0.8, errors: 5 },
  { day: 'Wed', rate: 2.1, errors: 15 },
  { day: 'Thu', rate: 0.5, errors: 3 },
  { day: 'Fri', rate: 1.8, errors: 12 },
  { day: 'Sat', rate: 0.3, errors: 2 },
  { day: 'Sun', rate: 0.9, errors: 6 },
];

const dataVolumeData = [
  { day: 'Mon', volume: 12500 },
  { day: 'Tue', volume: 14200 },
  { day: 'Wed', volume: 15800 },
  { day: 'Thu', volume: 13500 },
  { day: 'Fri', volume: 18200 },
  { day: 'Sat', volume: 22100 },
  { day: 'Sun', volume: 19800 },
];

const categories = ['Payment', 'Channel Manager', 'CRM', 'PMS', 'Revenue Management', 'Housekeeping', 'IoT', 'Communication', 'Analytics', 'HR/Payroll'];

const categoryIcons: Record<string, React.ReactNode> = {
  'Payment': <CreditCard className="h-4 w-4" />,
  'Channel Manager': <Globe className="h-4 w-4" />,
  'CRM': <Users className="h-4 w-4" />,
  'PMS': <Server className="h-4 w-4" />,
  'Revenue Management': <BarChart3 className="h-4 w-4" />,
  'Housekeeping': <Sparkles className="h-4 w-4" />,
  'IoT': <Wifi className="h-4 w-4" />,
  'Communication': <MessageSquare className="h-4 w-4" />,
  'Analytics': <BarChart3 className="h-4 w-4" />,
  'HR/Payroll': <Users className="h-4 w-4" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  connected: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: <Wifi className="h-3 w-3" /> },
  disconnected: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: <WifiOff className="h-3 w-3" /> },
  error: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
  configuring: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: <Settings className="h-3 w-3" /> },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntegrationHub() {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>('all');
  const [syncIntegrationFilter, setSyncIntegrationFilter] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [integrationStates, setIntegrationStates] = useState<Record<string, string>>(
    Object.fromEntries(integrations.map(i => [i.id, i.status]))
  );

  const connectedIntegrations = useMemo(() =>
    integrations.filter(i => i.status === 'connected'),
    []
  );

  const erroredIntegrations = useMemo(() =>
    integrations.filter(i => i.status === 'error'),
    []
  );

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(i => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase()) && !i.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const filteredSyncLogs = useMemo(() => {
    return syncLogEntries.filter(l => {
      if (syncTypeFilter !== 'all' && l.type !== syncTypeFilter) return false;
      if (syncIntegrationFilter !== 'all' && l.integrationName !== syncIntegrationFilter) return false;
      return true;
    });
  }, [syncTypeFilter, syncIntegrationFilter]);

  const totalSyncOps = syncLogEntries.length;
  const failedSyncOps = syncLogEntries.filter(l => l.status === 'failed').length;
  const successRate = totalSyncOps > 0 ? ((totalSyncOps - failedSyncOps) / totalSyncOps * 100).toFixed(1) : '100';

  const handleConnect = (id: string) => {
    setIntegrationStates(prev => ({ ...prev, [id]: 'connected' }));
    toast.success('Integration connected successfully!');
  };

  const handleDisconnect = (id: string) => {
    setIntegrationStates(prev => ({ ...prev, [id]: 'disconnected' }));
    toast.success('Integration disconnected.');
  };

  const handleRetry = (logId: string) => {
    toast.success('Sync operation retried!');
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Plug className="h-4 w-4 text-white" />
            </div>
            Integration Hub
          </h2>
          <p className="text-muted-foreground">Centralized management for all third-party integrations</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <Wifi className="h-3 w-3 mr-1" />
            {connectedIntegrations.length} Connected
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            {erroredIntegrations.length} Errors
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="marketplace" className="gap-1.5">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplace</span>
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Connected</span>
          </TabsTrigger>
          <TabsTrigger value="sync-log" className="gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Sync Log</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <HeartPulse className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Integration Marketplace ───────────────────────────────────── */}
        <TabsContent value="marketplace" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Filter className="h-4 w-4 mr-2" />
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
            </CardContent>
          </Card>

          {/* Integration Cards Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => {
              const currentStatus = integrationStates[integration.id] || integration.status;
              const statusCfg = statusColors[currentStatus] || statusColors.connected;
              return (
                <Card key={integration.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white', integration.logoColor)}>
                          {integration.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{integration.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {categoryIcons[integration.category] || <Plug className="h-3 w-3" />}
                            <span className="ml-1">{integration.category}</span>
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] capitalize', statusCfg.bg, statusCfg.text)}>
                        {statusCfg.icon}
                        <span className="ml-1">{currentStatus}</span>
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{integration.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {integration.lastSync}</span>
                      <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {integration.syncInterval}</span>
                    </div>
                    <div className="flex gap-2">
                      {currentStatus === 'connected' ? (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setSelectedIntegration(integration)}>
                            <Settings className="h-3 w-3 mr-1" /> Configure
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => handleDisconnect(integration.id)}>
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </>
                      ) : currentStatus === 'error' ? (
                        <Button size="sm" className="flex-1 h-8" onClick={() => handleConnect(integration.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reconnect
                        </Button>
                      ) : currentStatus === 'configuring' ? (
                        <Button size="sm" className="flex-1 h-8" onClick={() => setSelectedIntegration(integration)}>
                          <Settings className="h-3 w-3 mr-1" /> Configure
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1 h-8" onClick={() => handleConnect(integration.id)}>
                          <Link2 className="h-3 w-3 mr-1" /> Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Connected Integrations ─────────────────────────────────────── */}
        <TabsContent value="connected" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integration</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="hidden md:table-cell">Records</TableHead>
                      <TableHead className="hidden lg:table-cell">Uptime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedIntegrations.map((integ) => (
                      <TableRow key={integ.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0', integ.logoColor)}>
                              {integ.icon}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{integ.name}</p>
                              <p className="text-xs text-muted-foreground">{integ.syncInterval}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {categoryIcons[integ.category]}
                            <span className="ml-1">{integ.category}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{integ.lastSync}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-mono">{integ.recordsSynced.toLocaleString()}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <Progress value={integ.uptime} className="h-2 w-16" />
                            <span className="text-xs font-mono">{integ.uptime}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', statusColors.connected.bg, statusColors.connected.text)}>
                            {statusColors.connected.icon}
                            <span className="ml-1">Connected</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toast.success('Sync triggered!'); }}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIntegration(integ)}>
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDisconnect(integ.id)}>
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
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

        {/* ─── Sync Activity Log ──────────────────────────────────────────── */}
        <TabsContent value="sync-log" className="space-y-4">
          {/* Log Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{successRate}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{failedSyncOps}</div>
                  <div className="text-xs text-muted-foreground">Failed Ops</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-cyan-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Activity className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalSyncOps}</div>
                  <div className="text-xs text-muted-foreground">Total Syncs</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <RotateCw className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{syncLogEntries.filter(l => l.status === 'retrying').length}</div>
                  <div className="text-xs text-muted-foreground">Retrying</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={syncTypeFilter} onValueChange={setSyncTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="pull">Pull</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={syncIntegrationFilter} onValueChange={setSyncIntegrationFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Integration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Integrations</SelectItem>
                    {[...new Set(syncLogEntries.map(l => l.integrationName))].map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Sync Log Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Integration</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="hidden md:table-cell">Records</TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSyncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.status === 'success' && (
                            <Badge className="bg-emerald-500 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>
                          )}
                          {log.status === 'failed' && (
                            <Badge className="bg-red-500 text-xs"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>
                          )}
                          {log.status === 'retrying' && (
                            <Badge className="bg-amber-500 text-xs"><RotateCw className="h-3 w-3 mr-1" /> Retry</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{log.integrationName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{log.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {log.direction === 'outgoing' ? (
                            <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                              <ArrowUpRight className="h-3 w-3 mr-1" /> Out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              <ArrowDownLeft className="h-3 w-3 mr-1" /> In
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-mono">{log.records}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">{log.duration}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.timestamp}</TableCell>
                        <TableCell className="text-right">
                          {(log.status === 'failed' || log.status === 'retrying') && (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleRetry(log.id)}>
                              <RotateCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
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

        {/* ─── Health Dashboard ───────────────────────────────────────────── */}
        <TabsContent value="health" className="space-y-4">
          {/* Overview Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="text-2xl font-bold text-emerald-600">99.4%</div>
              <div className="text-xs text-muted-foreground">Avg Uptime (7d)</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-cyan-500">
              <div className="text-2xl font-bold">340ms</div>
              <div className="text-xs text-muted-foreground">Avg Sync Latency</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="text-2xl font-bold">0.8%</div>
              <div className="text-xs text-muted-foreground">Avg Error Rate</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-violet-500">
              <div className="text-2xl font-bold">1.2M</div>
              <div className="text-xs text-muted-foreground">Total Records Synced</div>
            </Card>
          </div>

          {/* Error Rate Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Error Rate Trend (7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={errorRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="Error Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Data Volume Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Data Volume (Records Synced)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Health Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-Integration Health</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integration</TableHead>
                      <TableHead>Uptime (7d)</TableHead>
                      <TableHead>Avg Latency</TableHead>
                      <TableHead>Error Rate</TableHead>
                      <TableHead>Data Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedIntegrations.map((integ) => (
                      <TableRow key={integ.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn('h-6 w-6 rounded flex items-center justify-center text-white text-xs', integ.logoColor)}>
                              {integ.icon}
                            </div>
                            <span className="font-medium text-sm">{integ.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={integ.uptime} className="h-2 w-16" />
                            <span className={cn('text-sm font-mono', integ.uptime >= 99 ? 'text-emerald-600' : integ.uptime >= 95 ? 'text-amber-600' : 'text-red-600')}>
                              {integ.uptime}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{integ.avgLatency}ms</TableCell>
                        <TableCell>
                          <span className={cn('text-sm font-mono', integ.errorRate <= 0.5 ? 'text-emerald-600' : integ.errorRate <= 2 ? 'text-amber-600' : 'text-red-600')}>
                            {integ.errorRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{integ.recordsSynced.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Webhook Configuration ──────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{webhookConfigs.filter(w => w.status === 'active').length} active webhooks</p>
            </div>
            <Button onClick={() => setShowAddWebhook(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>

          <div className="grid gap-4">
            {webhookConfigs.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-sm">{wh.name}</h3>
                        <Badge variant={wh.status === 'active' ? 'default' : 'secondary'} className={wh.status === 'active' ? 'bg-emerald-500 text-xs' : 'text-xs'}>
                          {wh.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Webhook className="h-3 w-3" />
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{wh.url}</code>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-[10px] font-mono">{event}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                      <div>
                        <div className="text-sm font-bold">{wh.successRate}%</div>
                        <div className="text-[10px] text-muted-foreground">Success</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{wh.deliveries.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">Deliveries</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{wh.lastDelivery}</div>
                        <div className="text-[10px] text-muted-foreground">Last</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>Secret: {wh.secret}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Webhook test sent!')}>
                        Test
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Delivery logs opened!')}>
                        Logs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── API Keys Management ────────────────────────────────────────── */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{apiKeys.filter(k => k.status === 'active').length} active keys</p>
            </div>
            <Button onClick={() => setShowAddKey(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Integration</TableHead>
                      <TableHead>Key Value</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Usage</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{apiKey.name}</p>
                            <p className="text-xs text-muted-foreground">Created {apiKey.createdAt}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{apiKey.integration}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono max-w-[120px] truncate">
                              {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.maskedKey}
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyVisibility(apiKey.id)}>
                              {visibleKeys.has(apiKey.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(apiKey.key); toast.success('Key copied!'); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={cn(
                            'text-xs',
                            apiKey.status === 'active' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            apiKey.status === 'expired' && 'bg-red-500/10 text-red-600 border-red-500/30',
                            apiKey.status === 'rotated' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                          )}>
                            {apiKey.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm font-mono">{apiKey.usageCount.toLocaleString()}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {apiKey.rotationScheduled ? (
                            <div>
                              <span className="text-amber-600">Rotation: {apiKey.rotationScheduled}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{apiKey.expiresAt}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Key rotated!')}>
                              <RotateCw className="h-3 w-3 mr-1" /> Rotate
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => toast.success('Key revoked!')}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
      </Tabs>

      {/* ─── Integration Detail Dialog ───────────────────────────────────── */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedIntegration && (
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white', selectedIntegration.logoColor)}>
                  {selectedIntegration.icon}
                </div>
              )}
              {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>{selectedIntegration?.description}</DialogDescription>
          </DialogHeader>
          {selectedIntegration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.category}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Sync Interval</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.syncInterval}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="text-sm font-bold mt-0.5 text-emerald-600">{selectedIntegration.uptime}%</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Avg Latency</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.avgLatency}ms</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Error Rate</div>
                  <div className={cn('text-sm font-medium mt-0.5', selectedIntegration.errorRate <= 1 ? 'text-emerald-600' : selectedIntegration.errorRate <= 3 ? 'text-amber-600' : 'text-red-600')}>
                    {selectedIntegration.errorRate}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Records Synced</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.recordsSynced.toLocaleString()}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Sync</Label>
                <p className="text-sm">{selectedIntegration.lastSync}</p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => { toast.success('Test connection sent!'); }}>
                  <Zap className="h-4 w-4 mr-1" /> Test Connection
                </Button>
                <Button size="sm" onClick={() => { toast.success('Sync triggered!'); setSelectedIntegration(null); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Sync Now
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Webhook Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAddWebhook} onOpenChange={setShowAddWebhook}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Add Webhook
            </DialogTitle>
            <DialogDescription>Configure a new outgoing webhook</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Webhook Name</Label>
              <Input placeholder="My Webhook" />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input placeholder="https://api.example.com/webhooks/..." />
            </div>
            <div className="space-y-2">
              <Label>Events to Subscribe</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border max-h-32 overflow-y-auto">
                {availableEvents.map((event) => (
                  <label key={event} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-xs font-mono">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <Input type="password" placeholder="Webhook signing secret" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWebhook(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Webhook created!'); setShowAddWebhook(false); }}>
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add API Key Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAddKey} onOpenChange={setShowAddKey}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Add API Key
            </DialogTitle>
            <DialogDescription>Generate a new API key for an integration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input placeholder="Production API Key" />
            </div>
            <div className="space-y-2">
              <Label>Integration</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select integration" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map(int => (
                    <SelectItem key={int.id} value={int.name}>{int.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                  <SelectItem value="180">6 Months</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto-Rotation</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Rotation schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="biannually">Bi-annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddKey(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('API key generated!'); setShowAddKey(false); }}>
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
