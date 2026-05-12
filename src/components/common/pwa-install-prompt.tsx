'use client';

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PwaInstallPrompt() {
  const { isInstallable, isInstalled, isStandalone, install, dismiss } = usePwaInstall();

  // Don't show if: already installed, in standalone mode, or not installable
  // (isInstallable already accounts for recent dismissal)
  if (isInstalled || isStandalone || !isInstallable) return null;

  const handleInstall = async () => {
    await install();
  };

  const handleDismiss = () => {
    dismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm"
      >
        <div className="bg-card border border-border rounded-xl shadow-lg shadow-black/10 p-4 flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Install StaySuite</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to your home screen for quick access and offline support.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3 w-3" />
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}