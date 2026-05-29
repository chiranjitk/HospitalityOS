'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  private handleGoToDashboard = () => {
    // Dynamically import the store to avoid circular deps and use getState
    import('@/store').then(({ useUIStore }) => {
      useUIStore.getState().setActiveSection('overview');
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private getTitle(): string {
    const { section, error } = this.props;
    const message = error?.message || '';
    if (section) {
      if (message.includes('render') || message.includes('Render')) {
        return `Rendering Error in ${section}`;
      }
      if (message.includes('network') || message.includes('fetch') || message.includes('Network')) {
        return `Connection Error in ${section}`;
      }
      return `Error in ${section}`;
    }
    if (message.includes('render') || message.includes('Render')) {
      return 'Rendering Error';
    }
    return 'Something Went Wrong';
  }

  private getDescription(): string {
    const message = this.state.error?.message || '';
    if (message.includes('render') || message.includes('Render')) {
      return 'This section encountered an error while rendering. The component may have received unexpected data or an internal logic error occurred.';
    }
    return 'An unexpected error occurred while processing this section. This is usually a temporary issue that can be resolved by trying again.';
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const hasStack = !!this.state.error?.stack;
      const title = this.getTitle();
      const description = this.getDescription();

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
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
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
                  Try Again
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
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
