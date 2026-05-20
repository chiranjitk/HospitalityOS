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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="h-12 w-12 rounded-xl bg-orange-600 flex items-center justify-center">
            <Hotel className="h-6 w-6 text-white" />
          </div>
          <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
        </motion.div>
      </div>
    );
  }

  // Demo credentials are only available in development mode
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const demoCredentials = showDemoCredentials ? [
    { role: 'Admin', email: 'admin@royalstay.in', password: 'admin123', color: 'bg-orange-600', ring: 'ring-orange-500/30', icon: Shield, barColor: 'bg-orange-400' },
    { role: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123', color: 'bg-amber-500', ring: 'ring-amber-500/30', icon: ConciergeBell, barColor: 'bg-amber-400' },
    { role: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123', color: 'bg-orange-500', ring: 'ring-orange-500/30', icon: Bath, barColor: 'bg-orange-400' },
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

          {/* Clean dark overlay */}
          <div className="absolute inset-0 bg-black/60" />

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
                <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={48} height={48} className="object-contain w-full h-full" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  StaySuite
                </h1>
                <p className="text-white/50 text-xs font-medium tracking-wide">by Cryptsk Pvt Ltd</p>
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
                  <p className="text-sm text-white/60 font-medium tracking-wide">
                    {slideshowImages[currentSlide].alt}
                  </p>
                  <h2 className="text-3xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
                    Manage your property
                    <br />
                    <span className="text-white">
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
                <span className="text-white/20 text-xs mx-1">|</span>
                <span className="text-sm text-white/80 font-semibold">2,500+ properties</span>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span className="text-sm text-white/80 font-semibold">150 countries</span>
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
                            ? 'w-8 h-2 bg-white'
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


              </div>
            </motion.div>

            {/* Left-side Footer */}
            <motion.div
              className="flex items-center gap-4 text-xs text-white/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <span>&copy; 2026 Cryptsk Pvt Ltd</span>
              <span>&middot;</span>
              <span className="hover:text-white/70 transition-colors cursor-pointer">Privacy</span>
              <span>&middot;</span>
              <span className="hover:text-white/70 transition-colors cursor-pointer">Terms</span>
            </motion.div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT SIDE - Premium Login Form
            ═══════════════════════════════════════════ */}

        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex-1 min-h-screen lg:min-h-0 bg-white">
          {/* Clean white background - no gradients or effects */}

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
                  <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={48} height={48} className="object-contain w-full h-full" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    StaySuite
                  </h1>
                  <p className="text-muted-foreground text-[11px] tracking-wider font-medium uppercase">Hospitality OS</p>
                </div>
              </motion.div>

              {/* ══ Clean Login Card ══ */}
              <motion.div
                className="rounded-2xl bg-white border border-gray-200 shadow-sm relative overflow-hidden"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="p-6 sm:p-7 lg:p-8">

                  {/* Header — refined premium look */}
                  <div className="mb-7">
                    <motion.div
                      className="flex items-center gap-2.5 mb-2"
                      variants={headerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="h-7 w-1.5 rounded-full bg-orange-500" />
                      <h2 className="text-xl font-bold text-foreground tracking-tight">
                        {requireTwoFactor ? 'Two-factor authentication' : t('signIn')}
                      </h2>
                    </motion.div>
                    <motion.p
                      className="text-sm text-gray-600 font-medium pl-[18px]"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.08 }}
                    >
                      {requireTwoFactor
                        ? 'Enter your verification code'
                        : t('signInToYourAccountToContinue')}
                    </motion.p>
                    {/* Premium trust badge */}
                    <motion.div
                      className="mt-3.5 pl-[18px]"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.12 }}
                    >
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-semibold text-orange-600 tracking-wide">
                        <Crown className="h-3 w-3" />
                        Trusted by 2,500+ premium properties
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
                          <Label htmlFor="email" className="text-sm font-semibold text-gray-700 tracking-wide">
                            {t('email')}
                          </Label>
                          <div className="relative group/input">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@company.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="relative pl-11 h-[52px] bg-white border-gray-200 rounded-xl transition-all duration-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 hover:border-gray-300 text-[15px] placeholder:text-gray-400"
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
                            <Label htmlFor="password" className="text-sm font-semibold text-gray-700 tracking-wide">
                              {t('password')}
                            </Label>
                            <button
                              type="button"
                              className="ml-auto text-xs text-gray-500 hover:text-orange-600 transition-colors duration-200 font-medium"
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
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="relative pl-11 pr-11 h-[52px] bg-white border-gray-200 rounded-xl transition-all duration-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 hover:border-gray-300 text-[15px] placeholder:text-gray-400"
                              required
                              disabled={isLoading}
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>
                          {showDemoCredentials && (
                            <p className="mt-1.5 text-[11px] text-orange-600 dark:text-orange-400 font-medium pl-1 flex items-center gap-1">
                              <Zap className="h-3 w-3 text-amber-500/60" />
                              Use admin123 for quick demo access
                            </p>
                          )}
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
                            <Label htmlFor="remember" className="text-sm text-gray-600 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors duration-200">
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
                            className="w-full h-12 rounded-xl font-semibold text-sm transition-colors duration-200 bg-orange-600 hover:bg-orange-700 text-white active:scale-[0.99] disabled:opacity-70"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('signingIn')}
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-2">
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
                                "w-full h-10 rounded-xl font-medium text-sm transition-colors duration-200",
                                "border-gray-200",
                                "bg-gray-50",
                                "text-gray-700",
                                "hover:bg-gray-100",
                                "hover:border-gray-300",
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
                                  <Zap className="h-4 w-4 text-gray-500" />
                                  Quick Admin Login
                                </span>
                              )}
                            </Button>
                          </motion.div>
                        )}

                        {/* Secure connection indicator */}
                        <motion.div
                          className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-gray-500 font-medium"
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
                          <div className="h-14 w-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                            <Shield className="h-7 w-7 text-orange-600" />
                          </div>
                        </div>

                        <p className="text-sm text-center text-gray-600">
                          Enter the 6-digit code from your authenticator app.
                        </p>

                        <div className="space-y-2">
                          <Label htmlFor="twoFactorCode" className="text-sm font-semibold text-gray-700 tracking-wide">Code</Label>
                          <Input
                            id="twoFactorCode"
                            type="text"
                            placeholder="000000"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-xl tracking-[0.3em] font-mono h-12 rounded-xl bg-white border-gray-200 transition-all duration-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                            maxLength={6}
                            disabled={isLoading}
                            autoFocus
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl font-semibold text-sm transition-colors duration-200 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-70"
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
                          className="w-full rounded-xl transition-all duration-200 text-gray-600 hover:text-gray-900"
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
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" />
                            Demo Mode
                          </span>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <Separator className="bg-gray-200" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-white px-3 text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                              <Sparkles className="h-3 w-3 text-gray-400" />
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
                                  "border-gray-200",
                                  "bg-white",
                                  "transition-all duration-200",
                                  "hover:bg-gray-50",
                                  "hover:border-gray-300",
                                  "group",
                                  "relative overflow-hidden"
                                )}
                              >
                                {/* Left color bar with role accent */}
                                <div className={cn("absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all duration-300 group-hover:w-[4px] group-hover:top-0 group-hover:bottom-0", cred.barColor)} />
                                <motion.div
                                  className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-md ring-2 ring-white/30 dark:ring-orange-900/30",
                                    cred.color
                                  )}
                                  whileHover={{ scale: 1.08, rotate: 2 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  <CredIcon className="h-5 w-5 text-white" />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-foreground">{cred.role}</div>
                                  <div className="text-xs text-gray-500 truncate">{cred.email}</div>
                                </div>
                                <motion.div
                                  className="h-6 w-6 rounded-lg flex items-center justify-center bg-orange-50/80 dark:bg-orange-950/30"
                                  whileHover={{ x: 2 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                >
                                  <ChevronRight className="h-3 w-3 text-orange-400/50" />
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

              {/* ── Register with license key link ── */}
              <motion.div
                className="mt-6 text-center space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <p className="text-sm text-gray-500">
                  Have a license key?{' '}
                  <button
                    className="text-orange-600 dark:text-orange-400 font-semibold hover:text-orange-700 dark:hover:text-orange-300 transition-colors duration-200 underline-offset-4 hover:underline inline-flex items-center gap-1"
                    onClick={() => router.push('/register')}
                  >
                    Activate your plan
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </p>
                <p className="text-xs text-gray-500">
                  Don&apos;t have a key?{' '}
                  <button
                    className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 underline-offset-4 hover:underline"
                    onClick={() => router.push('/register')}
                  >
                    Register with a trial key
                  </button>
                </p>
              </motion.div>

              {/* ── System Status indicator ── */}
              <motion.div
                className="flex items-center justify-end gap-1.5 mt-4 text-[11px] text-gray-500 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>All systems operational</span>
              </motion.div>

              {/* ── Mobile footer ── */}
              <div className="flex-1" />
              <div className="lg:hidden h-px bg-gray-200 mt-4" />

              <div className="lg:hidden text-center text-xs text-gray-500 pt-4 mt-0 border-t border-gray-200">
                <p className="flex items-center justify-center gap-1">
                  <Zap className="h-3 w-3 text-gray-400" />
                  Powered by StaySuite HospitalityOS
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Desktop sticky footer ═══ */}
      <div className="hidden lg:block h-px bg-gray-200" />

      <div className="hidden lg:flex items-center justify-center py-3 px-4 bg-white border-t border-gray-200 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-gray-400" />
          <span>Powered by StaySuite HospitalityOS</span>
        </span>
        <span className="mx-2 text-gray-400">&middot;</span>
        <span>&copy; 2026 Cryptsk Pvt Ltd</span>
        <span className="mx-2 text-gray-400">&middot;</span>
        <span className="hover:text-gray-700 transition-colors cursor-pointer">Privacy</span>
        <span className="mx-2 text-gray-400">&middot;</span>
        <span className="hover:text-gray-700 transition-colors cursor-pointer">Terms</span>
      </div>
    </div>
  );
}
