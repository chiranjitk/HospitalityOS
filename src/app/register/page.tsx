'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2,
  Hotel,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Shield,
  Sparkles,
  Globe,
  Wifi,
  Building2,
  Users,
  Bed,
  Briefcase,
  Mail,
  Phone,
  Lock,
  Crown,
  XCircle,
  AlertTriangle,
  Clock,
  PartyPopper,
  LayoutDashboard,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';

/* ─── Feature Name Mapping ─── */
const FEATURE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard & KPIs',
  pms: 'Property Management',
  bookings: 'Bookings & Reservations',
  guests: 'Guest Management',
  frontdesk: 'Front Desk Operations',
  billing: 'Billing & Invoicing',
  housekeeping: 'Housekeeping',
  settings: 'System Settings',
  help: 'Help & Support',
  inventory: 'Inventory Management',
  reports: 'Reports & Analytics',
  notifications: 'Notifications',
  guest_experience: 'Guest Experience',
  pos: 'Restaurant & POS',
  parking: 'Parking Management',
  surveillance: 'Surveillance & CCTV',
  iot: 'Smart Hotel / IoT',
  wifi: 'WiFi & Network',
  revenue_management: 'Revenue Management',
  channel_manager: 'Channel Manager',
  crm: 'CRM & Marketing',
  marketing: 'Marketing Tools',
  events: 'Events / MICE',
  staff_management: 'Staff Management',
  security_center: 'Security Center',
  integrations: 'Third-party Integrations',
  automation: 'Automation & Workflows',
  ai_features: 'AI Assistant',
  admin: 'Admin Panel',
  chain_management: 'Chain Management',
  saas_billing: 'SaaS Billing',
  webhooks: 'Webhooks',
};

/* ─── Types ─── */
interface PlanData {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  maxProperties: number;
  maxRoomsPerProperty: number;
  maxUsers: number;
  maxStaff: number;
  features: string[];
  trialDays: number | null;
}

interface RegistrationFormData {
  licenseKey: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

const STEPS = [
  { label: 'License Key', icon: KeyRound },
  { label: 'Plan Details', icon: Crown },
  { label: 'Account Setup', icon: Building2 },
  { label: 'Complete', icon: CheckCircle2 },
] as const;

/* ─── Framer Motion Variants ─── */
const cardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 220, damping: 22, mass: 0.8 },
  },
};

const stepContentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2 },
  }),
};

const successCheckVariants = {
  hidden: { scale: 0, opacity: 0, rotate: -180 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.2,
    },
  },
};

const floatOrbStyle1 = {
  background: 'linear-gradient(135deg, rgba(16,185,129,0.35), rgba(20,184,166,0.25))',
  animation: 'loginGlowPulse 10s ease-in-out infinite',
};

const floatOrbStyle2 = {
  background: 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(249,115,22,0.25))',
  animation: 'loginGlowPulse 12s ease-in-out infinite',
};

const floatOrbStyle3 = {
  background: 'linear-gradient(135deg, rgba(139,92,246,0.30), rgba(167,139,250,0.20))',
  animation: 'loginGlowPulse 14s ease-in-out infinite',
};

/* ─── Password Strength ─── */
function getPasswordStrength(password: string): { score: number; label: string; color: string; bgColor: string } {
  if (!password) return { score: 0, label: '', color: '', bgColor: '' };
  if (password.length < 8) return { score: 25, label: 'Weak', color: 'bg-red-500', bgColor: 'bg-red-100 dark:bg-red-950/40' };

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasMixedCase = hasUpper && hasLower;

  if (hasMixedCase && hasNumber && hasSpecial && password.length >= 12) {
    return { score: 100, label: 'Very Strong', color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950/40' };
  }
  if (hasMixedCase && hasNumber && hasSpecial) {
    return { score: 80, label: 'Strong', color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-950/40' };
  }
  if (hasMixedCase && (hasNumber || hasSpecial)) {
    return { score: 60, label: 'Good', color: 'bg-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-950/40' };
  }
  return { score: 40, label: 'Medium', color: 'bg-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-950/40' };
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function RegistrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step state
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Loading states
  const [isValidating, setIsValidating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Data
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Form
  const [formData, setFormData] = useState<RegistrationFormData>({
    licenseKey: '',
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  // Errors
  const [keyError, setKeyError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength
  const passwordStrength = getPasswordStrength(formData.password);

  /* ─── Auto-redirect countdown ─── */
  useEffect(() => {
    if (currentStep !== 3) return;
    if (redirectCountdown <= 0) {
      router.push('/login');
      return;
    }
    countdownRef.current = setInterval(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [currentStep, redirectCountdown, router]);

  /* ─── Step navigation ─── */
  const goToStep = useCallback((step: number, dir: number = 1) => {
    setDirection(dir);
    setCurrentStep(step);
    setApiError('');
    setFieldErrors({});
  }, []);

  /* ─── Validate License Key ─── */
  const handleValidateKey = useCallback(async () => {
    const key = formData.licenseKey.trim();
    if (!key) {
      setKeyError('Please enter your license key');
      return;
    }
    setKeyError('');
    setIsValidating(true);
    setApiError('');

    try {
      const res = await fetch('/api/registration/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || 'Invalid license key';
        if (msg.includes('expired')) {
          setKeyError('This license key has expired. Please contact support.');
        } else if (msg.includes('activated') || msg.includes('already')) {
          setKeyError('This license key has already been activated.');
        } else if (msg.includes('revoked')) {
          setKeyError('This license key has been revoked. Please contact support.');
        } else {
          setKeyError('Invalid license key. Please check and try again.');
        }
        return;
      }

      // Parse features
      let features: string[] = [];
      if (data.plan?.features) {
        try {
          const parsed = typeof data.plan.features === 'string' ? JSON.parse(data.plan.features) : data.plan.features;
          features = Array.isArray(parsed) ? parsed : [];
        } catch {
          features = [];
        }
      }

      setPlan({
        id: data.plan?.id || '',
        name: data.plan?.name || '',
        displayName: data.plan?.displayName || 'Plan',
        description: data.plan?.description || null,
        price: data.plan?.price ?? 0,
        maxProperties: data.plan?.maxProperties ?? 1,
        maxRoomsPerProperty: data.plan?.maxRoomsPerProperty ?? 50,
        maxUsers: data.plan?.maxUsers ?? 5,
        maxStaff: data.plan?.maxStaff ?? 10,
        features,
        trialDays: data.plan?.trialDays ?? null,
      });

      goToStep(1);
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to validate key. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  }, [formData.licenseKey, goToStep, toast]);

  /* ─── Validate Step 3 fields ─── */
  const validateAccountSetup = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.organizationName.trim()) errors.organizationName = 'Organization name is required';
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (formData.phone && !/^[+\d\s()-]{7,20}$/.test(formData.phone)) errors.phone = 'Invalid phone format';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!formData.agreeTerms) errors.agreeTerms = 'You must agree to the terms and conditions';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  /* ─── Register Account ─── */
  const handleRegister = useCallback(async () => {
    if (!validateAccountSetup()) return;

    setIsRegistering(true);
    setApiError('');

    try {
      const res = await fetch('/api/registration/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formData.licenseKey.trim(),
          organizationName: formData.organizationName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || 'Registration failed';
        setApiError(msg);
        if (msg.includes('already')) {
          setFieldErrors((prev) => ({ ...prev, email: 'An account with this email already exists' }));
        }
        return;
      }

      toast({
        title: 'Registration Successful!',
        description: 'Your account has been created. Redirecting to login...',
      });
      goToStep(3);
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to register. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  }, [formData, validateAccountSetup, goToStep, toast]);

  /* ─── Format license key as user types ─── */
  const handleKeyChange = (value: string) => {
    // Auto-format to STS-XXXX-XXXX-XXXX-XXXX
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = [];
    for (let i = 0; i < raw.length && i < 19; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    const formatted = parts.join('-');
    setFormData((prev) => ({ ...prev, licenseKey: formatted }));
    if (keyError) setKeyError('');
  };

  /* ─── Computed values ─── */
  const featureCount = plan ? plan.features.length : 0;
  const includedFeatures = plan ? plan.features.slice(0, 8) : [];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* ── Keyframe animations defined in login-animations.css ── */}

      <div className="flex flex-1 min-h-0">
        {/* ═══════════════════════════════════════════
            LEFT SIDE - Brand Panel
            ═══════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
          {/* Dark gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950" />

          {/* Animated glow orbs */}
          <div
            className="absolute top-[15%] left-[20%] w-80 h-80 rounded-full bg-teal-500/20 blur-[100px]"
            style={{ animation: 'loginGlowPulse 6s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-[20%] right-[15%] w-72 h-72 rounded-full bg-emerald-400/15 blur-[90px]"
            style={{ animation: 'loginGlowPulse 8s ease-in-out infinite 2s' }}
          />
          <div
            className="absolute top-[50%] right-[30%] w-56 h-56 rounded-full bg-amber-400/10 blur-[80px]"
            style={{ animation: 'loginGlowPulse 7s ease-in-out infinite 4s' }}
          />

          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" aria-hidden="true">
            <defs>
              <pattern id="regGridPattern" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#regGridPattern)" style={{ color: '#10b981' }} />
          </svg>

          {/* Content overlay */}
          <motion.div
            className="relative z-10 flex flex-col justify-between p-10 xl:p-14 2xl:p-16 w-full"
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            {/* Logo */}
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <div className="h-11 w-11 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110 duration-300">
                <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={44} height={44} className="object-contain w-full h-full" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-teal-100 to-emerald-100 bg-clip-text text-transparent">
                  StaySuite
                </h1>
                <p className="text-emerald-200/80 text-xs font-medium">by Cryptsk Pvt Ltd</p>
              </div>
            </motion.div>

            {/* Center content */}
            <motion.div className="space-y-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
              <div>
                <motion.div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 backdrop-blur-sm border border-emerald-400/20 text-emerald-300 text-xs font-medium mb-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Sparkles className="h-3 w-3" />
                  License Key Activation
                </motion.div>
                <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                  Activate Your
                  <br />
                  <span className="bg-gradient-to-r from-teal-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                    Hospitality Platform
                  </span>
                </h2>
              </div>

              {/* Feature highlights */}
              <div className="space-y-4">
                {[
                  { icon: KeyRound, title: 'License Key Activation', desc: 'Enter your key to unlock the platform' },
                  { icon: Crown, title: 'Feature-Rich Plans', desc: 'From Starter to Enterprise, pick your tier' },
                  { icon: Zap, title: 'Instant Setup', desc: 'Get started in minutes, not hours' },
                ].map(({ icon: FeatureIcon, title, desc }, i) => (
                  <motion.div
                    key={title}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <div className="h-9 w-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center flex-shrink-0">
                      <FeatureIcon className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{title}</p>
                      <p className="text-slate-400 text-xs">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                {[
                  { icon: Building2, label: '2,500+ properties' },
                  { icon: Globe, label: '150 countries' },
                  { icon: Wifi, label: 'WiFi AAA Ready' },
                ].map(({ icon: StatIcon, label }) => (
                  <span
                    key={label}
                    className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <StatIcon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <motion.div
              className="flex items-center gap-4 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
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
            RIGHT SIDE - Registration Form
            ═══════════════════════════════════════════ */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex-1 min-h-screen lg:min-h-0">
          {/* Mobile gradient background */}
          <div
            className="absolute inset-0 lg:hidden"
            style={{ background: 'linear-gradient(160deg, #f0fdfa, #ecfdf5 40%, #f0fdfa 70%, #ecfdf5)' }}
          />
          {/* Mesh gradient base */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(-45deg, #f0fdfa, #ecfdf5, #f0f9ff, #fefce8, #faf5ff, #fdf2f8, #f0fdfa, #ecfdf5)',
              backgroundSize: '400% 400%',
              animation: 'loginGradientShift 20s ease infinite',
            }}
          />
          {/* Floating orbs */}
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-50" style={{ ...floatOrbStyle1, animation: 'floatOrb1 8s ease-in-out infinite' }} />
          <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-45" style={{ ...floatOrbStyle2, animation: 'floatOrb2 10s ease-in-out infinite' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30" style={{ ...floatOrbStyle3, animation: 'floatOrb3 12s ease-in-out infinite' }} />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" aria-hidden="true">
            <defs>
              <pattern id="regFormGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#regFormGrid)" style={{ color: '#0d9488' }} />
          </svg>

          {/* Form container */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-[440px] flex flex-col">

              {/* Mobile Logo */}
              <motion.div
                className="lg:hidden flex items-center justify-center gap-3 mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <div className="h-11 w-11 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/30">
                  <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={44} height={44} className="object-contain w-full h-full" />
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
                className="rounded-2xl border border-border/40 dark:border-white/[0.08] bg-card/80 dark:bg-slate-950/60 backdrop-blur-xl shadow-2xl shadow-primary/5 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(20,184,166,0.10)] relative overflow-hidden border-gradient-rotate"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Animated gradient border on top */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-10"
                  style={{
                    background: 'linear-gradient(90deg, #10b981, #14b8a6, #06b6d4, #10b981)',
                    backgroundSize: '300% 100%',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}
                />
                {/* Inner glass highlight */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent dark:from-white/[0.03] pointer-events-none" />

                <div className="p-5 sm:p-6 lg:p-8 relative z-10">

                  {/* ── Step Indicator ── */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between relative">
                      {/* Connector line background */}
                      <div className="absolute top-4 left-8 right-8 h-px bg-border/60 dark:bg-white/10" />
                      {/* Connector line active */}
                      <div
                        className="absolute top-4 left-8 h-px bg-emerald-500 transition-all duration-500 ease-out"
                        style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - ${currentStep === 0 ? 100 : 0}%)` }}
                      />

                      {STEPS.map((step, i) => {
                        const StepIcon = step.icon;
                        const isActive = i === currentStep;
                        const isCompleted = i < currentStep;
                        return (
                          <motion.div
                            key={step.label}
                            className="relative z-10 flex flex-col items-center gap-1.5"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
                          >
                            <div
                              className={cn(
                                'h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2',
                                isActive && 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110',
                                isCompleted && 'bg-emerald-500 border-emerald-500 text-white',
                                !isActive && !isCompleted && 'bg-card border-border/60 dark:border-white/10 text-muted-foreground dark:text-slate-500',
                              )}
                            >
                              {isCompleted ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <StepIcon className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-[10px] sm:text-xs font-medium transition-colors hidden sm:block',
                                isActive && 'text-emerald-600 dark:text-emerald-400',
                                isCompleted && 'text-emerald-500',
                                !isActive && !isCompleted && 'text-muted-foreground',
                              )}
                            >
                              {step.label}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Step Content ── */}
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentStep}
                      custom={direction}
                      variants={stepContentVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      {/* ═══════ STEP 0: License Key ═══════ */}
                      {currentStep === 0 && (
                        <div className="space-y-6">
                          {/* Header */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 via-emerald-400 to-cyan-500" />
                              <h2 className="text-xl font-bold text-foreground tracking-tight text-shadow-sm">
                                Enter Your License Key
                              </h2>
                            </div>
                            <p className="text-sm text-muted-foreground/80 font-medium pl-3">
                              Enter the key provided by your account manager or sales team
                            </p>
                          </div>

                          {/* API Error */}
                          <AnimatePresence>
                            {apiError && (
                              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40">
                                  <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                    {apiError}
                                  </AlertDescription>
                                </Alert>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Key input */}
                          <div className="space-y-3">
                            <Label htmlFor="licenseKey" className="text-sm font-semibold text-foreground/80">
                              License Key
                            </Label>
                            <div className="relative group/input">
                              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                              <Input
                                id="licenseKey"
                                value={formData.licenseKey}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleValidateKey()}
                                placeholder="STS-XXXX-XXXX-XXXX-XXXX"
                                className="relative pl-11 h-14 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70 text-center font-mono text-base tracking-widest placeholder:text-foreground/35 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm"
                                disabled={isValidating}
                                maxLength={23}
                                autoComplete="off"
                                spellCheck={false}
                              />
                              {isValidating && (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                  <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground/60 text-center">
                              Format: STS-XXXX-XXXX-XXXX-XXXX
                            </p>
                          </div>

                          {/* Key error */}
                          <AnimatePresence>
                            {keyError && (
                              <motion.p
                                className="text-sm text-red-500 dark:text-red-400 flex items-center justify-center gap-1.5"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                              >
                                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                {keyError}
                              </motion.p>
                            )}
                          </AnimatePresence>

                          {/* Info box */}
                          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-800/30 p-4">
                            <div className="flex gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Have a key?</p>
                                <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 leading-relaxed">
                                  Your license key was provided by your account manager or included in your purchase confirmation email. It unlocks a specific plan with pre-configured features and limits.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Validate button */}
                          <Button
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all duration-300 active:scale-[0.98] text-sm"
                            onClick={handleValidateKey}
                            disabled={isValidating || !formData.licenseKey.trim()}
                          >
                            {isValidating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Validating Key...
                              </>
                            ) : (
                              <>
                                Validate Key
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </>
                            )}
                          </Button>

                          {/* Sign in link */}
                          <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link href="/login" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium hover:underline transition-colors">
                              Sign in
                            </Link>
                          </p>
                        </div>
                      )}

                      {/* ═══════ STEP 1: Plan Details ═══════ */}
                      {currentStep === 1 && plan && (
                        <div className="space-y-5">
                          {/* Header */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 via-emerald-400 to-cyan-500" />
                              <h2 className="text-xl font-bold text-foreground tracking-tight text-shadow-sm">
                                Your Plan
                              </h2>
                            </div>
                            <p className="text-sm text-muted-foreground/80 font-medium pl-3">
                              Review the plan associated with your license key
                            </p>
                          </div>

                          {/* Plan card */}
                          <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50/30 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/10">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <Crown className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-foreground text-lg">{plan.displayName}</h3>
                                    {plan.description && (
                                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                                    )}
                                  </div>
                                </div>
                                <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-700/30">
                                  {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                                </Badge>
                              </div>

                              {plan.trialDays && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-700/30 mb-4">
                                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Includes {plan.trialDays}-day free trial
                                  </span>
                                </div>
                              )}

                              {/* Limits */}
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {[
                                  { icon: Building2, label: 'Properties', value: plan.maxProperties },
                                  { icon: Bed, label: 'Rooms/Property', value: plan.maxRoomsPerProperty },
                                  { icon: Users, label: 'Admin Users', value: plan.maxUsers },
                                  { icon: Briefcase, label: 'Staff Members', value: plan.maxStaff },
                                ].map(({ icon: LimitIcon, label, value }) => (
                                  <div key={label} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/5">
                                    <LimitIcon className="h-4 w-4 text-teal-500 dark:text-teal-400" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
                                      <span className="text-sm font-bold text-foreground">{value === 999 ? 'Unlimited' : value}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Features */}
                              {includedFeatures.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                    Included Features ({featureCount})
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {includedFeatures.map((feature, i) => {
                                      const featureName = typeof feature === 'string'
                                        ? (FEATURE_NAMES[feature] || feature)
                                        : (FEATURE_NAMES[feature?.name || feature?.id || ''] || feature?.name || String(feature));
                                      const isIncluded = typeof feature === 'object' ? feature?.included !== false : true;
                                      return (
                                        <motion.div
                                          key={i}
                                          className="flex items-center gap-2 py-1"
                                          initial={{ opacity: 0, x: -8 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: 0.1 + i * 0.04 }}
                                        >
                                          <div className={cn(
                                            'h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0',
                                            isIncluded
                                              ? 'bg-emerald-100 dark:bg-emerald-900/40'
                                              : 'bg-slate-100 dark:bg-slate-800/40',
                                          )}>
                                            {isIncluded ? (
                                              <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                              <XCircle className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" />
                                            )}
                                          </div>
                                          <span className={cn(
                                            'text-xs',
                                            isIncluded
                                              ? 'text-foreground font-medium'
                                              : 'text-muted-foreground line-through',
                                          )}>
                                            {featureName}
                                          </span>
                                        </motion.div>
                                      );
                                    })}
                                    {featureCount > 8 && (
                                      <p className="text-xs text-muted-foreground">+{featureCount - 8} more features...</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Navigation buttons */}
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              className="flex-1 h-11 rounded-xl"
                              onClick={() => goToStep(0, -1)}
                            >
                              <ArrowLeft className="h-4 w-4 mr-2" />
                              Back
                            </Button>
                            <Button
                              className="flex-1 h-11 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300"
                              onClick={() => goToStep(2)}
                            >
                              Looks Good, Continue
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* ═══════ STEP 2: Account Setup ═══════ */}
                      {currentStep === 2 && (
                        <div className="space-y-5">
                          {/* Header */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 via-emerald-400 to-cyan-500" />
                              <h2 className="text-xl font-bold text-foreground tracking-tight text-shadow-sm">
                                Set Up Your Account
                              </h2>
                            </div>
                            <p className="text-sm text-muted-foreground/80 font-medium pl-3">
                              Create your admin account and organization
                            </p>
                          </div>

                          {/* API Error */}
                          <AnimatePresence>
                            {apiError && (
                              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40">
                                  <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                    {apiError}
                                  </AlertDescription>
                                </Alert>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="space-y-4">
                            {/* Organization Name */}
                            <div className="space-y-2">
                              <Label htmlFor="orgName" className="text-sm font-semibold text-foreground/80">
                                Organization Name <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative group/input">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                                <Input
                                  id="orgName"
                                  placeholder="Grand Hotel & Resort"
                                  value={formData.organizationName}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, organizationName: e.target.value }))}
                                  className={cn(
                                    'relative pl-11 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.organizationName && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                />
                              </div>
                              {fieldErrors.organizationName && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.organizationName}
                                </p>
                              )}
                            </div>

                            {/* First & Last Name */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-sm font-semibold text-foreground/80">
                                  First Name <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                  id="firstName"
                                  placeholder="Rajesh"
                                  value={formData.firstName}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                                  className={cn(
                                    'h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.firstName && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                />
                                {fieldErrors.firstName && (
                                  <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> {fieldErrors.firstName}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-sm font-semibold text-foreground/80">
                                  Last Name <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                  id="lastName"
                                  placeholder="Sharma"
                                  value={formData.lastName}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                                  className={cn(
                                    'h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.lastName && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                />
                                {fieldErrors.lastName && (
                                  <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> {fieldErrors.lastName}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                              <Label htmlFor="regEmail" className="text-sm font-semibold text-foreground/80">
                                Email Address <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative group/input">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                                <Input
                                  id="regEmail"
                                  type="email"
                                  placeholder="admin@grandhotel.com"
                                  value={formData.email}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                  className={cn(
                                    'relative pl-11 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.email && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                  autoComplete="email"
                                />
                              </div>
                              {fieldErrors.email && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.email}
                                </p>
                              )}
                            </div>

                            {/* Phone */}
                            <div className="space-y-2">
                              <Label htmlFor="regPhone" className="text-sm font-semibold text-foreground/80">
                                Phone <span className="text-muted-foreground font-normal">(optional)</span>
                              </Label>
                              <div className="relative group/input">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                                <Input
                                  id="regPhone"
                                  type="tel"
                                  placeholder="+91 98765 43210"
                                  value={formData.phone}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                                  className={cn(
                                    'relative pl-11 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.phone && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                />
                              </div>
                              {fieldErrors.phone && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.phone}
                                </p>
                              )}
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                              <Label htmlFor="regPassword" className="text-sm font-semibold text-foreground/80">
                                Password <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative group/input">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                                <Input
                                  id="regPassword"
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Min 8 characters"
                                  value={formData.password}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                                  className={cn(
                                    'relative pl-11 pr-11 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.password && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                                  onClick={() => setShowPassword((v) => !v)}
                                  tabIndex={-1}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {/* Password strength bar */}
                              {formData.password && (
                                <div className="space-y-1.5">
                                  <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                                    <motion.div
                                      className={cn('h-full rounded-full transition-colors duration-300', passwordStrength.color)}
                                      initial={{ width: '0%' }}
                                      animate={{ width: `${passwordStrength.score}%` }}
                                      transition={{ duration: 0.3 }}
                                    />
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={cn(
                                      'text-[11px] font-medium',
                                      passwordStrength.score <= 25 && 'text-red-500',
                                      passwordStrength.score <= 60 && passwordStrength.score > 25 && 'text-amber-500',
                                      passwordStrength.score > 60 && 'text-emerald-500',
                                    )}>
                                      {passwordStrength.label}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {formData.password.length}/8+ chars
                                    </span>
                                  </div>
                                </div>
                              )}
                              {fieldErrors.password && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.password}
                                </p>
                              )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                              <Label htmlFor="regConfirmPassword" className="text-sm font-semibold text-foreground/80">
                                Confirm Password <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative group/input">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-teal-500 group-focus-within/input:scale-110" />
                                <Input
                                  id="regConfirmPassword"
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  placeholder="Confirm your password"
                                  value={formData.confirmPassword}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                  className={cn(
                                    'relative pl-11 pr-11 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 hover:border-teal-300/70 dark:hover:border-teal-600/70',
                                    fieldErrors.confirmPassword && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
                                  )}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                                  onClick={() => setShowConfirmPassword((v) => !v)}
                                  tabIndex={-1}
                                >
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {fieldErrors.confirmPassword && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.confirmPassword}
                                </p>
                              )}
                            </div>

                            {/* Terms checkbox */}
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5 pt-1">
                                <Checkbox
                                  id="agreeTerms"
                                  checked={formData.agreeTerms}
                                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, agreeTerms: checked === true }))}
                                  className="mt-0.5"
                                />
                                <Label htmlFor="agreeTerms" className="text-xs text-muted-foreground leading-relaxed font-normal cursor-pointer">
                                  I agree to the{' '}
                                  <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium">Terms of Service</span>
                                  {' '}and{' '}
                                  <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium">Privacy Policy</span>
                                </Label>
                              </div>
                              {fieldErrors.agreeTerms && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {fieldErrors.agreeTerms}
                                </p>
                              )}
                            </div>

                            {/* Navigation buttons */}
                            <div className="flex gap-3 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-11 rounded-xl"
                                onClick={() => goToStep(1, -1)}
                              >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                              </Button>
                              <Button
                                type="submit"
                                className="flex-1 h-11 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all duration-300 active:scale-[0.98]"
                                disabled={isRegistering}
                              >
                                {isRegistering ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating Account...
                                  </>
                                ) : (
                                  <>
                                    Create Account
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* ═══════ STEP 3: Success ═══════ */}
                      {currentStep === 3 && (
                        <div className="space-y-6 py-4">
                          {/* Animated checkmark */}
                          <div className="flex justify-center">
                            <motion.div
                              className="relative"
                              variants={successCheckVariants}
                              initial="hidden"
                              animate="visible"
                            >
                              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                                <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
                              </div>
                              {/* Pulse ring */}
                              <motion.div
                                className="absolute inset-0 rounded-full border-2 border-emerald-400/50"
                                initial={{ scale: 1, opacity: 0.6 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                              />
                            </motion.div>
                          </div>

                          {/* Text */}
                          <div className="text-center space-y-2">
                            <motion.h2
                              className="text-2xl font-bold text-foreground"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                            >
                              Welcome to StaySuite!
                            </motion.h2>
                            <motion.p
                              className="text-sm text-muted-foreground"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.6 }}
                            >
                              Your account has been created successfully
                            </motion.p>
                          </div>

                          {/* Info card */}
                          <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                          >
                            <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50/30 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/10">
                              <CardContent className="p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                    <LayoutDashboard className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground">{formData.organizationName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-700/30 text-[10px]">
                                        <Crown className="h-2.5 w-2.5 mr-1" />
                                        {plan?.displayName || 'Plan'}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground">
                                        {featureCount} features included
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t border-emerald-200/30 dark:border-emerald-700/20 pt-3 space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Admin Email</span>
                                    <span className="font-medium text-foreground">{formData.email}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Account Name</span>
                                    <span className="font-medium text-foreground">{formData.firstName} {formData.lastName}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>

                          {/* Celebration message */}
                          <motion.div
                            className="text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                          >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-700/30">
                              <PartyPopper className="h-4 w-4 text-amber-500" />
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                You&apos;re all set! Redirecting to login in {redirectCountdown}s...
                              </span>
                            </div>
                          </motion.div>

                          {/* Go to Dashboard button */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                          >
                            <Button
                              className="w-full h-11 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300"
                              onClick={() => router.push('/login')}
                            >
                              <LayoutDashboard className="h-4 w-4 mr-2" />
                              Go to Dashboard
                            </Button>
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Bottom credit (visible on mobile) */}
              <p className="text-center text-[11px] text-muted-foreground/50 mt-4 lg:mt-6">
                Powered by{' '}
                <span className="font-medium text-foreground/50">StaySuite HospitalityOS</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
