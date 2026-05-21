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
  Crown,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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

// Framer-motion variants — premium feel with smoother easing
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 24, mass: 0.9 },
  },
};

const headerVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 240, damping: 22 },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 22, delay: 0.15 + i * 0.06 },
  }),
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 22, delay: 0.5 + i * 0.07 },
  }),
};

const errorVariants = {
  hidden: { opacity: 0, scale: 0.92, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 450, damping: 24 },
  },
  exit: { opacity: 0, scale: 0.92, y: -6, transition: { duration: 0.15 } },
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

  // Quick Admin Login — uses env var credentials in demo mode
  const handleQuickAdminLogin = async () => {
    const demoUser = process.env.NEXT_PUBLIC_DEMO_USER;
    const demoPass = process.env.NEXT_PUBLIC_DEMO_PASS;
    if (!demoUser || !demoPass) {
      setError('Demo credentials not configured.');
      return;
    }

    setError('');
    setIsQuickLogin(true);

    try {
      const result = await login(demoUser, demoPass, false);

      if (result.success) {
        if (result.requireTwoFactor) {
          setRequireTwoFactor(true);
          setTempToken(result.tempToken || '');
          setEmail(demoUser);
        }
        toast({
          title: 'Demo Access',
          description: 'Logged in with demo credentials',
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

  // Show loading while checking auth state — clean white loader
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1a1210]">
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 flex items-center justify-center">
            <Hotel className="h-7 w-7 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-bounce [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-bounce [animation-delay:300ms]" />
          </div>
        </motion.div>
      </div>
    );
  }

  // Demo credentials are only available when NEXT_PUBLIC_DEMO_MODE is explicitly enabled
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const demoUser = process.env.NEXT_PUBLIC_DEMO_USER || '';
  const demoPass = process.env.NEXT_PUBLIC_DEMO_PASS || '';
  const demoCredentials = showDemoCredentials && demoUser && demoPass ? [
    { role: 'Demo', email: demoUser, password: demoPass, color: 'bg-gradient-to-br from-violet-500 to-purple-600', ring: 'ring-violet-500/30', icon: Shield, barColor: 'bg-violet-500', textColor: 'text-violet-700 dark:text-violet-300', borderColor: 'hover:border-violet-300/60 dark:hover:border-violet-700/40', bgColor: 'bg-violet-50/40 dark:bg-violet-950/20' },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* ═══════════════════════════════════════════
            LEFT SIDE - Premium Brand with Image Slideshow
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
                transform: currentSlide === index ? 'scale(1.04)' : 'scale(1)',
                transition: 'opacity 1.8s ease-in-out, transform 10s ease-out',
              }}
            />
          ))}

          {/* Clean dark overlay — no orange tint */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/50" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />

          {/* Content overlay */}
          <motion.div
            className="relative z-10 flex flex-col justify-between p-10 xl:p-14 2xl:p-16 w-full"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Logo */}
            <motion.div className="flex items-center gap-3.5" variants={headerVariants}>
              <div className="h-12 w-12 rounded-xl overflow-hidden transition-transform hover:scale-110 duration-300">
                <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={48} height={48} className="object-contain w-full h-full" loading="eager" priority />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-orange-100 to-amber-100 bg-clip-text text-transparent">
                  StaySuite
                </h1>
                <p className="text-amber-200/70 text-xs font-medium tracking-wide">by Cryptsk Pvt Ltd</p>
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
                  <p className="text-sm text-orange-200/70 font-medium tracking-wide">
                    {slideshowImages[currentSlide].alt}
                  </p>
                  <h2 className="text-3xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
                    Manage your property
                    <br />
                    <span className="bg-gradient-to-r from-orange-200 via-amber-200 to-yellow-100 bg-clip-text text-transparent">
                      with intelligence.
                    </span>
                  </h2>
                </motion.div>
              </AnimatePresence>

              {/* Feature badges + stats — premium pill design */}
              <div className="flex flex-wrap items-center gap-2.5">
                {[
                  { label: 'WiFi AAA Ready', icon: Wifi },
                  { label: 'Guest Management', icon: Globe },
                  { label: 'Smart Billing', icon: Star },
                ].map(({ label, icon: BadgeIcon }) => (
                  <span
                    key={label}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-semibold tracking-wide hover:bg-white/15 hover:border-white/25 transition-all duration-300 cursor-default inline-flex items-center gap-1.5 uppercase"
                  >
                    <BadgeIcon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
                <span className="text-orange-300/40 text-xs mx-1">|</span>
                <span className="text-sm text-orange-100/90 font-semibold">2,500+ properties</span>
                <span className="w-1 h-1 rounded-full bg-orange-400/40" />
                <span className="text-sm text-orange-100/90 font-semibold">150 countries</span>
              </div>

              {/* Slide navigation dots + arrows */}
              <div className="flex items-center gap-4">
                {/* Prev arrow */}
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => goToSlide((currentSlide - 1 + slideshowImages.length) % slideshowImages.length)}
                  className="h-9 w-9 rounded-full bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all duration-300"
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
                            ? 'w-8 h-2 bg-gradient-to-r from-orange-300 to-amber-300'
                            : 'w-2 h-2 bg-white/30 group-hover:bg-white/50'
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
                  className="h-9 w-9 rounded-full bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all duration-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Progress bar */}
                <div className="ml-2 w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-400/70 to-amber-300/70 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: SLIDE_INTERVAL / 1000, ease: 'linear' }}
                    key={currentSlide}
                  />
                </div>
              </div>
            </motion.div>


          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT SIDE - Premium Login Form
            ═══════════════════════════════════════════ */}

        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex-1 min-h-screen lg:min-h-0">
          {/* Plain white background */}
          <div className="absolute inset-0 bg-white dark:bg-[#1a1210]" />


          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen lg:min-h-screen p-4 sm:p-6 lg:p-8 py-8 lg:py-0 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-[420px] lg:max-w-[380px] flex flex-col">

              {/* Mobile Logo — premium treatment */}
              <motion.div
                className="lg:hidden flex items-center justify-center gap-3.5 mb-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <div className="h-12 w-12 rounded-xl overflow-hidden">
                  <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={48} height={48} className="object-contain w-full h-full" loading="eager" priority />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-orange-700 via-amber-600 to-orange-500 bg-clip-text text-transparent">
                    StaySuite
                  </h1>
                  <p className="text-muted-foreground text-[11px] tracking-wider font-medium uppercase">Hospitality OS</p>
                </div>
              </motion.div>

              {/* ══ Clean Card ══ */}
              <div className="relative rounded-2xl overflow-hidden">
              <motion.div
                className="rounded-2xl bg-white dark:bg-[#1a1210] border border-orange-100/50 dark:border-orange-900/30 shadow-sm relative overflow-hidden"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{
                  boxShadow: '0 4px 16px -4px rgba(0,0,0,0.1)',
                  transition: { duration: 0.3, ease: 'easeOut' },
                }}
              >
                {/* Clean orange accent line on top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-10 bg-orange-500" />

                <div className="p-6 sm:p-7 lg:p-8 relative z-10">

                  {/* Header — refined premium look */}
                  <div className="mb-7">
                    <motion.div
                      className="flex items-center gap-2.5 mb-2"
                      variants={headerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-amber-400 to-orange-300" />
                      <h2 className="text-xl font-bold text-foreground tracking-tight">
                        {requireTwoFactor ? 'Two-factor authentication' : t('signIn')}
                      </h2>
                    </motion.div>
                    <motion.p
                      className="text-sm text-muted-foreground/70 font-medium pl-[18px]"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.08 }}
                    >
                      {requireTwoFactor
                        ? 'Enter your verification code'
                        : t('signInToYourAccountToContinue')}
                    </motion.p>

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
                              <Alert variant="destructive" role="alert" className="border-red-200/70 dark:border-red-800/70 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm rounded-xl">
                                <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                  {error}
                                </AlertDescription>
                              </Alert>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Email field — premium warm styling */}
                        <motion.div
                          className="space-y-2"
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={0}
                        >
                          <Label htmlFor="email" className="text-sm font-semibold text-foreground/80 tracking-wide">
                            {t('email')}
                          </Label>
                          <div className="relative group/input">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 transition-colors duration-300 group-focus-within/input:text-orange-500" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@company.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="relative pl-11 h-[52px] bg-white dark:bg-[#1a1210] border-orange-100/60 dark:border-orange-900/30 rounded-xl transition-all duration-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25 hover:border-orange-200/80 dark:hover:border-orange-700/40 text-[15px] placeholder:text-foreground/30"
                              required
                              disabled={isLoading}
                              autoComplete="email"
                            />
                          </div>
                        </motion.div>

                        {/* Password field — premium warm styling */}
                        <motion.div
                          className="space-y-2"
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={1}
                        >
                          <div className="flex items-center">
                            <Label htmlFor="password" className="text-sm font-semibold text-foreground/80 tracking-wide">
                              {t('password')}
                            </Label>
                            <button
                              type="button"
                              className="ml-auto text-xs text-muted-foreground/60 hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200 font-medium"
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
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 transition-colors duration-300 group-focus-within/input:text-orange-500" />
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="relative pl-11 pr-11 h-[52px] bg-white dark:bg-[#1a1210] border-orange-100/60 dark:border-orange-900/30 rounded-xl transition-all duration-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25 hover:border-orange-200/80 dark:hover:border-orange-700/40 text-[15px] placeholder:text-foreground/30"
                              required
                              disabled={isLoading}
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground/40 hover:text-orange-500 transition-colors duration-200"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>

                        </motion.div>

                        {/* Remember me — refined */}
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
                                className="h-[18px] w-[18px] rounded-md border-orange-200/80 dark:border-orange-800/50 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 data-[state=checked]:text-white transition-all duration-300 focus-visible:ring-2 focus-visible:ring-orange-500/25 focus-visible:ring-offset-1 hover:border-orange-400/70"
                              />
                            </div>
                            <Label htmlFor="remember" className="text-sm text-muted-foreground/70 font-medium cursor-pointer select-none hover:text-muted-foreground transition-colors duration-200">
                              {t('rememberMe')}
                            </Label>
                          </div>
                        </motion.div>

                        {/* Sign In Button — premium gradient */}
                        <motion.div
                          variants={fieldVariants}
                          initial="hidden"
                          animate="visible"
                          custom={3}
                        >
                          <Button
                            type="submit"
                            className={cn(
                              "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300",
                              "bg-orange-500 hover:bg-orange-600",
                              "active:scale-[0.99]",
                              "text-white",
                              "hover:-translate-y-0.5 active:translate-y-0",
                              "disabled:opacity-70 disabled:hover:translate-y-0 disabled:active:scale-100"
                            )}
                            disabled={isLoading}
                          >
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
                              <span className="relative flex items-center justify-center gap-2">
                                <KeyRound className="h-4 w-4" />
                                {t('signIn')}
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        {/* Quick Admin Login Button — refined orange outline */}
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
                                "border-orange-200/70 dark:border-orange-800/40",
                                "bg-orange-50/40 dark:bg-orange-950/20",
                                "text-orange-700 dark:text-orange-300",
                                "hover:bg-orange-100/60 dark:hover:bg-orange-900/30",
                                "hover:border-orange-300/70 dark:hover:border-orange-700/50",
                                "active:scale-[0.99]",
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
                                  <Zap className="h-4 w-4 text-orange-500" />
                                  Quick Admin Login
                                </span>
                              )}
                            </Button>
                          </motion.div>
                        )}

                        {/* Secure connection indicator */}
                        <motion.div
                          className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-muted-foreground/40 font-medium"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6, duration: 0.5 }}
                        >
                          <Shield className="h-3 w-3" />
                          <span>Secured with 256-bit encryption</span>
                        </motion.div>
                      </form>
                    ) : (
                      /* ═══ 2FA Form — premium orange ═══ */
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
                              <Alert variant="destructive" role="alert" className="border-red-200/70 dark:border-red-800/70 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm rounded-xl">
                                <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                  {error}
                                </AlertDescription>
                              </Alert>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex justify-center py-4">
                          <div className="h-14 w-14 rounded-2xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                            <Shield className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                          </div>
                        </div>

                        <p className="text-sm text-center text-muted-foreground/70">
                          Enter the 6-digit code from your authenticator app.
                        </p>

                        <div className="space-y-2">
                          <Label htmlFor="twoFactorCode" className="text-sm font-semibold text-foreground/80 tracking-wide">Code</Label>
                          <Input
                            id="twoFactorCode"
                            type="text"
                            placeholder="000000"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-xl tracking-[0.3em] font-mono h-12 rounded-xl bg-white dark:bg-[#1a1210] border-orange-100/60 dark:border-orange-900/30 transition-all duration-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25"
                            maxLength={6}
                            disabled={isLoading}
                            autoFocus
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-300 bg-orange-500 hover:bg-orange-600 text-white hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-70 disabled:hover:translate-y-0"
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
                          className="w-full rounded-xl transition-all duration-200 text-muted-foreground/60 hover:text-foreground"
                          onClick={handleBackToLogin}
                          disabled={isLoading}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {t('backToLogin')}
                        </Button>
                      </form>
                    )}

                    {/* ── Demo Credentials — premium orange cards ── */}
                    {!requireTwoFactor && showDemoCredentials && (
                      <motion.div
                        className="pt-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55, duration: 0.4 }}
                      >
                        {/* Demo Mode badge */}
                        <div className="flex justify-center mb-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30 text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" />
                            Demo Mode
                          </span>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <Separator className="bg-orange-100/50 dark:bg-orange-900/30" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-white/60 dark:bg-[#1a1210]/60 backdrop-blur-xl px-3 text-xs text-muted-foreground/60 flex items-center gap-1.5 font-medium">
                              <Sparkles className="h-3 w-3 text-orange-400" />
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
                                  scale: 1.01,
                                  y: -2,
                                  transition: { type: 'spring', stiffness: 400, damping: 20 },
                                }}
                                whileTap={{ scale: 0.99, y: 0 }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left",
                                  "border-border/60",
                                  "bg-white/30 dark:bg-[#1a1210]/30",
                                  "backdrop-blur-sm",
                                  "transition-all duration-300",
                                  "hover:bg-white/60 dark:hover:bg-[#1a1210]/60",
                                  cred.borderColor,
                                  "group",
                                  "relative overflow-hidden"
                                )}
                              >
                                {/* Left color bar with role accent */}
                                <div className={cn("absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all duration-300 group-hover:w-[4px] group-hover:top-0 group-hover:bottom-0", cred.barColor)} />
                                <motion.div
                                  className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center",
                                    cred.color
                                  )}
                                  whileHover={{ scale: 1.08, rotate: 2 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  <CredIcon className="h-5 w-5 text-white" />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className={cn("text-sm font-semibold", cred.textColor)}>{cred.role}</div>
                                  <div className="text-xs text-muted-foreground/40 truncate">{cred.email}</div>
                                </div>
                                <motion.div
                                  className={cn("h-6 w-6 rounded-lg flex items-center justify-center", cred.bgColor)}
                                  whileHover={{ x: 2 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                >
                                  <ChevronRight className={cn("h-3 w-3", cred.textColor, "opacity-50")} />
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
                <p className="text-sm text-muted-foreground/60">
                  Have a license key?{' '}
                  <button
                    className="text-orange-600 dark:text-orange-400 font-semibold hover:text-orange-700 dark:hover:text-orange-300 transition-colors duration-200 underline-offset-4 hover:underline inline-flex items-center gap-1"
                    onClick={() => router.push('/register')}
                  >
                    Activate your plan
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </p>
                <p className="text-xs text-muted-foreground/40">
                  Don&apos;t have a key?{' '}
                  <button
                    className="text-muted-foreground/60 hover:text-muted-foreground font-medium transition-colors duration-200 underline-offset-4 hover:underline"
                    onClick={() => router.push('/register')}
                  >
                    Register with a trial key
                  </button>
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
