'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Hotel,
  Eye,
  EyeOff,
  Shield,
  ArrowLeft,
  Mail,
  Lock,
  ChevronRight,
  Sparkles,
  Bed,
  ConciergeBell,
  Bath,
  Star,
  ChevronLeft,
  Zap,
  AlertCircle,
  Globe,
  Wifi,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/* ─── Login keyframes are defined in globals.css ─── */

// AI-generated hotel & resort slideshow images
const slideshowImages = [
  { src: '/images/login-slide-1.png', alt: 'Luxury hotel exterior at golden hour' },
  { src: '/images/login-slide-2.png', alt: 'Resort swimming pool at twilight' },
  { src: '/images/login-slide-3.png', alt: 'Grand hotel lobby interior' },
  { src: '/images/login-slide-4.png', alt: 'Luxury suite with ocean view' },
  { src: '/images/login-slide-5.png', alt: 'Tropical beach resort aerial' },
];

const SLIDE_INTERVAL = 6000; // 6 seconds per slide

// Framer-motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 220, damping: 22, mass: 0.8 },
  },
};

const headerVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24, delay: 0.12 + i * 0.07 },
  }),
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 22, delay: 0.5 + i * 0.08 },
  }),
};

const errorVariants = {
  hidden: { opacity: 0, scale: 0.9, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.9, y: -8, transition: { duration: 0.15 } },
};

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickLogin, setIsQuickLogin] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { login, completeTwoFactorLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-sliding carousel
  const startSlideshow = useCallback(() => {
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, SLIDE_INTERVAL);
  }, []);

  useEffect(() => {
    startSlideshow();
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [startSlideshow]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    startSlideshow(); // Reset timer on manual navigation
  }, [startSlideshow]);

  // Check for OAuth messages
  useEffect(() => {
    const oauthError = searchParams.get('error');
    const message = searchParams.get('message');

    if (oauthError) {
      setTimeout(() => setError(decodeURIComponent(oauthError)), 0);
    } else if (message === 'google_linked') {
      toast({
        title: 'Google Account Linked',
        description: 'Your Google account has been successfully linked.',
      });
    }
  }, [searchParams, toast]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password, rememberMe);

      if (result.success) {
        if (result.requireTwoFactor) {
          setRequireTwoFactor(true);
          setTempToken(result.tempToken || '');
        }
      } else {
        setError(result.error || t('loginError'));
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Admin Login — directly calls the auth API
  const handleQuickAdminLogin = async () => {
    setError('');
    setIsQuickLogin(true);

    try {
      const result = await login('admin@royalstay.in', 'admin123', false);

      if (result.success) {
        if (result.requireTwoFactor) {
          setRequireTwoFactor(true);
          setTempToken(result.tempToken || '');
          setEmail('admin@royalstay.in');
        }
        toast({
          title: 'Admin Access',
          description: 'Logged in as admin@royalstay.in',
        });
      } else {
        setError(result.error || t('loginError'));
      }
    } catch {
      setError('Quick login failed. Please try manually.');
    } finally {
      setIsQuickLogin(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await completeTwoFactorLogin(email, tempToken, twoFactorCode, rememberMe);

      if (!result.success) {
        setError(result.error || 'Invalid verification code');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequireTwoFactor(false);
    setTwoFactorCode('');
    setTempToken('');
    setError('');
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Hotel className="h-6 w-6 text-white" />
          </div>
          <div className="h-4 w-24 bg-gradient-to-r from-orange-500/30 to-amber-500/30 rounded animate-pulse" />
        </motion.div>
      </div>
    );
  }

  // Demo credentials are only available in development mode
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const demoCredentials = showDemoCredentials ? [
    { role: 'Admin', email: 'admin@royalstay.in', password: 'admin123', color: 'bg-gradient-to-br from-violet-600 to-purple-600', ring: 'ring-violet-500/30', icon: Shield, barColor: 'bg-amber-400' },
    { role: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-teal-500 to-emerald-500', ring: 'ring-teal-500/30', icon: ConciergeBell, barColor: 'bg-teal-400' },
    { role: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-amber-500 to-orange-500', ring: 'ring-amber-500/30', icon: Bath, barColor: 'bg-violet-400' },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* ═══════════════════════════════════════════
            LEFT SIDE - Brand with AI Image Slideshow
            ═══════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
          {/* Slideshow images - crossfade between them */}
          {slideshowImages.map((img, index) => (
            <div
              key={img.src}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${img.src})`,
                opacity: currentSlide === index ? 1 : 0,
                transform: currentSlide === index ? 'scale(1.03)' : 'scale(1)',
                transition: 'opacity 1.5s ease-in-out, transform 8s ease-out',
              }}
            />
          ))}

          {/* Multi-layer overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/50" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-slate-950/95 to-transparent" />

          {/* Animated glow orbs - colorful */}
          <div
            className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-teal-400/20 blur-[100px]"
            style={{ animation: 'loginGlowPulse 6s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-emerald-400/15 blur-[80px]"
            style={{ animation: 'loginGlowPulse 8s ease-in-out infinite 2s' }}
          />
          <div
            className="absolute top-[60%] right-[10%] w-40 h-40 rounded-full bg-cyan-400/10 blur-[70px]"
            style={{ animation: 'loginGlowPulse 7s ease-in-out infinite 4s' }}
          />

          {/* Content overlay */}
          <motion.div
            className="relative z-10 flex flex-col justify-between p-10 xl:p-14 2xl:p-16 w-full"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Logo */}
            <motion.div className="flex items-center gap-3" variants={headerVariants}>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/30 transition-transform hover:scale-110 duration-300">
                <Hotel className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-teal-100 to-emerald-100 bg-clip-text text-transparent animate-[subtleShimmer_3s_ease-in-out_infinite]">
                  StaySuite
                </h1>
                <p className="text-emerald-200/80 text-xs font-medium">by Cryptsk Pvt Ltd</p>
              </div>
            </motion.div>

            {/* Spacer */}
            <div />

            {/* Bottom section with tagline, badges, and slide navigation */}
            <motion.div className="space-y-8" variants={headerVariants}>
              {/* Slide caption */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-slate-300/80 font-medium">
                    {slideshowImages[currentSlide].alt}
                  </p>
                  <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                    Manage your property
                    <br />
                    <span className="bg-gradient-to-r from-teal-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                      with intelligence.
                    </span>
                  </h2>
                </motion.div>
              </AnimatePresence>

              {/* Feature badges + stats */}
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { label: 'WiFi AAA Ready', icon: Wifi },
                  { label: 'Guest Management', icon: Globe },
                  { label: 'Smart Billing', icon: Star },
                ].map(({ label, icon: BadgeIcon }) => (
                  <span
                    key={label}
                    className="px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 hover:border-white/30 transition-all duration-300 cursor-default inline-flex items-center gap-1.5"
                  >
                    <BadgeIcon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
                <span className="text-slate-300/70 text-xs">|</span>
                <span className="text-sm text-slate-200 font-medium">2,500+ properties</span>
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                <span className="text-sm text-slate-200 font-medium">150 countries</span>
              </div>

              {/* Slide navigation dots + arrows */}
              <div className="flex items-center gap-4">
                {/* Prev arrow */}
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => goToSlide((currentSlide - 1 + slideshowImages.length) % slideshowImages.length)}
                  className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all duration-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Dots */}
                <div className="flex items-center gap-2">
                  {slideshowImages.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={"Go to slide " + (index + 1)}
                      onClick={() => goToSlide(index)}
                      className="group relative"
                    >
                      <div
                        className={cn(
                          'rounded-full transition-all duration-500',
                          currentSlide === index
                            ? 'w-8 h-2 bg-white/70'
                            : 'w-2 h-2 bg-white/40 group-hover:bg-white/60'
                        )}
                      />
                    </button>
                  ))}
                </div>

                {/* Next arrow */}
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => goToSlide((currentSlide + 1) % slideshowImages.length)}
                  className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all duration-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Progress bar */}
                <div className="ml-2 w-16 h-1 rounded-full bg-white/15 overflow-hidden">
                  <motion.div
                    className="h-full bg-white/50 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: SLIDE_INTERVAL / 1000, ease: 'linear' }}
                    key={currentSlide}
                  />
                </div>
              </div>
            </motion.div>

            {/* Left-side Footer */}
            <motion.div
              className="flex items-center gap-4 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <span>&copy; 2026 Cryptsk Pvt Ltd</span>
              <span>&middot;</span>
              <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy</span>
              <span>&middot;</span>
              <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms</span>
            </motion.div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT SIDE - Login Form
            ═══════════════════════════════════════════ */}

        {/* Clean professional background */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex-1 min-h-screen lg:min-h-0">
          {/* Mobile: animated gradient background */}
          <div
            className="lg:hidden absolute inset-0 dark:hidden"
            style={{
              background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 25%, #f0fdfa 50%, #fefce8 75%, #f0fdfa 100%)',
              backgroundSize: '400% 400%',
              animation: 'loginMobileGradient 12s ease infinite',
            }}
          />
          {/* Mobile dark mode: deeper animated gradient background */}
          <div
            className="lg:hidden hidden dark:block absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #042f2e 0%, #022c22 25%, #042f2e 50%, #1c1917 75%, #042f2e 100%)',
              backgroundSize: '400% 400%',
              animation: 'loginMobileGradient 12s ease infinite',
            }}
          />
          {/* Desktop: subtle gradient with glow accents */}
          <div
            className="hidden lg:block absolute inset-0 bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
          />

          {/* Mobile-only: floating decorative orb behind the login card */}
          <div
            className="lg:hidden absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)',
              animation: 'loginGlowPulse 8s ease-in-out infinite, floatOrb1 20s ease-in-out infinite',
            }}
          />

          {/* Desktop-only: two very subtle, static, non-animated glow accents */}
          <div
            className="hidden lg:block absolute top-[10%] left-[5%] w-[400px] h-[400px] rounded-full opacity-20 blur-[120px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 70%)',
            }}
          />
          <div
            className="hidden lg:block absolute bottom-[10%] right-[5%] w-[350px] h-[350px] rounded-full opacity-15 blur-[100px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
            }}
          />

          {/* Decorative floating elements on right panel */}
          <div className="absolute top-[8%] right-[8%] w-3 h-3 rounded-full bg-gradient-to-br from-teal-400/20 to-emerald-400/20 animate-pulse pointer-events-none hidden lg:block" />
          <div className="absolute bottom-[15%] left-[6%] w-2 h-2 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 animate-bounce [animation-delay:1s] pointer-events-none hidden lg:block" />
          <div className="absolute top-[45%] right-[4%] w-2.5 h-2.5 rounded-full bg-gradient-to-br from-emerald-400/15 to-cyan-400/15 animate-pulse [animation-delay:2s] pointer-events-none hidden lg:block" />

          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen lg:min-h-screen p-4 sm:p-6 lg:p-8 py-8 lg:py-0 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-[400px] lg:max-w-[360px] flex flex-col">

              {/* Mobile Logo */}
              <motion.div
                className="lg:hidden flex items-center justify-center gap-3 mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/30 drop-shadow-[0_0_8px_rgba(251,146,60,0.35)]">
                  <Hotel className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-cyan-600 bg-clip-text text-transparent drop-shadow-sm">
                    StaySuite
                  </h1>
                  <p className="text-muted-foreground text-[11px] tracking-wide font-medium">Hospitality OS</p>
                </div>
              </motion.div>

              {/* ── Glass Card with Animated Gradient Border ── */}
              <div className="relative rounded-[17px] p-[1px] bg-gradient-to-br from-teal-500/30 via-emerald-500/10 to-amber-500/30 overflow-hidden">
                {/* Animated spinning conic gradient layer for border shimmer */}
                <div className="absolute inset-0 overflow-hidden rounded-[17px] pointer-events-none">
                  <div
                    className="absolute inset-[-200%] animate-[spin_8s_linear_infinite]"
                    style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(20,184,166,0.12) 15%, transparent 30%, rgba(16,185,129,0.08) 45%, transparent 60%, rgba(245,158,11,0.08) 75%, transparent 90%)' }}
                  />
                </div>
              <motion.div
                className="rounded-2xl bg-white/80 dark:bg-gray-950/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-lg shadow-[inset_0_0_30px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_0_30px_rgba(255,255,255,0.03),0_8px_40px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{
                  boxShadow: '0_16px_48px_-12px_rgba(0,0,0,0.12),0_0_24px_rgba(20,184,166,0.08)',
                  y: -1,
                  transition: { duration: 0.3, ease: 'easeOut' },
                }}
              >
                {/* Animated gradient accent line on top */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-10"
                  style={{
                    background: 'linear-gradient(90deg, #10b981, #14b8a6, #06b6d4, #8b5cf6, #10b981)',
                    backgroundSize: '300% 100%',
                    animation: 'loginAccentFlow 4s ease infinite',
                  }}
                />

                <div className="p-5 sm:p-6 lg:p-8 relative z-10">

                  {/* Header */}
                  <div className="mb-7">
                    <motion.div
                      className="flex items-center gap-2 mb-2"
                      variants={headerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 via-emerald-400 to-cyan-500" />
                      <h2 className="text-xl font-bold text-foreground tracking-tight text-shadow-sm">
                        {requireTwoFactor ? 'Two-factor authentication' : t('signIn')}
                      </h2>
                    </motion.div>
                    <motion.p
                      className="text-sm text-muted-foreground/80 font-medium pl-3"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
                    >
                      {requireTwoFactor
                        ? 'Enter your verification code'
                        : t('signInToYourAccountToContinue')}
                    </motion.p>
                    {/* Trusted by badge with Shield icon */}
                    <motion.div
                      className="mt-3 pl-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}
                    >
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <Shield className="h-3 w-3" />
                        Trusted by 2,500+ properties
                      </span>
                    </motion.div>
                  </div>

                  {/* Form */}
                  <div className="space-y-5">
                    {!requireTwoFactor ? (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                          {error && (
                            <motion.div
                              key="login-error"
                              variants={errorVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                            >
                              <Alert variant="destructive" role="alert" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
                                <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                  {error}
                                </AlertDescription>
                              </Alert>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Email field */}
                        <motion.div
                          className="space-y-2"
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={0}
                        >
                          <Label htmlFor="email" className="text-sm font-semibold text-foreground/80">
                            {t('email')}
                          </Label>
                          <div className="relative group/input">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                            <div className="absolute inset-0 rounded-xl bg-teal-500/0 blur-sm transition-all duration-300 group-focus-within/input:bg-teal-500/5 group-focus-within/input:blur-md pointer-events-none" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@company.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="relative pl-11 h-[52px] bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30 hover:border-teal-300/70 dark:hover:border-teal-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
                              required
                              disabled={isLoading}
                              autoComplete="email"
                            />
                          </div>
                        </motion.div>

                        {/* Password field */}
                        <motion.div
                          className="space-y-2"
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={1}
                        >
                          <div className="flex items-center">
                            <Label htmlFor="password" className="text-sm font-semibold text-foreground/80">
                              {t('password')}
                            </Label>
                            <button
                              type="button"
                              className="ml-auto text-xs text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors duration-200 font-medium"
                              onClick={async () => {
                                if (!email) {
                                  toast({
                                    title: 'Email Required',
                                    description: 'Please enter your email address first.',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                                try {
                                  const res = await fetch('/api/auth/forgot-password', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email }),
                                  });
                                  if (!res.ok) {
                                    const data = await res.json().catch(() => ({}));
                                    toast({
                                      title: 'Error',
                                      description: data?.error?.message || data?.message || 'Failed to send reset email.',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  toast({
                                    title: t('checkYourEmail'),
                                    description: t('weveSentPasswordResetInstructionsToYourEmail'),
                                  });
                                } catch {
                                  toast({
                                    title: 'Error',
                                    description: 'Failed to send reset email.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              {t('forgotPassword')}
                            </button>
                          </div>
                          <div className="mt-1 relative group/input">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                            <div className="absolute inset-0 rounded-xl bg-teal-500/0 blur-sm transition-all duration-300 group-focus-within/input:bg-teal-500/5 group-focus-within/input:blur-md pointer-events-none" />
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="relative pl-11 pr-11 h-[52px] bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30 hover:border-teal-300/70 dark:hover:border-teal-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
                              required
                              disabled={isLoading}
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground/30 hover:text-teal-500 transition-all duration-200 hover:scale-110 active:scale-95"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>
                          {showDemoCredentials && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground/50 font-medium pl-1 flex items-center gap-1">
                              <Zap className="h-3 w-3 text-amber-500/70" />
                              Use admin123 for quick demo access
                            </p>
                          )}
                        </motion.div>

                        {/* Remember me */}
                        <motion.div
                          className="flex items-center justify-between"
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={2}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center">
                              <Checkbox
                                id="remember"
                                checked={rememberMe}
                                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                className="h-[18px] w-[18px] rounded-md border-slate-300/80 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 data-[state=checked]:text-white transition-all duration-300 focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-1 hover:border-teal-400/80"
                              />
                            </div>
                            <Label htmlFor="remember" className="text-sm text-muted-foreground/80 font-medium cursor-pointer select-none hover:text-muted-foreground transition-colors duration-200">
                              {t('rememberMe')}
                            </Label>
                          </div>
                        </motion.div>

                        {/* Sign In Button */}
                        <motion.div
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={3}
                        >
                          <Button
                            type="submit"
                            className={cn(
                              "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-200",
                              "bg-gradient-to-r from-teal-600 to-emerald-600",
                              "hover:from-teal-500 hover:to-emerald-500",
                              "hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-[1.02]",
                              "active:scale-[0.98]",
                              "dark:from-teal-500 dark:to-emerald-500",
                              "text-white",
                              "hover:-translate-y-0.5 active:translate-y-0",
                              "disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none disabled:active:scale-100 disabled:hover:scale-100",
                              "relative overflow-hidden"
                            )}
                            style={{ animation: 'loginBtnPulseGlow 3s ease-in-out infinite' }}
                            disabled={isLoading}
                          >
                            {/* Shimmer overlay */}
                            <span
                              className="absolute inset-0 pointer-events-none"
                              style={{ overflow: 'hidden', borderRadius: 'inherit' }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                                  animation: 'loginBtnShimmer 3s ease-in-out infinite',
                                }}
                              />
                            </span>
                            {/* Loading progress bar */}
                            {isLoading && (
                              <motion.div
                                className="absolute bottom-0 left-0 h-[2px] bg-white/60 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, ease: 'linear' }}
                              />
                            )}
                            {isLoading ? (
                              <span className="relative flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('signingIn')}
                              </span>
                            ) : (
                              <span className="relative flex items-center justify-center gap-1.5">
                                {t('signIn')}
                                <ChevronRight className="h-4 w-4" />
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        {/* Quick Admin Login Button */}
                        {showDemoCredentials && (
                          <motion.div
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                            custom={4}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleQuickAdminLogin}
                              disabled={isQuickLogin || isLoading}
                              className={cn(
                                "w-full h-10 rounded-xl font-medium text-sm transition-all duration-300",
                                "border-violet-200/60 dark:border-violet-700/40",
                                "bg-violet-50/50 dark:bg-violet-900/20",
                                "text-violet-700 dark:text-violet-300",
                                "hover:bg-violet-100/70 dark:hover:bg-violet-800/30",
                                "hover:border-violet-300/60 dark:hover:border-violet-600/50",
                                "hover:shadow-[0_4px_20px_-6px_rgba(139,92,246,0.15)]",
                                "active:scale-[0.98]",
                                "disabled:opacity-60"
                              )}
                            >
                              {isQuickLogin ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Logging in as Admin...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-violet-500" />
                                  Quick Admin Login
                                </span>
                              )}
                            </Button>
                          </motion.div>
                        )}

                        {/* Secure connection indicator */}
                        <motion.div
                          className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-muted-foreground/60 font-medium"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6, duration: 0.5 }}
                        >
                          <Shield className="h-3 w-3" />
                          <span>Secured with 256-bit encryption</span>
                        </motion.div>
                      </form>
                    ) : (
                      /* ═══ 2FA Form ═══ */
                      <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                          {error && (
                            <motion.div
                              key="2fa-error"
                              variants={errorVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                            >
                              <Alert variant="destructive" role="alert" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
                                <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                  {error}
                                </AlertDescription>
                              </Alert>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex justify-center py-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-200 dark:from-teal-900/40 dark:to-emerald-800/40 flex items-center justify-center shadow-md">
                            <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                          </div>
                        </div>

                        <p className="text-sm text-center text-muted-foreground">
                          Enter the 6-digit code from your authenticator app.
                        </p>

                        <div className="space-y-2">
                          <Label htmlFor="twoFactorCode">Code</Label>
                          <Input
                            id="twoFactorCode"
                            type="text"
                            placeholder="000000"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-xl tracking-[0.3em] font-mono h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/80 transition-all duration-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
                            maxLength={6}
                            disabled={isLoading}
                            autoFocus
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 relative overflow-hidden"
                          disabled={isLoading || twoFactorCode.length < 6}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            'Verify'
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full rounded-xl transition-all duration-200"
                          onClick={handleBackToLogin}
                          disabled={isLoading}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {t('backToLogin')}
                        </Button>
                      </form>
                    )}

                    {/* ── Demo Credentials ── */}
                    {!requireTwoFactor && showDemoCredentials && (
                      <motion.div
                        className="pt-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55, duration: 0.4 }}
                      >
                        {/* Demo Mode badge */}
                        <div className="flex justify-center mb-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" />
                            Demo Mode
                          </span>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <Separator className="bg-slate-200/40 dark:bg-slate-700/40" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl px-3 text-xs text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                              <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                              {t('demoAccounts')}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {demoCredentials.map((cred, index) => {
                            const CredIcon = cred.icon;
                            return (
                              <motion.button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setEmail(cred.email);
                                  setPassword(cred.password);
                                }}
                                variants={badgeVariants}
                                initial="hidden"
                                animate="visible"
                                custom={index}
                                whileHover={{
                                  scale: 1.02,
                                  y: -2,
                                  transition: { type: 'spring', stiffness: 400, damping: 20 },
                                }}
                                whileTap={{ scale: 0.99, y: 0 }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left",
                                  "border-slate-200/50 dark:border-slate-700/50",
                                  "bg-white/30 dark:bg-slate-900/30",
                                  "backdrop-blur-sm",
                                  "transition-all duration-300",
                                  "hover:bg-white/60 dark:hover:bg-slate-900/60",
                                  "hover:border-teal-300/60 dark:hover:border-teal-600/40",
                                  "hover:shadow-[0_8px_24px_-8px_rgba(20,184,166,0.12)]",
                                  "group",
                                  "relative overflow-hidden"
                                )}
                              >
                                {/* Left color bar with role accent */}
                                <div className={cn("absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all duration-300 group-hover:w-[4px] group-hover:top-0 group-hover:bottom-0", cred.barColor)} />
                                <motion.div
                                  className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-md ring-2 ring-white/30 dark:ring-slate-700/30",
                                    cred.color
                                  )}
                                  whileHover={{ scale: 1.1, rotate: 3 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  <CredIcon className="h-5 w-5 text-white" />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-foreground">{cred.role}</div>
                                  <div className="text-xs text-muted-foreground/50 truncate">{cred.email}</div>
                                </div>
                                <motion.div
                                  className="h-6 w-6 rounded-lg flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80"
                                  whileHover={{ x: 2 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                >
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                                </motion.div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
              </div>

              {/* ── Register with license key link ── */}
              <motion.div
                className="mt-6 text-center space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <p className="text-sm text-muted-foreground">
                  Have a license key?{' '}
                  <button
                    className="text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-700 dark:hover:text-teal-300 transition-colors duration-200 underline-offset-4 hover:underline inline-flex items-center gap-1"
                    onClick={() => router.push('/register')}
                  >
                    Activate your plan
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Don&apos;t have a key?{' '}
                  <button
                    className="text-muted-foreground/80 hover:text-muted-foreground font-medium transition-colors duration-200 underline-offset-4 hover:underline"
                    onClick={() => router.push('/register')}
                  >
                    Register with a trial key
                  </button>
                </p>
              </motion.div>

              {/* ── System Status indicator ── */}
              <motion.div
                className="flex items-center justify-end gap-1.5 mt-4 text-[11px] text-muted-foreground/60 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  style={{ animation: 'loginGlowPulse 3s ease-in-out infinite' }}
                />
                <span>All systems operational</span>
              </motion.div>

              {/* ── Mobile footer (sticky at bottom when content is short) ── */}
              <div className="flex-1" />
              {/* Gradient divider above mobile footer */}
              <div className="lg:hidden h-px bg-gradient-to-r from-transparent via-teal-400/30 dark:via-teal-500/20 to-transparent mt-4" />

              <div className="lg:hidden text-center text-xs text-muted-foreground/80 pt-4 mt-0 border-t border-border/50">
                <p className="flex items-center justify-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Powered by StaySuite HospitalityOS
                  <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 font-mono text-[10px]">v2.0</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sticky footer for desktop (below the flex row) ═══ */}
      {/* Subtle gradient divider above desktop footer */}
      <div className="hidden lg:block h-px bg-gradient-to-r from-transparent via-teal-400/30 dark:via-teal-500/20 to-transparent" />

      <div className="hidden lg:flex items-center justify-center py-3 px-4 bg-background/80 dark:bg-background/40 backdrop-blur-sm border-t border-border/30 text-xs text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-500" />
          <span>Powered by StaySuite HospitalityOS</span>
        </span>
        <span className="mx-2">&middot;</span>
        <span>&copy; 2026 Cryptsk Pvt Ltd</span>
        <span className="mx-2">&middot;</span>
        <span className="hover:text-muted-foreground transition-colors cursor-pointer">Privacy</span>
        <span className="mx-2">&middot;</span>
        <span className="hover:text-muted-foreground transition-colors cursor-pointer">Terms</span>
        <span className="mx-2">&middot;</span>
        <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 font-mono text-[10px]">v2.0</span>
      </div>
    </div>
  );
}
