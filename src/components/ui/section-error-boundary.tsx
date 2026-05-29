'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  section: string;
  /** Called when user clicks Retry — parent should increment a key to force re-mount */
  onRetry?: () => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

/**
 * Lightweight per-section error boundary.
 *
 * Catches rendering / lifecycle errors in a single section so that
 * one crashing section cannot take down the rest of the app.
 *
 * Features:
 * - Displays the section name in the error message
 * - Retry button (calls onRetry to force a full re-mount via key change)
 * - Go to Dashboard button
 * - Report Issue placeholder link
 * - Expandable error details (for dev / debug)
 * - Logs error + component stack in componentDidCatch
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  public state: SectionErrorBoundaryState = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { section } = this.props;
    console.error(
      `[SectionErrorBoundary] Section "${section}" crashed:`,
      error.message,
      errorInfo.componentStack
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    // Allow React to re-render children once with the old state before re-mounting
    // The parent's onRetry will increment a key to force a full re-mount
    requestAnimationFrame(() => {
      this.props.onRetry?.();
    });
  };

  private handleGoToDashboard = () => {
    // Dynamic import to avoid circular dependencies
    import('@/store').then(({ useUIStore }) => {
      useUIStore.getState().setActiveSection('overview');
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private getSectionLabel(): string {
    const { section } = this.props;
    // Turn kebab-case into a readable title: "room-service" → "Room Service"
    return section
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getErrorDescription(): string {
    const message = this.state.error?.message || '';
    if (message.includes('render') || message.includes('Render')) {
      return 'This section encountered an error while rendering. The component may have received unexpected data or an internal logic error occurred.';
    }
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('Network') ||
      message.includes('Failed to fetch')
    ) {
      return 'A network error occurred while this section was running. Check your connection and try again.';
    }
    if (message.includes('hydrat') || message.includes('Hydrat')) {
      return 'A hydration mismatch was detected in this section. This can happen when server and client rendered different content.';
    }
    return 'An unexpected error occurred in this section. This is usually temporary and can be resolved by retrying.';
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const sectionLabel = this.getSectionLabel();
    const description = this.getErrorDescription();
    const hasStack = !!this.state.error?.stack;

    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="w-full max-w-lg border-0 shadow-lg">
          <CardContent className="flex flex-col items-center text-center gap-6 pt-8 pb-6">
            {/* Gradient Icon Container */}
            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 dark:shadow-amber-500/10">
              <AlertTriangle className="h-10 w-10 text-white" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-20 blur-xl" />
            </div>

            {/* Text Content */}
            <div className="space-y-2 max-w-sm">
              <h2 className="text-xl font-semibold text-foreground">
                {sectionLabel} — Error
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
              {this.state.error?.message && (
                <p className="text-xs font-mono bg-muted/50 px-3 py-1.5 rounded-md text-muted-foreground/70 break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>

            {/* Toggle Details */}
            {hasStack && (
              <button
                onClick={this.toggleDetails}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {this.state.showDetails ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Show Details
                  </>
                )}
              </button>
            )}

            {/* Expandable Stack Trace */}
            {hasStack && this.state.showDetails && (
              <div className="w-full max-w-md">
                <pre className="p-3 bg-muted/80 dark:bg-muted/50 rounded-lg text-xs text-left text-muted-foreground overflow-auto max-h-48 border border-border/50">
                  {this.state.error!.stack!.split('\n').slice(0, 15).join('\n')}
                </pre>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:justify-center pt-1">
              <Button
                onClick={this.handleRetry}
                className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 dark:bg-teal-500 dark:hover:bg-teal-600 dark:shadow-teal-500/10 w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoToDashboard}
                className="gap-2 w-full sm:w-auto"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>

            {/* Report Issue Link */}
            <a
              href="mailto:support@hotel-pms.app?subject=Section%20Error%20Report&body=Section%3A%20"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              title="Report this issue to the support team"
            >
              <ExternalLink className="h-3 w-3" />
              Report Issue
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }
}
