'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Wifi,
  Shield,
  Loader2,
  CheckCircle2,
  Zap,
  Clock,
  ChevronRight,
  Globe,
  Lock,
  Ticket,
  DoorOpen,
  ArrowRight,
  Sparkles,
  Network,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────
type AuthState = 'idle' | 'loading' | 'success' | 'error'

// ── Animation Variants ─────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

const successPop = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20, delay: 0.1 },
  },
}

// ── Floating Orb Component ─────────────────────────────
function FloatingOrb({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        y: [0, -30, 15, -20, 0],
        x: [0, 15, -10, 20, 0],
        scale: [1, 1.1, 0.95, 1.05, 1],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  )
}

// ── Grid Pattern ───────────────────────────────────────
function GridPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}

// ── Session Timer ──────────────────────────────────────
function SessionTimer() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  return (
    <span className="font-mono tabular-nums text-sm text-emerald-300/80 dark:text-emerald-400/80">
      {String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:
      {String(secs).padStart(2, '0')}
    </span>
  )
}

// ── MAC Address Helper ─────────────────────────────────
/**
 * Validates and formats a MAC address string.
 * Accepts: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, AABBCCDDEEFF, aa:bb:cc:dd:ee:ff
 * Returns: formatted AA:BB:CC:DD:EE:FF or null if invalid
 */
function formatMacAddress(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  // Strip separators and normalize
  const cleaned = raw.replace(/[:\-\.\s]/g, '').toUpperCase()
  // Must be exactly 12 hex chars
  if (!/^[0-9A-F]{12}$/.test(cleaned)) return null
  return cleaned.match(/.{2}/g)?.join(':') || null
}

// ── Main Component (wrapped for useSearchParams) ─────────
function CaptivePortalContent() {
  const searchParams = useSearchParams()

  // ── Read MAC address from URL query params ──
  // Network equipment (AP/Controller/Gateway) typically redirects to the
  // captive portal URL with the client's MAC address as a query parameter.
  // Supported param names (covering major vendors):
  //   ?mac=XX:XX:XX:XX:XX:XX  (UniFi, Mikrotik, Cisco, Aruba, Ruckus, pfSense, CoovaChilli)
  //   ?client_mac=XX:XX        (pfSense, some Fortinet)
  //   ?id=XX:XX                (CoovaChilli)
  //   ?client-mac-address=XX   (Fortinet)
  //   ?ap_mac=XX:XX            (Some Ubiquiti variants)
  const rawMac =
    searchParams.get('mac') ||
    searchParams.get('client_mac') ||
    searchParams.get('client-mac-address') ||
    searchParams.get('id') ||
    searchParams.get('ap_mac') ||
    ''
  const clientMac = formatMacAddress(rawMac)

  const [authState, setAuthState] = useState<AuthState>('idle')
  const [authTab, setAuthTab] = useState<string>('voucher')
  const [voucherCode, setVoucherCode] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [ldapUsername, setLdapUsername] = useState('')
  const [ldapPassword, setLdapPassword] = useState('')
  const [showLdapPassword, setShowLdapPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Debug: log MAC detection for troubleshooting
  useEffect(() => {
    if (rawMac) {
      console.log(`[CaptivePortal] MAC detected from URL param: raw="${rawMac}" formatted="${clientMac}"`)
    } else {
      console.log('[CaptivePortal] No MAC in URL params — server will attempt DHCP/ARP lookup')
    }
  }, [rawMac, clientMac])

  const handleConnect = useCallback(async () => {
    setErrorMsg('')
    setAuthState('loading')

    // Determine payload based on tab — include MAC if available
    let payload:
      | { method: 'voucher'; code: string }
      | { method: 'room'; roomNumber: string; lastName: string }
      | { method: 'ldap'; username: string; password: string }
    if (authTab === 'voucher') {
      payload = { method: 'voucher', code: voucherCode }
    } else if (authTab === 'room') {
      payload = { method: 'room', roomNumber, lastName }
    } else {
      payload = { method: 'ldap', username: ldapUsername, password: ldapPassword }
    }

    // Add MAC address to request body (from URL params or empty for server-side lookup)
    const bodyPayload = {
      ...payload,
      ...(clientMac ? { macAddress: clientMac } : {}),
    }

    try {
      const res = await fetch('/api/wifi/captive/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      })

      let data: Record<string, unknown> | null = null
      try {
        data = await res.json()
      } catch {
        // Response is not JSON — treat as server error
      }

      if (!res.ok) {
        const errorMessage = (data?.error as string) || (data?.message as string) || 'Authentication failed. Please try again.'
        setErrorMsg(errorMessage)
        setAuthState('error')
        return
      }

      // Also check for error fields in the response body even on 200 OK
      // Some APIs return { success: false, error: "..." } with HTTP 200
      if (data && (data.error || data.success === false)) {
        const errorMessage = (data.error as string) || 'Authentication failed. Please try again.'
        setErrorMsg(errorMessage)
        setAuthState('error')
        return
      }

      // Genuine success — show connected state
      setAuthState('success')
    } catch (err) {
      console.error('[CaptivePortal] Auth API error:', err)
      setErrorMsg('Unable to connect to the authentication service. Please check your connection and try again.')
      setAuthState('error')
    }
  }, [authTab, voucherCode, roomNumber, lastName, ldapUsername, ldapPassword, clientMac])

  const handleRetry = useCallback(() => {
    setErrorMsg('')
    setAuthState('idle')
  }, [])

  const canConnect =
    authState === 'idle' &&
    (authTab === 'voucher'
      ? voucherCode.trim().length >= 4
      : authTab === 'room'
        ? roomNumber.trim().length >= 1 && lastName.trim().length >= 1
        : ldapUsername.trim().length >= 1 && ldapPassword.trim().length >= 1)

  // ── Success View ────────────────────────────────────
  if (authState === 'success') {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-emerald-950/40 to-gray-950 dark:from-background dark:via-primary/5 dark:to-background overflow-hidden">
        {/* Background effects */}
        <GridPattern />
        <FloatingOrb className="w-96 h-96 bg-emerald-500/20 dark:bg-emerald-500/8 -top-48 -left-48" />
        <FloatingOrb className="w-80 h-80 bg-teal-400/15 dark:bg-teal-400/6 bottom-0 right-0" delay={5} />
        <FloatingOrb className="w-64 h-64 bg-amber-500/10 dark:bg-amber-500/4 top-1/2 left-1/2" delay={10} />

        <motion.div
          className="relative z-10 w-full max-w-md mx-4"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
        >
          {/* Light mode card: glass dark | Dark mode card: card/90 */}
          <Card className="border-emerald-500/20 dark:border-border/20 bg-white/[0.04] dark:bg-card/90 backdrop-blur-2xl shadow-2xl shadow-emerald-500/10 dark:shadow-primary/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-6">
              {/* Animated Checkmark */}
              <motion.div
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 dark:shadow-emerald-500/15"
                variants={successPop}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-2"
              >
                {/* Light: white text | Dark: foreground */}
                <h2 className="text-2xl font-bold text-white dark:text-foreground">Connected!</h2>
                <p className="text-emerald-200/70 dark:text-muted-foreground text-sm">
                  You&apos;re now connected to <span className="font-semibold text-emerald-300 dark:text-primary">RoyalStay-Guest</span>
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="w-full space-y-3"
              >
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 dark:bg-primary/5 border border-emerald-500/15 dark:border-border/15">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-emerald-400 dark:text-primary" />
                    <span className="text-sm text-emerald-200/70 dark:text-muted-foreground">Session Time</span>
                  </div>
                  <SessionTimer />
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 dark:bg-primary/5 border border-emerald-500/15 dark:border-border/15">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-400 dark:text-amber-500" />
                    <span className="text-sm text-emerald-200/70 dark:text-muted-foreground">Speed</span>
                  </div>
                  <span className="text-sm font-medium text-emerald-300 dark:text-foreground">Up to 100 Mbps</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="w-full"
              >
                <a
                  href="https://www.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white dark:text-primary-foreground font-semibold text-sm hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 shadow-lg shadow-emerald-500/25 dark:shadow-primary/15 hover:shadow-emerald-500/40 dark:hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Continue Browsing
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ── Main Portal View ────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-emerald-950/30 to-gray-950 dark:from-background dark:via-primary/5 dark:to-background overflow-hidden">
      {/* ── Background Effects ─────────────────────────── */}
      <GridPattern />

      {/* Mesh gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,_oklch(from_var(--primary)_l_c_h_/_0.04)_0%,_transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(20,184,166,0.06)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_bottom_right,_oklch(0.65_0.16_170_/_0.03)_0%,_transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.03)_0%,_transparent_40%)] dark:bg-[radial-gradient(ellipse_at_center,_oklch(0.75_0.15_75_/_0.015)_0%,_transparent_40%)]" />
      </div>

      {/* Floating Orbs — lower opacity in dark mode */}
      <FloatingOrb className="w-[500px] h-[500px] bg-emerald-500/15 dark:bg-emerald-500/6 -top-64 -right-64" />
      <FloatingOrb className="w-[400px] h-[400px] bg-teal-400/10 dark:bg-teal-400/5 bottom-0 -left-32" delay={4} />
      <FloatingOrb className="w-[300px] h-[300px] bg-amber-500/8 dark:bg-amber-500/3 top-1/3 right-1/4" delay={8} />
      <FloatingOrb className="w-[250px] h-[250px] bg-emerald-300/6 dark:bg-emerald-300/2 bottom-1/4 right-1/3" delay={12} />

      {/* ── Main Content ──────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Branding */}
        <motion.div
          className="flex flex-col items-center gap-4 mb-8"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          {/* Logo */}
          <motion.div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/30 dark:shadow-primary/15"
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={80} height={80} className="object-contain w-full h-full" loading="eager" />
          </motion.div>

          <div className="text-center space-y-1.5">
            <motion.h1
              className="text-2xl sm:text-3xl font-bold text-white dark:text-foreground tracking-tight"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              Royal Stay Resort &amp; Spa
            </motion.h1>
            <motion.div
              className="flex items-center justify-center gap-2"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
            >
              <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
              <span className="text-emerald-300/60 dark:text-muted-foreground text-sm font-medium tracking-wide">
                Welcome to our WiFi
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
            </motion.div>
          </div>
        </motion.div>

        {/* Login Card */}
        <motion.div
          className="w-full max-w-md"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <Card className="border-white/[0.08] dark:border-border/20 bg-white/[0.03] dark:bg-card/90 backdrop-blur-2xl shadow-2xl shadow-black/20 dark:shadow-black/10 overflow-hidden">
            {/* Card gradient border accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 dark:via-primary/30 to-transparent" />

            <CardContent className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-primary/10 dark:to-primary/5 border border-emerald-500/20 dark:border-border/20 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-emerald-400 dark:text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white dark:text-foreground">
                    Connect to WiFi
                  </h2>
                  <p className="text-xs text-emerald-200/40 dark:text-muted-foreground/60">
                    Choose your authentication method
                  </p>
                </div>
              </div>

              {/* Auth Method Tabs */}
              <Tabs
                value={authTab}
                onValueChange={setAuthTab}
                className="w-full"
              >
                <TabsList className="w-full h-11 bg-white/[0.05] dark:bg-muted/50 border border-white/[0.08] dark:border-border/20 rounded-xl p-1">
                  <TabsTrigger
                    value="voucher"
                    className="flex-1 h-9 rounded-lg text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 dark:data-[state=active]:shadow-primary/15 data-[state=active]:border-0 text-emerald-200/50 dark:text-muted-foreground/70 transition-all duration-300"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    Voucher Code
                  </TabsTrigger>
                  <TabsTrigger
                    value="room"
                    className="flex-1 h-9 rounded-lg text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 dark:data-[state=active]:shadow-primary/15 data-[state=active]:border-0 text-emerald-200/50 dark:text-muted-foreground/70 transition-all duration-300"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    Room Number
                  </TabsTrigger>
                  <TabsTrigger
                    value="ldap"
                    className="flex-1 h-9 rounded-lg text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 dark:data-[state=active]:shadow-primary/15 data-[state=active]:border-0 text-emerald-200/50 dark:text-muted-foreground/70 transition-all duration-300"
                  >
                    <Network className="w-3.5 h-3.5" />
                    Corporate
                  </TabsTrigger>
                </TabsList>

                {/* Voucher Tab */}
                <AnimatePresence mode="wait">
                  {authTab === 'voucher' && (
                    <TabsContent value="voucher" className="mt-5">
                      <motion.div
                        key="voucher-form"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label
                            htmlFor="voucher-code"
                            className="text-sm font-medium text-emerald-200/60 dark:text-muted-foreground"
                          >
                            Enter your voucher code
                          </label>
                          <div className="relative">
                            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 dark:text-muted-foreground/50" />
                            <Input
                              id="voucher-code"
                              type="text"
                              placeholder="e.g. WIFI-2024-ABCD"
                              value={voucherCode}
                              onChange={(e) => setVoucherCode(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] dark:bg-muted/30 border-white/[0.1] dark:border-border/30 text-white dark:text-foreground placeholder:text-emerald-200/25 dark:placeholder:text-muted-foreground/40 focus-visible:border-emerald-500/50 dark:focus-visible:border-primary/50 focus-visible:ring-emerald-500/20 dark:focus-visible:ring-primary/15 pl-10 text-base tracking-wider rounded-xl"
                              onKeyDown={(e) =>
                                e.key === 'Enter' && canConnect && handleConnect()
                              }
                            />
                          </div>
                        </div>

                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={handleConnect}
                            disabled={!canConnect || authState === 'loading'}
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white dark:text-primary-foreground font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 dark:shadow-primary/10 hover:shadow-emerald-500/40 dark:hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                          >
                            <AnimatePresence mode="wait">
                              {authState === 'loading' ? (
                                <motion.span
                                  key="loading"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Connecting...
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="connect"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Shield className="w-4 h-4" />
                                  Connect
                                  <ChevronRight className="w-4 h-4" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                      </motion.div>
                    </TabsContent>
                  )}

                  {/* LDAP / Corporate Login Tab */}
                  {authTab === 'ldap' && (
                    <TabsContent value="ldap" className="mt-5">
                      <motion.div
                        key="ldap-form"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <p className="text-xs text-emerald-200/40 dark:text-muted-foreground/60">
                            Sign in with your corporate directory credentials
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="ldap-username"
                            className="text-sm font-medium text-emerald-200/60 dark:text-muted-foreground"
                          >
                            Username
                          </label>
                          <div className="relative">
                            <Network className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 dark:text-muted-foreground/50" />
                            <Input
                              id="ldap-username"
                              type="text"
                              placeholder="e.g. jsmith"
                              value={ldapUsername}
                              onChange={(e) => setLdapUsername(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] dark:bg-muted/30 border-white/[0.1] dark:border-border/30 text-white dark:text-foreground placeholder:text-emerald-200/25 dark:placeholder:text-muted-foreground/40 focus-visible:border-emerald-500/50 dark:focus-visible:border-primary/50 focus-visible:ring-emerald-500/20 dark:focus-visible:ring-primary/15 pl-10 text-base rounded-xl"
                              autoComplete="username"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="ldap-password"
                            className="text-sm font-medium text-emerald-200/60 dark:text-muted-foreground"
                          >
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 dark:text-muted-foreground/50" />
                            <Input
                              id="ldap-password"
                              type={showLdapPassword ? 'text' : 'password'}
                              placeholder="Enter your password"
                              value={ldapPassword}
                              onChange={(e) => setLdapPassword(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] dark:bg-muted/30 border-white/[0.1] dark:border-border/30 text-white dark:text-foreground placeholder:text-emerald-200/25 dark:placeholder:text-muted-foreground/40 focus-visible:border-emerald-500/50 dark:focus-visible:border-primary/50 focus-visible:ring-emerald-500/20 dark:focus-visible:ring-primary/15 pl-10 pr-10 text-base rounded-xl"
                              autoComplete="current-password"
                              onKeyDown={(e) =>
                                e.key === 'Enter' && canConnect && handleConnect()
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500/50 hover:text-emerald-400 dark:text-muted-foreground/50 dark:hover:text-muted-foreground transition-colors"
                              onClick={() => setShowLdapPassword(!showLdapPassword)}
                              tabIndex={-1}
                            >
                              {showLdapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={handleConnect}
                            disabled={!canConnect || authState === 'loading'}
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white dark:text-primary-foreground font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 dark:shadow-primary/10 hover:shadow-emerald-500/40 dark:hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                          >
                            <AnimatePresence mode="wait">
                              {authState === 'loading' ? (
                                <motion.span
                                  key="loading"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Authenticating...
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="connect"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Shield className="w-4 h-4" />
                                  Sign In via LDAP
                                  <ChevronRight className="w-4 h-4" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                      </motion.div>
                    </TabsContent>
                  )}

                  {/* Room Tab */}
                  {authTab === 'room' && (
                    <TabsContent value="room" className="mt-5">
                      <motion.div
                        key="room-form"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label
                            htmlFor="room-number"
                            className="text-sm font-medium text-emerald-200/60 dark:text-muted-foreground"
                          >
                            Room Number
                          </label>
                          <div className="relative">
                            <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 dark:text-muted-foreground/50" />
                            <Input
                              id="room-number"
                              type="text"
                              placeholder="e.g. 101"
                              value={roomNumber}
                              onChange={(e) => setRoomNumber(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] dark:bg-muted/30 border-white/[0.1] dark:border-border/30 text-white dark:text-foreground placeholder:text-emerald-200/25 dark:placeholder:text-muted-foreground/40 focus-visible:border-emerald-500/50 dark:focus-visible:border-primary/50 focus-visible:ring-emerald-500/20 dark:focus-visible:ring-primary/15 pl-10 text-base tracking-wider rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="last-name"
                            className="text-sm font-medium text-emerald-200/60 dark:text-muted-foreground"
                          >
                            Last Name
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50 dark:text-muted-foreground/50" />
                            <Input
                              id="last-name"
                              type="text"
                              placeholder="e.g. Smith"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] dark:bg-muted/30 border-white/[0.1] dark:border-border/30 text-white dark:text-foreground placeholder:text-emerald-200/25 dark:placeholder:text-muted-foreground/40 focus-visible:border-emerald-500/50 dark:focus-visible:border-primary/50 focus-visible:ring-emerald-500/20 dark:focus-visible:ring-primary/15 pl-10 text-base rounded-xl"
                              onKeyDown={(e) =>
                                e.key === 'Enter' && canConnect && handleConnect()
                              }
                            />
                          </div>
                        </div>

                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={handleConnect}
                            disabled={!canConnect || authState === 'loading'}
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white dark:text-primary-foreground font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 dark:shadow-primary/10 hover:shadow-emerald-500/40 dark:hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                          >
                            <AnimatePresence mode="wait">
                              {authState === 'loading' ? (
                                <motion.span
                                  key="loading"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Connecting...
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="connect"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-2"
                                >
                                  <Shield className="w-4 h-4" />
                                  Connect
                                  <ChevronRight className="w-4 h-4" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                      </motion.div>
                    </TabsContent>
                  )}
                </AnimatePresence>
              </Tabs>

              {/* MAC Address Debug (dev mode only) */}
              {rawMac && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-300/40 dark:text-emerald-400/40">
                    Device: {clientMac}
                  </span>
                </div>
              )}

              {/* Error Message with Retry */}
              <AnimatePresence>
                {(authState === 'error' || errorMsg) && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 dark:bg-red-500/5 dark:border-red-500/15"
                  >
                    <p className="text-sm text-red-400 dark:text-red-400">{errorMsg}</p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-2 text-xs font-medium text-red-300 hover:text-red-200 dark:text-red-300 dark:hover:text-red-200 underline underline-offset-2 transition-colors"
                    >
                      Try again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Info Section ─────────────────────────────── */}
        <motion.div
          className="w-full max-w-md mt-6 space-y-3"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] dark:bg-muted/30 border border-white/[0.06] dark:border-border/15 backdrop-blur-sm">
              <Wifi className="w-4 h-4 text-emerald-400 dark:text-primary" />
              <span className="text-sm text-emerald-200/50 dark:text-muted-foreground">Network:</span>
              <Badge className="bg-emerald-500/15 dark:bg-primary/10 text-emerald-300 dark:text-primary border-emerald-500/20 dark:border-primary/20 hover:bg-emerald-500/25 dark:hover:bg-primary/15">
                RoyalStay-Guest
              </Badge>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] dark:bg-muted/30 border border-white/[0.06] dark:border-border/15 backdrop-blur-sm">
              <Zap className="w-4 h-4 text-amber-400 dark:text-amber-500" />
              <span className="text-sm text-emerald-200/50 dark:text-muted-foreground">Speed:</span>
              <span className="text-sm font-medium text-amber-300 dark:text-foreground">
                Up to 100 Mbps
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-emerald-200/30 dark:text-muted-foreground/50">
            <button className="flex items-center gap-1 hover:text-emerald-300/60 dark:hover:text-primary transition-colors duration-200">
              <Shield className="w-3 h-3" />
              <span>Terms of Use</span>
            </button>
            <span>·</span>
            <button className="flex items-center gap-1 hover:text-emerald-300/60 dark:hover:text-primary transition-colors duration-200">
              <Lock className="w-3 h-3" />
              <span>Privacy Policy</span>
            </button>
            <span>·</span>
            <button className="flex items-center gap-1 hover:text-emerald-300/60 dark:hover:text-primary transition-colors duration-200">
              <Globe className="w-3 h-3" />
              <span>Support</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <motion.footer
        className="relative z-10 py-6 text-center"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="flex items-center justify-center gap-2">
          <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={20} height={20} className="object-contain" loading="eager" />
          <span className="text-xs text-emerald-200/25 dark:text-muted-foreground/40 font-medium">
            Powered by{' '}
            <span className="text-emerald-300/40 dark:text-primary/60">StaySuite HospitalityOS</span>
          </span>
        </div>
      </motion.footer>
    </div>
  )
}

// ── Default Export (Suspense boundary for useSearchParams) ──
export default function CaptivePortalPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-emerald-950/30 to-gray-950 dark:from-background dark:via-primary/5 dark:to-background">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/30">
              <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={64} height={64} className="object-contain w-full h-full" loading="eager" />
            </div>
          </motion.div>
        </div>
      }
    >
      <CaptivePortalContent />
    </Suspense>
  )
}
