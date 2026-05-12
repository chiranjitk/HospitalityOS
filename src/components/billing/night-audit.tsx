'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Moon,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  AlertCircle,
  SkipForward,
  DollarSign,
  Users,
  LogIn,
  LogOut,
  FileBarChart,
  RefreshCw,
  CalendarDays,
  Building2,
  TrendingUp,
  ArrowRight,
  BarChart3,
  CreditCard,
  BedDouble,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface AuditStep {
  key: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  result?: Record<string, unknown>;
  completedAt?: string;
}

interface NightAudit {
  id: string;
  propertyId: string;
  status: 'in_progress' | 'completed' | 'failed';
  auditDate: string;
  startedAt: string;
  completedAt?: string;
  steps: AuditStep[];
  summary: {
    roomRevenue: number;
    fbRevenue: number;
    totalRevenue: number;
    occupancyRate: number;
    inHouseGuests: number;
    expectedDepartures: number;
    expectedArrivals: number;
    roomChargesPosted: number;
    noShowsProcessed: number;
    folioAnomalies: number;
    roomDiscrepancies: number;
  };
  property: Property;
}

interface DailySummary {
  inHouseGuests: number;
  expectedDepartures: number;
  expectedArrivals: number;
  occupancyRate: number;
}

const AUDIT_STEPS = [
  { key: 'post_room_charges', name: 'Post Room Charges', description: 'Post daily room charges to all in-house guest folios', icon: BedDouble },
  { key: 'verify_folios', name: 'Verify Folios', description: 'Check folio balances and identify anomalies', icon: CreditCard },
  { key: 'process_noshows', name: 'Process No-Shows', description: 'Mark expected arrivals who did not check in as no-shows', icon: LogIn },
  { key: 'reconcile_rooms', name: 'Reconcile Rooms', description: 'Verify room status matches expected occupancy', icon: BedDouble },
  { key: 'generate_reports', name: 'Generate Reports', description: 'Auto-generate daily revenue flash and operational reports', icon: FileBarChart },
  { key: 'close_business_day', name: 'Close Business Day', description: 'Finalize and close the current business day', icon: Moon },
];

export default function NightAudit() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeAudit, setActiveAudit] = useState<NightAudit | null>(null);
  const [completedAudits, setCompletedAudits] = useState<NightAudit[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingAudit, setIsStartingAudit] = useState(false);
  const [isExecutingStep, setIsExecutingStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('current');

  // Load properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties?limit=50');
        const result = await res.json();
        if (result.success && result.data?.length) {
          setProperties(result.data);
          setSelectedPropertyId(result.data[0].id);
        }
      } catch {
        // silent
      }
    };
    fetchProperties();
  }, []);

  // Fetch active audit and daily summary
  const fetchAuditData = async () => {
    if (!selectedPropertyId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, date: auditDate });
      const res = await fetch(`/api/night-audit?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setActiveAudit(result.data?.activeAudit || null);
        setCompletedAudits(result.data?.completedAudits || []);
        setDailySummary(result.data?.dailySummary || null);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load night audit data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditData();
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedPropertyId, auditDate]);

  // Start new audit
  const handleStartAudit = async () => {
    if (!selectedPropertyId) return;
    setIsStartingAudit(true);
    try {
      const res = await fetch('/api/night-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedPropertyId, auditDate }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Audit Started', description: 'Night audit has been initiated' });
        setActiveAudit(result.data);
        fetchAuditData();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to start audit', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start audit', variant: 'destructive' });
    } finally {
      setIsStartingAudit(false);
    }
  };

  // Execute audit step
  const handleExecuteStep = async (stepKey: string) => {
    if (!activeAudit) return;
    setIsExecutingStep(stepKey);
    try {
      const res = await fetch(`/api/night-audit/${activeAudit.id}/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Step Completed', description: `${stepKey.replace(/_/g, ' ')} executed successfully` });
        setActiveAudit(result.data);
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to execute step', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to execute step', variant: 'destructive' });
    } finally {
      setIsExecutingStep(null);
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'in_progress': return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
      case 'skipped': return <SkipForward className="h-5 w-5 text-gray-400" />;
      default: return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'in_progress': return 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20';
      case 'skipped': return 'border-gray-300/50 bg-gray-50/50 dark:bg-gray-900/20 opacity-60';
      default: return 'border-border';
    }
  };

  const completedStepsCount = activeAudit?.steps.filter(s => s.status === 'completed').length || 0;
  const totalSteps = AUDIT_STEPS.length;
  const auditProgress = totalSteps > 0 ? (completedStepsCount / totalSteps) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Night Audit
          </h2>
          <p className="text-sm text-muted-foreground">
            End-of-day operations and financial reconciliation
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={auditDate}
            onChange={(e) => setAuditDate(e.target.value)}
            className="w-full sm:w-44"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
            ))}
          </div>
          <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <BedDouble className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                    {formatCurrency(activeAudit?.summary?.roomRevenue ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Room Revenue</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <DollarSign className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
                    {formatCurrency(activeAudit?.summary?.fbRevenue ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">F&B Revenue</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <TrendingUp className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-400 bg-clip-text text-transparent">
                    {formatCurrency(activeAudit?.summary?.totalRevenue ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <BarChart3 className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-sky-400 bg-clip-text text-transparent">
                    {((activeAudit?.summary?.occupancyRate ?? 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Occupancy Rate</div>
                </div>
              </div>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="current">
                <Moon className="h-4 w-4 mr-1.5" />
                Current Audit
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="h-4 w-4 mr-1.5" />
                Audit History
              </TabsTrigger>
            </TabsList>

            {/* Current Audit */}
            <TabsContent value="current" className="space-y-6 mt-4">
              {!activeAudit ? (
                /* No Active Audit - Show Summary & Start Button */
                <Card className="p-6">
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Moon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">No Active Night Audit</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start the night audit process for {format(new Date(auditDate), 'MMMM d, yyyy')}
                      </p>
                    </div>

                    {/* Daily Summary */}
                    {dailySummary && (
                      <div className="grid gap-3 grid-cols-3 max-w-md mx-auto mt-6">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                          <div className="text-xl font-bold">{dailySummary.inHouseGuests}</div>
                          <div className="text-xs text-muted-foreground">In-House</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <LogOut className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                          <div className="text-xl font-bold">{dailySummary.expectedDepartures}</div>
                          <div className="text-xs text-muted-foreground">Departures</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <LogIn className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                          <div className="text-xl font-bold">{dailySummary.expectedArrivals}</div>
                          <div className="text-xs text-muted-foreground">Arrivals</div>
                        </div>
                      </div>
                    )}

                    <Button size="lg" onClick={handleStartAudit} disabled={isStartingAudit} className="mt-4">
                      {isStartingAudit ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Start Night Audit
                    </Button>
                  </div>
                </Card>
              ) : (
                /* Active Audit - Step Wizard */
                <>
                  {/* Progress */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Audit Progress</span>
                      <span className="text-sm text-muted-foreground">{completedStepsCount} of {totalSteps} steps</span>
                    </div>
                    <Progress value={auditProgress} className="h-2" />
                    <div className="flex items-center gap-2 mt-3">
                      {AUDIT_STEPS.map((step, idx) => {
                        const stepData = activeAudit.steps.find(s => s.key === step.key);
                        return (
                          <React.Fragment key={step.key}>
                            <div className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all',
                              stepData?.status === 'completed' && 'bg-emerald-500 border-emerald-500 text-white',
                              stepData?.status === 'in_progress' && 'bg-amber-500 border-amber-500 text-white animate-pulse',
                              stepData?.status === 'skipped' && 'bg-gray-300 border-gray-300 text-white',
                              (!stepData || stepData.status === 'pending') && 'bg-background border-muted-foreground/30 text-muted-foreground',
                            )}>
                              {stepData?.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                            </div>
                            {idx < AUDIT_STEPS.length - 1 && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Step Wizard */}
                  <div className="space-y-4">
                    {AUDIT_STEPS.map((step, idx) => {
                      const stepData = activeAudit.steps.find(s => s.key === step.key);
                      const status = stepData?.status || 'pending';
                      const canExecute = idx === completedStepsCount && status === 'pending' && activeAudit.status === 'in_progress';
                      const StepIcon = step.icon;

                      return (
                        <Card
                          key={step.key}
                          className={cn(
                            'border-2 transition-all duration-200',
                            getStepStatusColor(status),
                            canExecute && 'ring-2 ring-primary/20 hover:ring-primary/40',
                          )}
                        >
                          <CardContent className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="shrink-0 mt-0.5">{getStepStatusIcon(status)}</div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <StepIcon className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-semibold">{step.name}</h3>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs capitalize',
                                        status === 'completed' && 'border-emerald-500 text-emerald-600',
                                        status === 'in_progress' && 'border-amber-500 text-amber-600',
                                        status === 'skipped' && 'text-gray-400',
                                      )}
                                    >
                                      {status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{step.description}</p>

                                  {/* Step Results */}
                                  {stepData?.result && (
                                    <div className="flex flex-wrap gap-3 mt-2">
                                      {step.key === 'post_room_charges' && (
                                        <>
                                          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-full">
                                            {(stepData.result as Record<string, number>).chargesPosted || 0} charges posted
                                          </span>
                                        </>
                                      )}
                                      {step.key === 'verify_folios' && (
                                        <>
                                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-1 rounded-full">
                                            {(stepData.result as Record<string, number>).folioCount || 0} folios
                                          </span>
                                          {(stepData.result as Record<string, number>).anomalies ? (
                                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-1 rounded-full">
                                              {(stepData.result as Record<string, number>).anomalies} anomalies
                                            </span>
                                          ) : (
                                            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-full">
                                              No anomalies
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {step.key === 'process_noshows' && (
                                        <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-2 py-1 rounded-full">
                                          {(stepData.result as Record<string, number>).noShowsProcessed || 0} no-shows
                                        </span>
                                      )}
                                      {step.key === 'reconcile_rooms' && (
                                        <>
                                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-1 rounded-full">
                                            {(stepData.result as Record<string, number>).roomsChecked || 0} rooms checked
                                          </span>
                                          {(stepData.result as Record<string, number>).discrepancies ? (
                                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-1 rounded-full">
                                              {(stepData.result as Record<string, number>).discrepancies} discrepancies
                                            </span>
                                          ) : (
                                            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-full">
                                              All clear
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {step.key === 'generate_reports' && (
                                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-1 rounded-full">
                                          Reports generated
                                        </span>
                                      )}
                                      {stepData.completedAt && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {format(new Date(stepData.completedAt), 'HH:mm:ss')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {canExecute && (
                                <Button
                                  onClick={() => handleExecuteStep(step.key)}
                                  disabled={isExecutingStep !== null}
                                  className="shrink-0"
                                >
                                  {isExecutingStep === step.key ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                  )}
                                  Execute
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Audit Status Banner */}
                  {activeAudit.status === 'completed' && (
                    <Alert className="border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                        Night audit completed successfully at {activeAudit.completedAt ? format(new Date(activeAudit.completedAt), 'h:mm a') : 'N/A'}.
                        Total revenue: {formatCurrency(activeAudit.summary.totalRevenue)}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>

            {/* Audit History */}
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {completedAudits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <CalendarDays className="h-12 w-12 mb-4" />
                      <p>No completed audits found</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Room Revenue</TableHead>
                            <TableHead>F&B Revenue</TableHead>
                            <TableHead>Total Revenue</TableHead>
                            <TableHead>Occupancy</TableHead>
                            <TableHead>Completed At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedAudits.map((audit) => (
                            <TableRow key={audit.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell>
                                <span className="font-medium">
                                  {format(new Date(audit.auditDate), 'MMM d, yyyy')}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">{audit.property?.name || '—'}</TableCell>
                              <TableCell className="text-sm">{formatCurrency(audit.summary.roomRevenue)}</TableCell>
                              <TableCell className="text-sm">{formatCurrency(audit.summary.fbRevenue)}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-sm">
                                  {formatCurrency(audit.summary.totalRevenue)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                                  {(audit.summary.occupancyRate * 100).toFixed(0)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {audit.completedAt ? format(new Date(audit.completedAt), 'h:mm a') : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchAuditData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
