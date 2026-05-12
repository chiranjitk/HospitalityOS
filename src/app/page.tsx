'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle, HomeIcon, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { SectionHeader } from '@/components/common/section-header';
import { SectionLoadingSkeleton } from '@/components/sections/section-loading-skeleton';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function getErrorType(error: string): 'timeout' | 'not-found' | 'load-failure' {
  if (error.includes('timed out')) return 'timeout';
  if (error.includes('No component found')) return 'not-found';
  return 'load-failure';
}

function getErrorConfig(error: string) {
  const type = getErrorType(error);
  switch (type) {
    case 'timeout':
      return {
        title: 'Loading Took Too Long',
        description:
          'This section is taking longer than expected to load. This could be due to a slow network connection or a temporary server issue. Please try refreshing the page.',
      };
    case 'not-found':
      return {
        title: 'Section Not Available',
        description:
          'The requested section could not be found. It may have been moved, renamed, or is currently under maintenance. You can go back to the dashboard or try refreshing.',
      };
    case 'load-failure':
    default:
      return {
        title: 'Something Went Wrong',
        description:
          'An unexpected error occurred while loading this section. This is usually temporary — try refreshing the page or navigating back to the dashboard.',
      };
  }
}

function SectionLoadError({
  error,
  onGoToDashboard,
}: {
  error: string;
  onGoToDashboard: () => void;
}) {
  const tDash = useTranslations('dashboard');
  const { title, description } = getErrorConfig(error);

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-lg border-0 shadow-lg">
        <CardContent className="flex flex-col items-center text-center gap-6 pt-8 pb-6">
          {/* Gradient Icon Container */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 dark:shadow-amber-500/10">
            <AlertTriangle className="h-10 w-10 text-white" />
            {/* Subtle ring effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-20 blur-xl" />
          </div>

          {/* Text Content */}
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {/* Error Detail (subtle) */}
          <p className="text-xs text-muted-foreground/70 font-mono bg-muted/50 px-3 py-1.5 rounded-md max-w-full truncate">
            {error}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:justify-center pt-1">
            <Button
              onClick={onGoToDashboard}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 dark:bg-teal-500 dark:hover:bg-teal-600 dark:shadow-teal-500/10 w-full sm:w-auto"
            >
              <HomeIcon className="h-4 w-4" />
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2 w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              {tDash('refreshPage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionContent({ section }: { section: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tCommon = useTranslations('common');
  const tDash = useTranslations('dashboard');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setComp(null);

    const timeout = setTimeout(() => {
      if (!cancelled) setError(`Loading timed out for: ${section}`);
    }, 30000);

    import('@/components/sections/loaders/master-loader')
      .then(async (masterModule) => {
        if (cancelled) return;
        try {
          const mod = await masterModule.default(section);
          if (cancelled) return;
          clearTimeout(timeout);
          const Component = mod?.default || Object.values(mod || {}).find(
            (v: any) => typeof v === 'function' && v.toString().length > 0
          ) as React.ComponentType<any>;
          if (Component) {
            setComp(() => Component);
          } else {
            setError(`No component found for: ${section}`);
          }
        } catch (err: any) {
          if (cancelled) return;
          clearTimeout(timeout);
          setError(`Failed to load ${section}: ${err?.message || 'Unknown error'}`);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setError(`Failed to load section loader: ${err?.message || 'Unknown error'}`);
        console.error('SectionContent failed:', section, err);
      });

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [section]);

  const handleGoToDashboard = () => {
    useUIStore.getState().setActiveSection('overview');
  };

  if (error) {
    return <SectionLoadError error={error} onGoToDashboard={handleGoToDashboard} />;
  }

  if (!Comp) {
    return <SectionLoadingSkeleton section={section} />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader sectionId={section} />
      <ErrorBoundary section={section}>
        <Comp />
      </ErrorBoundary>
    </div>
  );
}

export default function Home() {
  const { activeSection } = useUIStore();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          <p className="text-muted-foreground text-sm">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.995 }}
          transition={{
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <SectionContent key={activeSection} section={activeSection} />
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );
}
