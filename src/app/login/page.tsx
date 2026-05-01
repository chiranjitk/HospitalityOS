'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Key,
  ConciergeBell,
  Wine,
  Bath,
  Star,
  Clock,
  Fingerprint,
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

// Floating icon configuration
const floatingIcons = [
  { Icon: Bed, x: '8%', y: '15%', size: 22, delay: 0, duration: 18, rotate: -5 },
  { Icon: Key, x: '82%', y: '10%', size: 18, delay: 2.5, duration: 22, rotate: 15 },
  { Icon: ConciergeBell, x: '75%', y: '70%', size: 20, delay: 4, duration: 20, rotate: -10 },
  { Icon: Wine, x: '15%', y: '75%', size: 16, delay: 1.5, duration: 24, rotate: 8 },
  { Icon: Bath, x: '88%', y: '40%', size: 18, delay: 3, duration: 19, rotate: -12 },
  { Icon: Star, x: '5%', y: '50%', size: 14, delay: 5, duration: 21, rotate: 20 },
  { Icon: Clock, x: '70%', y: '25%', size: 15, delay: 1, duration: 23, rotate: -8 },
  { Icon: Fingerprint, x: '25%', y: '88%', size: 17, delay: 3.5, duration: 17, rotate: 5 },
];

// Framer-motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 24, mass: 0.8 },
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
      setError(decodeURIComponent(oauthError));
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

  // Memoize floating icons to avoid re-renders
  const memoizedFloatingIcons = useMemo(() => floatingIcons, []);

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
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Hotel className="h-6 w-6 text-white" />
          </div>
          <div className="h-4 w-24 bg-gradient-to-r from-teal-500/30 to-emerald-500/30 rounded animate-pulse" />
        </motion.div>
      </div>
    );
  }

  // Demo credentials are only available in development mode
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const demoCredentials = showDemoCredentials ? [
    { role: 'Admin', email: 'admin@royalstay.in', password: 'admin123', color: 'bg-gradient-to-br from-violet-600 to-purple-600', ring: 'ring-violet-500/30', icon: Shield },
    { role: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-teal-500 to-emerald-500', ring: 'ring-teal-500/30', icon: ConciergeBell },
    { role: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123', color: 'bg-gradient-to-br from-amber-500 to-orange-500', ring: 'ring-amber-500/30', icon: Bath },
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
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110 duration-300">
                <Hotel className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-teal-100 to-emerald-100 bg-clip-text text-transparent">
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

        {/* Animated mesh gradient background */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex-1 min-h-screen lg:min-h-0">
          {/* Mobile-only gradient background */}
          <div
            className="absolute inset-0 lg:hidden"
            style={{
              background: 'linear-gradient(160deg, #f0fdfa, #ecfdf5 40%, #f0fdfa 70%, #ecfdf5)',
            }}
          />
          {/* Mesh gradient base layer */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(-45deg,
                  #f0fdfa, #ecfdf5, #f0f9ff, #fefce8,
                  #faf5ff, #fdf2f8, #f0fdfa, #ecfdf5)
              `,
              backgroundSize: '400% 400%',
              animation: 'loginGradientShift 20s ease infinite',
            }}
          />

          {/* Mesh gradient orbs - colorful theme */}
          <div
            className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full opacity-40 blur-[120px]"
            style={{
              background: 'radial-gradient(circle, rgba(20,184,166,0.25) 0%, transparent 70%)',
              animation: 'loginGlowPulse 10s ease-in-out infinite',
            }}
          />
          <div
            className="absolute bottom-[5%] right-[5%] w-[450px] h-[450px] rounded-full opacity-35 blur-[110px]"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.20) 0%, transparent 70%)',
              animation: 'loginGlowPulse 12s ease-in-out infinite 3s',
            }}
          />
          <div
            className="absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30 blur-[140px]"
            style={{
              background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)',
              animation: 'loginGlowPulse 14s ease-in-out infinite 6s',
            }}
          />
          <div
            className="absolute top-[20%] right-[20%] w-[350px] h-[350px] rounded-full opacity-25 blur-[100px]"
            style={{
              background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
              animation: 'loginGlowPulse 11s ease-in-out infinite 1.5s',
            }}
          />
          <div
            className="absolute bottom-[25%] left-[5%] w-[300px] h-[300px] rounded-full opacity-20 blur-[90px]"
            style={{
              background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)',
              animation: 'loginGlowPulse 13s ease-in-out infinite 4.5s',
            }}
          />

          {/* Dark mode gradient orbs */}
          <div className="hidden dark:block absolute inset-0">
            <div
              className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
              style={{
                background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
                animation: 'loginGlowPulse 10s ease-in-out infinite',
              }}
            />
            <div
              className="absolute bottom-[5%] right-[5%] w-[450px] h-[450px] rounded-full opacity-15 blur-[110px]"
              style={{
                background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
                animation: 'loginGlowPulse 12s ease-in-out infinite 3s',
              }}
            />
            <div
              className="absolute top-[20%] right-[20%] w-[350px] h-[350px] rounded-full opacity-12 blur-[100px]"
              style={{
                background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)',
                animation: 'loginGlowPulse 11s ease-in-out infinite 1.5s',
              }}
            />
          </div>

          {/* Decorative grid pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              <pattern id="loginGridPattern" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginGridPattern)" style={{ color: '#0d9488' }} />
          </svg>

          {/* Dot pattern overlay */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
            aria-hidden="true"
            style={{ animation: 'loginPatternDrift 30s linear infinite' }}
          >
            <defs>
              <pattern id="loginDotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginDotPattern)" style={{ color: '#5eead4' }} />
          </svg>

          {/* Floating hotel-themed icons */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {memoizedFloatingIcons.map(({ Icon, x, y, size, delay, duration, rotate }, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ left: x, top: y }}
                initial={{ opacity: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 0.12, 0.08, 0.12, 0],
                  y: [0, -20, -10, -25, 0],
                  x: [0, 8, -6, 4, 0],
                  rotate: [0, rotate, -rotate, rotate * 0.5, 0],
                }}
                transition={{
                  duration,
                  delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Icon
                  className="text-teal-500/40 dark:text-teal-400/15"
                  style={{ width: size, height: size }}
                />
              </motion.div>
            ))}
          </div>

          {/* Floating particle animation layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={`particle-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${3 + (i % 4) * 1.5}px`,
                  height: `${3 + (i % 4) * 1.5}px`,
                  left: `${6 + (i * 6.5) % 88}%`,
                  top: `${8 + (i * 12) % 80}%`,
                  background: i % 5 === 0
                    ? 'rgba(20, 184, 166, 0.30)'
                    : i % 5 === 1
                      ? 'rgba(139, 92, 246, 0.25)'
                      : i % 5 === 2
                        ? 'rgba(6, 182, 212, 0.22)'
                        : i % 5 === 3
                          ? 'rgba(245, 158, 11, 0.20)'
                          : 'rgba(236, 72, 153, 0.18)',
                  animation: `loginParticle ${5 + (i % 5) * 1.5}s ease-out infinite`,
                  animationDelay: `${i * 0.6}s`,
                }}
              />
            ))}
          </div>

          {/* Subtle radial glow behind form */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, rgba(139,92,246,0.05) 40%, transparent 70%)',
              animation: 'loginGlowPulse 8s ease-in-out infinite',
            }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen lg:min-h-screen p-4 sm:p-6 lg:p-8 py-8 lg:py-0 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-[400px] lg:max-w-[360px] flex flex-col">

              {/* Mobile Logo */}
              <motion.div
                className="lg:hidden flex items-center justify-center gap-3 mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Hotel className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                    StaySuite
                  </h1>
                  <p className="text-muted-foreground text-[11px] tracking-wide font-medium">Hospitality OS</p>
                </div>
              </motion.div>

              {/* ── Glassmorphism Card ── */}
              <motion.div
                className="rounded-2xl border border-white/60 dark:border-white/[0.08] bg-white/70 dark:bg-slate-950/60 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.10),0_0_80px_-20px_rgba(20,184,166,0.08)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(20,184,166,0.10)] relative overflow-hidden"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{
                  boxShadow: '0_20px_60px_-12px_rgba(0,0,0,0.15),0_0_100px_-20px_rgba(20,184,166,0.10)',
                  y: -2,
                  transition: { duration: 0.4, ease: 'easeOut' },
                }}
              >
                {/* Animated gradient border on top edge */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-emerald-400 via-cyan-400 to-violet-500 bg-[length:200%_100%]" style={{ animation: 'loginGradientShift 4s ease infinite' }} />
                {/* Subtle animated border glow on top edge */}
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" style={{ animation: 'loginGlowPulse 4s ease-in-out infinite' }} />

                {/* Inner glass highlight */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent dark:from-white/[0.03] pointer-events-none" />

                <div className="p-5 sm:p-6 lg:p-8 relative">

                  {/* Header */}
                  <div className="mb-7">
                    <motion.div
                      className="flex items-center gap-2 mb-2"
                      variants={headerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 via-emerald-400 to-cyan-500" />
                      <h2 className="text-xl font-bold text-foreground tracking-tight">
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
                              <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
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
                              className="relative pl-11 h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
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
                                  await fetch('/api/auth/forgot-password', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email }),
                                  });
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
                              className="relative pl-11 pr-11 h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
                              required
                              disabled={isLoading}
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground transition-all duration-200 hover:scale-110 active:scale-95"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>
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
                              "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300",
                              "bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-[length:200%_100%]",
                              "hover:bg-right hover:shadow-[0_8px_30px_-8px_rgba(249,115,22,0.35)]",
                              "dark:from-orange-500 dark:via-amber-400 dark:to-orange-400",
                              "text-white",
                              "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
                              "disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-lg disabled:active:scale-100",
                              "relative overflow-hidden group"
                            )}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <span className="relative z-10 flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('signingIn')}
                              </span>
                            ) : (
                              <span className="relative z-10 flex items-center justify-center gap-1.5">
                                {t('signIn')}
                                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                              </span>
                            )}
                            {/* Shimmer overlay */}
                            <span
                              className="absolute inset-0 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 75%)',
                                backgroundSize: '250% 100%',
                                animation: 'loginShimmer 3s ease-in-out infinite',
                              }}
                            />
                            {/* Bottom glow */}
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-orange-500/20 blur-xl rounded-full pointer-events-none" />
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
                              <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
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
                                  "hover:shadow-[0_8px_24px_-8px_rgba(20,184,166,0.08)]",
                                  "group"
                                )}
                              >
                                <motion.div
                                  className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center shadow-md",
                                    cred.color
                                  )}
                                  whileHover={{ scale: 1.1, rotate: 3 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  <CredIcon className="h-4 w-4 text-white" />
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

              {/* ── Sign up link ── */}
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button
                    className="text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-700 dark:hover:text-teal-300 transition-colors duration-200 underline-offset-4 hover:underline inline-flex items-center gap-1"
                    onClick={() => router.push('/signup')}
                  >
                    Start free trial
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </p>
              </motion.div>

              {/* ── Mobile footer (sticky at bottom when content is short) ── */}
              <div className="flex-1" />
              <div className="lg:hidden text-center text-xs text-muted-foreground/60 pt-4 mt-4 border-t border-border/50">
                <p>&copy; 2026 Cryptsk Pvt Ltd &middot; All rights reserved</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sticky footer for desktop (below the flex row) ═══ */}
      <div className="hidden lg:flex items-center justify-center py-3 px-4 bg-background/80 dark:bg-background/40 backdrop-blur-sm border-t border-border/30 text-xs text-muted-foreground/60">
        <span>&copy; 2026 Cryptsk Pvt Ltd</span>
        <span className="mx-2">&middot;</span>
        <span className="hover:text-muted-foreground/80 transition-colors cursor-pointer">Privacy</span>
        <span className="mx-2">&middot;</span>
        <span className="hover:text-muted-foreground/80 transition-colors cursor-pointer">Terms</span>
        <span className="mx-2">&middot;</span>
        <span className="flex items-center gap-1">
          <Hotel className="h-3 w-3 text-teal-500" />
          StaySuite Hospitality OS
        </span>
      </div>
    </div>
  );
}
