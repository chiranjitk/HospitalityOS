'use client';

/**
 * Guest WiFi Onboarding Card
 *
 * Guides admins through the WiFi setup process with a step-by-step checklist:
 * 1. Configure RADIUS Server
 * 2. Add NAS Clients
 * 3. Create Bandwidth Plans
 * 4. Set Up Captive Portal
 * 5. Test Connectivity
 *
 * Shows green checkmark for complete, gray for not started.
 * Displays overall progress percentage.
 * Only visible if setup is incomplete (< 100%).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Circle,
  Server,
  Radio,
  Gauge,
  Globe,
  PlayCircle,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

type StepStatus = 'complete' | 'partial' | 'not_started';

interface SetupStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  detail: string;
  count: number;
}

interface SetupProgressData {
  steps: SetupStep[];
  completedSteps: number;
  totalSteps: number;
  progressPercent: number;
  isComplete: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

interface TestResults {
  radius_config?: TestResult;
  nas_clients?: TestResult;
  database?: TestResult;
  wifi_users?: TestResult;
  captive_portal?: TestResult;
}

// ─── Step Icons ──────────────────────────────────────────────────────────────

const stepIcons: Record<string, React.ReactNode> = {
  'radius-server': <Server className="h-4 w-4" />,
  'nas-clients': <Radio className="h-4 w-4" />,
  'bandwidth-plans': <Gauge className="h-4 w-4" />,
  'captive-portal': <Globe className="h-4 w-4" />,
  'test-connectivity': <PlayCircle className="h-4 w-4" />,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function GuestWifiOnboarding() {
  const [data, setData] = useState<SetupProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const { toast } = useToast();

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/setup-progress');
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Auto-dismiss if setup is complete
  useEffect(() => {
    if (data?.isComplete) {
      setIsDismissed(true);
    }
  }, [data?.isComplete]);

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/wifi/setup-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-connectivity' }),
      });
      const result = await res.json();

      if (result.success && result.data) {
        setTestResults(result.data.results);
        toast({
          title: result.data.passed ? 'All Tests Passed' : 'Some Tests Failed',
          description: result.data.summary,
          variant: result.data.passed ? 'default' : 'destructive',
        });
        // Re-fetch progress after test
        fetchProgress();
      } else {
        toast({
          title: 'Test Failed',
          description: result.error?.message || 'Failed to run connectivity test',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Test Failed',
        description: 'Could not reach the server',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Don't render if dismissed, loading, or complete
  if (isDismissed || (data?.isComplete)) return null;

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/3">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-2 w-full" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/3 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Gauge className="h-4 w-4 text-primary" />
              </div>
              WiFi Setup Progress
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Complete these steps to get your guest WiFi up and running
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
              {data.progressPercent}%
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss setup guide"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={data.progressPercent} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{data.completedSteps} of {data.totalSteps} steps complete</span>
            <span>{data.progressPercent}%</span>
          </div>
        </div>

        {/* Steps checklist */}
        <div className="space-y-2">
          {data.steps.map((step, idx) => (
            <StepRow
              key={step.id}
              step={step}
              index={idx}
              isLast={idx === data.steps.length - 1}
              testResults={testResults}
              isTesting={isTesting}
              onRunTest={step.id === 'test-connectivity' ? handleRunTest : undefined}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step Row Component ──────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  isLast,
  testResults,
  isTesting,
  onRunTest,
}: {
  step: SetupStep;
  index: number;
  isLast: boolean;
  testResults: TestResults | null;
  isTesting: boolean;
  onRunTest?: () => void;
}) {
  const isComplete = step.status === 'complete';
  const isPartial = step.status === 'partial';

  const getStatusIcon = () => {
    if (isComplete) {
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    }
    if (isPartial) {
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/50 border border-border/50">
        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  };

  // For the test-connectivity step, show test results
  const testKey = step.id === 'test-connectivity' ? step.id : undefined;

  return (
    <div className="flex items-start gap-3">
      {/* Timeline connector + icon */}
      <div className="flex flex-col items-center">
        {getStatusIcon()}
        {/* Connector line */}
        {!isLast && (
          <div className={cn(
            'w-px h-6 mt-1',
            isComplete ? 'bg-emerald-500/30' : 'bg-border/50'
          )} />
        )}
      </div>

      {/* Step content */}
      <div className={cn('flex-1 min-w-0 pb-2', isLast ? 'pb-0' : 'pb-1')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-xs font-medium',
              isComplete ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {step.label}
            </span>
            {isComplete && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                {step.count > 0 ? step.count : 'Done'}
              </Badge>
            )}
          </div>

          {/* Run Test button for connectivity step */}
          {step.id === 'test-connectivity' && onRunTest && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 rounded-md px-2 shrink-0"
              onClick={onRunTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PlayCircle className="h-3 w-3" />
              )}
              {isTesting ? 'Testing...' : 'Run Test'}
            </Button>
          )}
        </div>
        <p className={cn(
          'text-[11px] mt-0.5',
          isComplete ? 'text-muted-foreground' : 'text-muted-foreground/70'
        )}>
          {step.detail}
        </p>

        {/* Test results for connectivity step */}
        {testKey && testResults && (
          <div className="mt-2 space-y-1">
            {Object.entries(testResults).map(([key, result]) => (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                {result.ok ? (
                  <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                )}
                <span className={cn(
                  'font-mono',
                  result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-muted-foreground truncate">{result.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GuestWifiOnboarding;
