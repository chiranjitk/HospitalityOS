'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useUIStore, useAuthStore } from '@/store';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Heart, Globe, Shield, Zap, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { CommandPalette } from '@/components/common/command-palette';

import { QuickActionsFAB } from '@/components/common/quick-actions-fab';

interface AppLayoutProps {
  children: React.ReactNode;
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-300',
        'hover:shadow-xl hover:scale-110',
        'active:scale-95',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const t = useTranslations('layout');
  const { sidebarCollapsed } = useUIStore();
  const { user, setLoading, setProperties, setCurrentProperty } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load properties from API and set currentProperty
  useEffect(() => {
    const { currentProperty, properties } = useAuthStore.getState();

    // Already have properties loaded
    if (currentProperty || properties.length > 0) {
      if (properties.length > 0 && !currentProperty) {
        setCurrentProperty(properties[0]);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/properties')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProperties(data.data);
          setCurrentProperty(data.data[0]);
        }
      })
      .catch((err) => {
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [setLoading, setProperties, setCurrentProperty]);

  // Sync browser back/forward with Zustand activeSection
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== useUIStore.getState().activeSection) {
        useUIStore.getState().setActiveSection(hash);
      }
    };

    // Read initial hash on mount (deep-linking support)
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && initialHash !== useUIStore.getState().activeSection) {
      useUIStore.getState().setActiveSection(initialHash);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-background relative app-background overflow-x-hidden">
      {/* Command Palette — global overlay */}
      <CommandPalette />
      {/* Decorative background elements - theme-specific */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-start/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-20 w-60 h-60 bg-gradient-end/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-gradient-start/5 rounded-full blur-3xl" />
      </div>
      
      {/* Sidebar - handles both mobile and desktop */}
      <Sidebar 
        mobileOpen={mobileSidebarOpen} 
        onMobileClose={() => setMobileSidebarOpen(false)} 
      />
      
      {/* Header */}
      <Header onMenuClick={() => setMobileSidebarOpen(true)} />

      {/* Main Content */}
      <main className={cn(
        "relative z-10 transition-[margin] duration-300 pt-14 sm:pt-5 pb-2 px-2 sm:px-3 lg:px-4", // pt-14 to offset sticky header, minimal padding
        "flex-1", // Fill remaining vertical space so footer sticks to bottom
        "ml-0 lg:ml-[260px]", // No margin on mobile, 260px on desktop
        sidebarCollapsed && "lg:ml-[68px]" // Collapsed width only on desktop
      )}>
        {children}

        {/* Back to Top floating button */}
        <BackToTopButton />
      </main>

      {/* Quick Actions FAB — floating button for mobile/tablet */}
      {user && <QuickActionsFAB />}

      {/* Sticky Footer — only shown when authenticated */}
      {user && (
        <footer className={cn(
          "relative z-10 mt-auto transition-[margin] duration-300 ml-0 lg:ml-[260px]",
          sidebarCollapsed && "lg:ml-[68px]"
        )}>
          <Separator className="opacity-20" />
          {/* Animated gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-[gradientSlide_6s_ease-in-out_infinite]" />
          </div>
          <div className="px-4 py-3.5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-screen-xl mx-auto">
              {/* Left — Branding */}
              <div className="flex items-center gap-2.5">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white shadow-sm shadow-primary/20"
                >
                  <Zap className="h-3 w-3" />
                </motion.div>
                <p className="text-[11px] text-muted-foreground/60">
                  &copy; 2026{' '}
                  <span className="font-semibold text-muted-foreground/80">StaySuite</span>{' '}
                  by{' '}
                  <span className="font-medium text-muted-foreground/70">Cryptsk Pvt Ltd</span>
                </p>
                <motion.span
                  whileHover={{ scale: 1.3, rotate: 15 }}
                  className="text-muted-foreground/25 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Heart className="h-3 w-3 fill-current" />
                </motion.span>
              </div>

              {/* Center — Feature Pills (desktop only) */}
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/25 border border-border/15 transition-all duration-200 hover:bg-muted/40 hover:border-border/25 hover:shadow-sm">
                  <Shield className="h-2.5 w-2.5 text-primary/50" />
                  <span className="text-[10px] text-muted-foreground/50 font-medium">SOC 2</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/25 border border-border/15 transition-all duration-200 hover:bg-muted/40 hover:border-border/25 hover:shadow-sm">
                  <Globe className="h-2.5 w-2.5 text-primary/50" />
                  <span className="text-[10px] text-muted-foreground/50 font-medium">Multi-Tenant</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/25 border border-border/15 transition-all duration-200 hover:bg-muted/40 hover:border-border/25 hover:shadow-sm">
                  <Zap className="h-2.5 w-2.5 text-amber-500/50" />
                  <span className="text-[10px] text-muted-foreground/50 font-medium">24/7 Support</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/25 border border-border/15 transition-all duration-200 hover:bg-muted/40 hover:border-border/25 hover:shadow-sm">
                  <Heart className="h-2.5 w-2.5 text-rose-400/50" />
                  <span className="text-[10px] text-muted-foreground/50 font-medium">Made in India</span>
                </div>
              </div>

              {/* Right — Version */}
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0 h-4.5 font-mono border-primary/15 text-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary/25 transition-all duration-200">
                  v1.2.0
                </Badge>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
