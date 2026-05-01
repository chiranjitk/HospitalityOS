'use client'

import { useState, useEffect, useCallback } from 'react'
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
        className="absolute inset-0 opacity-[0.03]"
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
    <span className="font-mono tabular-nums text-sm text-emerald-300/80">
      {String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:
      {String(secs).padStart(2, '0')}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────
export default function CaptivePortalPage() {
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [authTab, setAuthTab] = useState<string>('voucher')
  const [voucherCode, setVoucherCode] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleConnect = useCallback(async () => {
    setErrorMsg('')
    setAuthState('loading')

    // Determine payload based on tab
    const payload =
      authTab === 'voucher'
        ? { method: 'voucher', code: voucherCode }
        : { method: 'room', roomNumber, lastName }

    try {
      const res = await fetch('/api/wifi/captive/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        // Demo mode: still show success
        console.warn('Auth API returned:', data)
      }
    } catch (err) {
      // Demo mode: still show success
      console.warn('Auth API unavailable (demo mode):', err)
    }

    // Simulate connection delay
    setTimeout(() => {
      setAuthState('success')
    }, 2000)
  }, [authTab, voucherCode, roomNumber, lastName])

  const canConnect =
    authTab === 'voucher'
      ? voucherCode.trim().length >= 4
      : roomNumber.trim().length >= 1 && lastName.trim().length >= 1

  // ── Success View ────────────────────────────────────
  if (authState === 'success') {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-emerald-950/40 to-gray-950 overflow-hidden">
        {/* Background effects */}
        <GridPattern />
        <FloatingOrb className="w-96 h-96 bg-emerald-500/20 -top-48 -left-48" />
        <FloatingOrb className="w-80 h-80 bg-teal-400/15 bottom-0 right-0" delay={5} />
        <FloatingOrb className="w-64 h-64 bg-amber-500/10 top-1/2 left-1/2" delay={10} />

        <motion.div
          className="relative z-10 w-full max-w-md mx-4"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
        >
          <Card className="border-emerald-500/20 bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-emerald-500/10">
            <CardContent className="p-8 flex flex-col items-center text-center gap-6">
              {/* Animated Checkmark */}
              <motion.div
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
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
                <h2 className="text-2xl font-bold text-white">Connected!</h2>
                <p className="text-emerald-200/70 text-sm">
                  You&apos;re now connected to <span className="font-semibold text-emerald-300">RoyalStay-Guest</span>
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="w-full space-y-3"
              >
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-200/70">Session Time</span>
                  </div>
                  <SessionTimer />
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-emerald-200/70">Speed</span>
                  </div>
                  <span className="text-sm font-medium text-emerald-300">Up to 100 Mbps</span>
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
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
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
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-emerald-950/30 to-gray-950 overflow-hidden">
      {/* ── Background Effects ─────────────────────────── */}
      <GridPattern />

      {/* Mesh gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.08)_0%,_transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(20,184,166,0.06)_0%,_transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.03)_0%,_transparent_40%)]" />
      </div>

      {/* Floating Orbs */}
      <FloatingOrb className="w-[500px] h-[500px] bg-emerald-500/15 -top-64 -right-64" />
      <FloatingOrb className="w-[400px] h-[400px] bg-teal-400/10 bottom-0 -left-32" delay={4} />
      <FloatingOrb className="w-[300px] h-[300px] bg-amber-500/8 top-1/3 right-1/4" delay={8} />
      <FloatingOrb className="w-[250px] h-[250px] bg-emerald-300/6 bottom-1/4 right-1/3" delay={12} />

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
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
              SS
            </span>
          </motion.div>

          <div className="text-center space-y-1.5">
            <motion.h1
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
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
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-emerald-300/60 text-sm font-medium tracking-wide">
                Welcome to our WiFi
              </span>
              <Sparkles className="w-4 h-4 text-amber-400" />
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
          <Card className="border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden">
            {/* Card gradient border accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            <CardContent className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Connect to WiFi
                  </h2>
                  <p className="text-xs text-emerald-200/40">
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
                <TabsList className="w-full h-11 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1">
                  <TabsTrigger
                    value="voucher"
                    className="flex-1 h-9 rounded-lg text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 data-[state=active]:border-0 text-emerald-200/50 transition-all duration-300"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    Voucher Code
                  </TabsTrigger>
                  <TabsTrigger
                    value="room"
                    className="flex-1 h-9 rounded-lg text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/25 data-[state=active]:border-0 text-emerald-200/50 transition-all duration-300"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    Room Number
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
                            className="text-sm font-medium text-emerald-200/60"
                          >
                            Enter your voucher code
                          </label>
                          <div className="relative">
                            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                            <Input
                              id="voucher-code"
                              type="text"
                              placeholder="e.g. WIFI-2024-ABCD"
                              value={voucherCode}
                              onChange={(e) => setVoucherCode(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-emerald-200/25 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 pl-10 text-base tracking-wider rounded-xl"
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
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
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
                            className="text-sm font-medium text-emerald-200/60"
                          >
                            Room Number
                          </label>
                          <div className="relative">
                            <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                            <Input
                              id="room-number"
                              type="text"
                              placeholder="e.g. 101"
                              value={roomNumber}
                              onChange={(e) => setRoomNumber(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-emerald-200/25 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 pl-10 text-base tracking-wider rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="last-name"
                            className="text-sm font-medium text-emerald-200/60"
                          >
                            Last Name
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                            <Input
                              id="last-name"
                              type="text"
                              placeholder="e.g. Smith"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              disabled={authState === 'loading'}
                              className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-emerald-200/25 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 pl-10 text-base rounded-xl"
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
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
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

              {/* Error Message */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <p className="text-sm text-red-400">{errorMsg}</p>
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
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-200/50">Network:</span>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/25">
                RoyalStay-Guest
              </Badge>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-emerald-200/50">Speed:</span>
              <span className="text-sm font-medium text-amber-300">
                Up to 100 Mbps
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-emerald-200/30">
            <button className="flex items-center gap-1 hover:text-emerald-300/60 transition-colors duration-200">
              <Shield className="w-3 h-3" />
              <span>Terms of Use</span>
            </button>
            <span>·</span>
            <button className="flex items-center gap-1 hover:text-emerald-300/60 transition-colors duration-200">
              <Lock className="w-3 h-3" />
              <span>Privacy Policy</span>
            </button>
            <span>·</span>
            <button className="flex items-center gap-1 hover:text-emerald-300/60 transition-colors duration-200">
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
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">SS</span>
          </div>
          <span className="text-xs text-emerald-200/25 font-medium">
            Powered by{' '}
            <span className="text-emerald-300/40">StaySuite HospitalityOS</span>
          </span>
        </div>
      </motion.footer>
    </div>
  )
}
