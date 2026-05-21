'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, Hotel, Eye, EyeOff, Sparkles, ChevronRight, ShieldCheck, Crown, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

/* ─── Keyframes injected once ─── */
const FORM_KEYFRAMES = `
@keyframes formGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes formFadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes formScaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes formShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes formGlowPulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.65; }
}
@keyframes formLogoFloat {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-4px); }
}
`;

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await onLogin(email, password);
      
      if (!result.success) {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const demoUser = process.env.NEXT_PUBLIC_DEMO_USER || '';
  const demoPass = process.env.NEXT_PUBLIC_DEMO_PASS || '';
  const demoCredentials = showDemoCredentials && demoUser && demoPass ? [
    { role: 'Demo', email: demoUser, password: demoPass, color: 'bg-gradient-to-br from-orange-600 to-amber-600' },
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const demoCredentials = showDemoCredentials ? [
    { role: 'Admin', email: 'admin@royalstay.in', password: 'admin123', color: 'bg-gradient-to-br from-orange-600 to-amber-600' },
    { role: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-amber-500 to-orange-500' },
    { role: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-orange-500 to-amber-500' },
  ] : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORM_KEYFRAMES }} />

      <div className="w-full max-w-md">
        {/* ── Premium Card with Orange/White ── */}
        <div
          className="rounded-2xl border border-orange-100/40 dark:border-orange-900/30 bg-white/80 dark:bg-[#1a1210]/80 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(180,83,9,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] transition-shadow duration-500 hover:shadow-[0_16px_48px_-12px_rgba(180,83,9,0.15)] dark:hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]"
          style={{ animation: 'formScaleIn 0.5s ease-out both' }}
        >
          <div className="p-8">

            {/* Header */}
            <div className="text-center mb-7">
              <div
                className="flex justify-center mb-4"
                style={{ animation: 'formLogoFloat 4s ease-in-out infinite' }}
              >
                <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500 p-3.5 shadow-xl shadow-orange-500/30 ring-2 ring-orange-400/20 transition-transform hover:scale-110 duration-300">
                  <Hotel className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle
                className="text-2xl font-bold tracking-tight"
                style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.1s both' }}
              >
                StaySuite
              </CardTitle>
              <CardDescription
                className="mt-1.5"
                style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.15s both' }}
              >
                Sign in to your account to continue
              </CardDescription>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div style={{ animation: 'formScaleIn 0.3s ease-out' }}>
                  <Alert variant="destructive" className="rounded-xl border-0">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              <div
                className="space-y-2"
                style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.2s both' }}
              >
                <Label htmlFor="email" className="text-sm font-semibold tracking-wide">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white/50 dark:bg-[#1a1210]/60 border-orange-100/60 dark:border-orange-900/30 rounded-xl transition-all duration-300 focus:bg-white dark:focus:bg-[#1a1210] focus:border-orange-400 focus:ring-2 focus:ring-orange-500/25 hover:border-orange-200/80 dark:hover:border-orange-700/40 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              <div
                className="space-y-2"
                style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.3s both' }}
              >
                <Label htmlFor="password" className="text-sm font-semibold tracking-wide">Password</Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10 bg-white/50 dark:bg-[#1a1210]/60 border-orange-100/60 dark:border-orange-900/30 rounded-xl transition-all duration-300 focus:bg-white dark:focus:bg-[#1a1210] focus:border-orange-400 focus:ring-2 focus:ring-orange-500/25 hover:border-orange-200/80 dark:hover:border-orange-700/40 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-300/40 hover:text-orange-500 transition-colors duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.35s both' }}>
                <Button
                  type="submit"
                  className={cn(
                    "w-full h-11 rounded-xl font-semibold text-sm transition-all duration-300",
                    "bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-gray-100",
                    "text-white dark:text-neutral-900",
                    "shadow-lg shadow-neutral-900/20 hover:shadow-xl hover:shadow-neutral-900/25 dark:shadow-white/10 dark:hover:shadow-white/15",
                    "hover:-translate-y-0.5 active:translate-y-0",
                    "disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-lg",
                    "relative overflow-hidden"
                  )}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Sign in
                    </span>
                  )}
                  {/* Shimmer overlay on loading */}
                  {isLoading && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'formShimmer 1.5s infinite',
                      }}
                    />
                  )}
                </Button>
              </div>
            </form>

            {/* ── Demo Credentials (dev only) ── */}
            {showDemoCredentials && (
            <div className="mt-7" style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.4s both' }}>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="bg-orange-100/50 dark:bg-orange-900/30" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white/70 dark:bg-[#1a1210]/70 backdrop-blur-2xl px-3 text-xs text-muted-foreground/60 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-orange-400" />
                    Demo accounts
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {demoCredentials.map((cred, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setEmail(cred.email);
                      setPassword(cred.password);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left",
                      "border-orange-100/50 dark:border-orange-900/30",
                      "bg-white/30 dark:bg-[#1a1210]/30",
                      "transition-all duration-300",
                      "hover:bg-white/60 dark:hover:bg-[#1a1210]/60",
                      "hover:border-orange-200/60 dark:hover:border-orange-700/40",
                      "hover:shadow-md hover:shadow-orange-900/5 dark:hover:shadow-orange-900/20",
                      "hover:-translate-y-0.5 active:translate-y-0",
                      "group"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110",
                      cred.color
                    )}>
                      <span className="text-white text-xs font-semibold">{cred.role.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{cred.role}</div>
                      <div className="text-xs text-muted-foreground/40 truncate">{cred.email}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-orange-400/30 transition-all duration-300 group-hover:text-orange-400 group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* ── Footer ── */}
            <div className="mt-6 pt-5 border-t border-orange-100/30 dark:border-orange-900/20 text-center" style={{ animation: 'formFadeSlideUp 0.5s ease-out 0.45s both' }}>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/40">
                <ShieldCheck className="h-3 w-3" />
                <span>Enterprise-grade security</span>
              </div>
              <p className="text-[11px] text-muted-foreground/30 mt-2">
                &copy; 2026 Cryptsk Pvt Ltd. All rights reserved.
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
