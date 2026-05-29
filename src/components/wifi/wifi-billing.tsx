'use client';

/**
 * WiFi Billing Dashboard
 *
 * Displays:
 * - Summary KPI cards (Total Billed, Posted, Pending, This Month)
 * - Recent invoice lines table with guest, plan, charge type, amount, data, status
 * - Manual billing run trigger button
 * - Invoice generation button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DollarSign,
  FileCheck,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  Play,
  FileText,
  AlertCircle,
  Wifi,
  Zap,
  Database,
  ArrowUpRight,
} from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface BillingSummary {
  totalBilled: number;
  totalPending: number;
  totalPosted: number;
  totalInvoiced: number;
  totalVoided: number;
  byChargeType: Record<string, number>;
  thisMonth: number;
  lastMonth: number;
  lineCount: number;
}

interface InvoiceLine {
  id: string;
  tenantId: string;
  propertyId: string | null;
  guestId: string | null;
  bookingId: string | null;
  wifiUserId: string | null;
  periodStart: string;
  periodEnd: string;
  chargeType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  dataUsedMb: number;
  planId: string | null;
  status: string;
  postedToFolioAt: string | null;
  createdAt: string;
  guest: { id: string; firstName: string; lastName: string; email: string | null } | null;
  plan: { id: string; name: string } | null;
  property: { id: string; name: string } | null;
  booking: { id: string; confirmationCode: string } | null;
}

interface BillingResult {
  processed: number;
  postedToFolio: number;
  errors: string[];
  totalCharged: number;
  skipped: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getChargeTypeBadgeVariant(chargeType: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (chargeType) {
    case 'plan_fee':
      return 'default';
    case 'data_overage':
      return 'destructive';
    case 'bandwidth_upgrade':
      return 'secondary';
    case 'topup':
      return 'outline';
    default:
      return 'outline';
  }
}

function getChargeTypeIcon(chargeType: string) {
  switch (chargeType) {
    case 'plan_fee':
      return <Wifi className="h-3.5 w-3.5" />;
    case 'data_overage':
      return <Database className="h-3.5 w-3.5" />;
    case 'bandwidth_upgrade':
      return <Zap className="h-3.5 w-3.5" />;
    case 'topup':
      return <ArrowUpRight className="h-3.5 w-3.5" />;
    default:
      return <DollarSign className="h-3.5 w-3.5" />;
  }
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
    pending: { variant: 'outline', label: 'Pending' },
    posted: { variant: 'default', label: 'Posted' },
    invoiced: { variant: 'secondary', label: 'Invoiced' },
    voided: { variant: 'destructive', label: 'Voided' },
  };
  const c = config[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiBillingDashboard() {
  const { toast } = useToast();

  // State
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // Invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceBookingId, setInvoiceBookingId] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, linesRes] = await Promise.all([
        fetch('/api/wifi/billing/summary'),
        fetch('/api/wifi/billing'),
      ]);

      const summaryJson = await summaryRes.json();
      const linesJson = await linesRes.json();

      if (summaryJson.success) setSummary(summaryJson.data);
      if (linesJson.success) setLines(linesJson.data || []);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load billing data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchKey, fetchData]);

  const refresh = () => setFetchKey((k) => k + 1);

  // Billing run confirmation dialog
  const [billingConfirmOpen, setBillingConfirmOpen] = useState(false);
  const [billingCooldown, setBillingCooldown] = useState(0);

  useEffect(() => {
    if (billingCooldown > 0) {
      const timer = setTimeout(() => setBillingCooldown(billingCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [billingCooldown]);

  // Handle manual billing run
  const handleRunBilling = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/wifi/billing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (json.success) {
        const result = json.data as BillingResult;
        toast({
          title: 'Billing Run Complete',
          description: `${result.processed} processed, ${result.postedToFolio} posted, ${result.totalCharged.toFixed(2)} charged${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''}`,
        });
        refresh();
      } else {
        toast({
          title: 'Billing Run Failed',
          description: json.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to trigger billing run',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Handle invoice generation
  const handleGenerateInvoice = async () => {
    if (!invoiceBookingId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a booking ID',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingInvoice(true);
    try {
      const res = await fetch('/api/wifi/billing/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: invoiceBookingId.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Invoice Generated',
          description: `Invoice ${json.data.invoiceNumber} created for $${json.data.totalAmount.toFixed(2)}`,
        });
        setInvoiceDialogOpen(false);
        setInvoiceBookingId('');
        refresh();
      } else {
        toast({
          title: 'Invoice Generation Failed',
          description: json.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate invoice',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const monthOverMonth = summary && summary.lastMonth > 0
    ? (((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            WiFi Billing
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track charges, run billing, and generate invoices for guest WiFi usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate WiFi Invoice</DialogTitle>
                <DialogDescription>
                  Create an invoice for all WiFi charges on a guest&apos;s booking folio.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <label className="text-sm font-medium mb-2 block">Booking ID</label>
                <Input
                  placeholder="Enter booking ID (UUID)"
                  value={invoiceBookingId}
                  onChange={(e) => setInvoiceBookingId(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateInvoice} disabled={isGeneratingInvoice}>
                  {isGeneratingInvoice ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            onClick={() => setBillingConfirmOpen(true)}
            disabled={isRunning || billingCooldown > 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {billingCooldown > 0 ? `Run Billing (${billingCooldown}s)` : 'Run Billing'}
          </Button>

          <AlertDialog open={billingConfirmOpen} onOpenChange={setBillingConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Billing Cycle?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mass-charge all guest WiFi usage since the last billing run. Charges will be posted to guest folios. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setBillingConfirmOpen(false); setBillingCooldown(3); handleRunBilling(); }}>
                  Yes, Run Billing
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ──────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Billed */}
          <Card className="border-0 shadow-sm bg-primary/5 dark:bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Total Billed</span>
                <div className="rounded-md bg-primary/10 dark:bg-primary/10 p-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(summary.totalBilled)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.lineCount} line items
              </p>
            </CardContent>
          </Card>

          {/* Posted to Folio */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Posted to Folio</span>
                <div className="rounded-md bg-emerald-100 dark:bg-emerald-900/40 p-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(summary.totalPosted)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Charges on guest folios</p>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Pending</span>
                <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 p-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(summary.totalPending)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting folio posting</p>
            </CardContent>
          </Card>

          {/* This Month */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">This Month</span>
                <div className="rounded-md bg-blue-100 dark:bg-blue-900/40 p-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(summary.thisMonth)}
              </p>
              {monthOverMonth !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {Number(monthOverMonth) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-primary" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${Number(monthOverMonth) >= 0 ? 'text-primary' : 'text-red-600'}`}>
                    {Number(monthOverMonth) >= 0 ? '+' : ''}{monthOverMonth}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Charge Type Breakdown ──────────────────────────────────── */}
      {summary && Object.keys(summary.byChargeType).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Breakdown by Charge Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(summary.byChargeType).map(([type, amount]) => (
                <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background shadow-sm">
                    {getChargeTypeIcon(type)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Invoice Lines Table ─────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Charges</CardTitle>
          <CardDescription className="text-xs">
            WiFi billing line items sorted by most recent
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No billing records</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Run a billing cycle to generate charges
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Guest</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Charge Type</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Data Used</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {line.guest
                              ? `${line.guest.firstName} ${line.guest.lastName}`
                              : '—'}
                          </p>
                          {line.booking && (
                            <p className="text-[10px] text-muted-foreground">
                              {line.booking.confirmationCode}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{line.plan?.name || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getChargeTypeBadgeVariant(line.chargeType)}
                          className="text-xs gap-1"
                        >
                          {getChargeTypeIcon(line.chargeType)}
                          {line.chargeType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(line.totalAmount, line.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs tabular-nums">
                          {line.dataUsedMb > 0 ? `${line.dataUsedMb.toFixed(1)} MB` : '—'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(line.status)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(line.periodStart), 'MMM d HH:mm')}
                          {' → '}
                          {format(new Date(line.periodEnd), 'MMM d HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(line.createdAt), 'MMM d, HH:mm')}
                        </span>
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
  );
}
