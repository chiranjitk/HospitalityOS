'use client';

import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { FEATURES } from '@/lib/feature-flags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, ArrowUpRight } from 'lucide-react';

interface FeatureGuardProps {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
  onUpgrade?: () => void;
}

export function FeatureGuard({ 
  featureId, 
  children, 
  fallback, 
  showUpgrade = true,
  onUpgrade 
}: FeatureGuardProps) {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isFeatureEnabled(featureId)) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  if (showUpgrade) {
    const featureName = FEATURES[featureId]?.name || featureId;
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">
              {featureName} — Premium Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This feature is not enabled for your current plan. 
              Upgrade to unlock this feature and more.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button onClick={onUpgrade || (() => window.location.href = '#settings-features')}>
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade Plan
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No display if feature disabled and no upgrade prompt
  return null;
}

// Compact version for inline use
export function FeatureBadge({ featureId }: { featureId: string }) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (isFeatureEnabled(featureId)) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded dark:bg-amber-950 dark:text-amber-400">
      <Lock className="h-3 w-3" />
      Premium
    </span>
  );
}

// Higher-order component version
export function withFeatureGuard<P extends object>(
  featureId: string,
  options: Omit<FeatureGuardProps, 'featureId' | 'children'> = {}
) {
  return function WrappedComponent(Component: React.ComponentType<P>) {
    return function FeatureGuarded(props: P) {
      return (
        <FeatureGuard featureId={featureId} {...options}>
          <Component {...props} />
        </FeatureGuard>
      );
    };
  };
}
