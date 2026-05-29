'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertTriangle, AlertCircle, Bell, CheckCircle, Eye,
  ChevronUp, ChevronDown, Loader2, Plus, Radio,
  Megaphone, ShieldAlert, Flame, Siren, Zap,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface EmergencyAlert {
  id: string;
  title: string;
  description: string | null;
  type: string;
  severity: string;
  status: string;
  location: string | null;
  affectedRooms: string;
  reportedBy: string | null;
  assignedTo: string | null;
  responseActions: string;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  acknowledged: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  escalated: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  false_alarm: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
};

const TYPE_LABELS: Record<string, string> = {
  fire: 'Fire',
  medical: 'Medical',
  security: 'Security',
  natural_disaster: 'Natural Disaster',
  utility_failure: 'Utility Failure',
  bomb_threat: 'Bomb Threat',
  evacuation: 'Evacuation',
  other: 'Other',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  fire: <Flame className="h-4 w-4" />,
  medical: <AlertCircle className="h-4 w-4" />,
  security: <ShieldAlert className="h-4 w-4" />,
  natural_disaster: <Zap className="h-4 w-4" />,
  utility_failure: <AlertTriangle className="h-4 w-4" />,
  bomb_threat: <Siren className="h-4 w-4" />,
  evacuation: <Radio className="h-4 w-4" />,
  other: <Bell className="h-4 w-4" />,
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function EmergencyAlertsPanel() {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [propertyId] = useState('default');

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('other');
  const [formSeverity, setFormSeverity] = useState('medium');
  const [formLocation, setFormLocation] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ propertyId });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterType !== 'all') params.set('type', filterType);

      const res = await fetch(`/api/security/emergency-alerts?${params}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
    setLoading(false);
  }, [filterStatus, filterSeverity, filterType, propertyId]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const filteredAlerts = alerts.filter((a) => {
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && !a.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/security/emergency-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          title: formTitle.trim(),
          description: formDesc.trim(),
          type: formType,
          severity: formSeverity,
          location: formLocation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Emergency alert created');
        setCreateOpen(false);
        setFormTitle('');
        setFormDesc('');
        setFormType('other');
        setFormSeverity('medium');
        setFormLocation('');
        fetchAlerts();
      } else {
        toast.error(data.error || 'Failed to create alert');
      }
    } catch {
      toast.error('Failed to create alert');
    }
    setCreateLoading(false);
  };

  const handleUpdateStatus = async (alertId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/security/emergency-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Alert ${newStatus}`);
        fetchAlerts();
      }
    } catch {
      toast.error('Failed to update alert');
    }
  };

  const handleBroadcast = async (alertId: string) => {
    try {
      const res = await fetch('/api/security/emergency-alerts/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          channels: ['in_app', 'push'],
          targetGroups: ['all_staff', 'security', 'management'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Broadcast dispatched to staff');
      }
    } catch {
      toast.error('Failed to dispatch broadcast');
    }
  };

  return (
    <SectionGuard permission="security.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Emergency Alerts</h2>
            <p className="text-muted-foreground">Monitor and manage emergency situations</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4" />
                New Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Emergency Alert</DialogTitle>
                <DialogDescription>Report a new emergency situation</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Fire detected in kitchen"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Provide details about the emergency"
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Severity</label>
                    <Select value={formSeverity} onValueChange={setFormSeverity}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Building A, Floor 3"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={createLoading}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  {createLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Alert
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Active Alerts</div>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Critical</div>
              <div className="text-2xl font-bold">{criticalCount}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Alerts</div>
              <div className="text-2xl font-bold">{alerts.length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Resolved</div>
              <div className="text-2xl font-bold">{alerts.filter((a) => a.status === 'resolved' || a.status === 'false_alarm').length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="false_alarm">False Alarm</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Alert List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-10 w-10 mb-2" />
                <p className="text-sm">No alerts found</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Alert</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead className="hidden lg:table-cell">Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.map((alert) => (
                      <TableRow key={alert.id} className={alert.severity === 'critical' && alert.status === 'active' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                        <TableCell>
                          <div className={`w-2.5 h-2.5 rounded-full ${SEVERITY_DOT[alert.severity] || 'bg-gray-400'}`} />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <div className="font-medium text-sm truncate">{alert.title}</div>
                            {alert.description && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">{alert.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            {TYPE_ICONS[alert.type] || TYPE_ICONS.other}
                            <span className="text-xs">{TYPE_LABELS[alert.type] || alert.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={SEVERITY_COLORS[alert.severity] || ''}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[alert.status] || ''}>
                            {alert.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {alert.location || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(alert.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {alert.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  onClick={() => handleUpdateStatus(alert.id, 'acknowledged')}
                                  title="Acknowledge"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => handleUpdateStatus(alert.id, 'escalated')}
                                  title="Escalate"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() => handleBroadcast(alert.id)}
                                  title="Broadcast"
                                >
                                  <Megaphone className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {(alert.status === 'active' || alert.status === 'acknowledged' || alert.status === 'escalated') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                                title="Resolve"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {alert.status === 'active' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-gray-500 hover:text-gray-600 hover:bg-gray-50"
                                onClick={() => handleUpdateStatus(alert.id, 'false_alarm')}
                                title="False Alarm"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionGuard>
  );
}
