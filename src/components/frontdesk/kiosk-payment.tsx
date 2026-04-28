'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Smartphone,
  Banknote,
  QrCode,
  CheckCircle,
  Loader2,
  ArrowLeft,
  X,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

// =============================================================================
// DEMO/SIMULATION NOTE: This is a kiosk demo payment component.
// No real payment processing. All payments succeed after a simulated delay.
// For production: integrate with actual payment gateways (Stripe, Razorpay, etc.)
// and ensure PCI-DSS compliance for card data handling.
// =============================================================================

// --- Types ---

export interface PaymentResult {
  paymentId: string;
  amount: number;
  method: string;
  receiptNumber: string;
  folioBalance: number;
  currency: string;
}

export interface KioskPaymentProps {
  bookingId: string;
  amount: number;
  currency: string;
  propertyName: string;
  description: string;
  onSuccess: (payment: PaymentResult) => void;
  onCancel: () => void;
  onBack: () => void;
}

type PaymentMethod = 'card' | 'upi' | 'cash' | 'qr_code';
type PaymentStep = 'method_select' | 'method_form' | 'processing' | 'success' | 'error';

interface PaymentMethodInfo {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// --- Payment Method Config ---

const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    id: 'card',
    label: 'Card Payment',
    icon: <CreditCard className="h-8 w-8" />,
    description: 'Credit or debit card',
  },
  {
    id: 'upi',
    label: 'UPI Payment',
    icon: <Smartphone className="h-8 w-8" />,
    description: 'Pay via UPI ID',
  },
  {
    id: 'cash',
    label: 'Cash Payment',
    icon: <Banknote className="h-8 w-8" />,
    description: 'Pay at front desk',
  },
  {
    id: 'qr_code',
    label: 'QR Code Payment',
    icon: <QrCode className="h-8 w-8" />,
    description: 'Scan & pay',
  },
];

const PROCESSING_DELAY_MS = 2500;

// --- Component ---

export default function KioskPayment({
  const t = useTranslations('frontdesk');
  bookingId,
  amount,
  currency,
  propertyName,
  description,
  onSuccess,
  onCancel,
  onBack,
}: KioskPaymentProps) {
  const [step, setStep] = useState<PaymentStep>('method_select');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Card form state (demo only)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // UPI form state (demo only)
  const [upiId, setUpiId] = useState('');

  // Success result
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  // --- Handlers ---

  const handleSelectMethod = useCallback((method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep('method_form');
    setErrorMsg('');
  }, []);

  const handleBackToMethods = useCallback(() => {
    setSelectedMethod(null);
    setStep('method_select');
    setErrorMsg('');
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const simulateProcessing = useCallback(async () => {
    setStep('processing');
    setIsProcessing(true);

    // Simulated delay to mimic payment gateway processing
    await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));

    try {
      const response = await fetch('/api/frontdesk/kiosk-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount,
          method: selectedMethod,
          currency,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        throw new Error(text);
      }

      const result = await response.json();

      if (result.success) {
        setPaymentResult(result.data);
        setStep('success');
      } else {
        setErrorMsg(result.error?.message || 'Payment failed');
        setStep('error');
      }
    } catch (err) {
      setErrorMsg('Unable to process payment. Please try again or visit the front desk.');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  }, [bookingId, amount, selectedMethod, currency]);

  const handleSubmitCardPayment = useCallback(() => {
    // In demo mode, we accept any card input
    simulateProcessing();
  }, [simulateProcessing]);

  const handleSubmitUpiPayment = useCallback(() => {
    // In demo mode, we accept any UPI ID
    simulateProcessing();
  }, [simulateProcessing]);

  const handleSubmitCashPayment = useCallback(() => {
    simulateProcessing();
  }, [simulateProcessing]);

  const handleSubmitQrPayment = useCallback(() => {
    simulateProcessing();
  }, [simulateProcessing]);

  const handleDone = useCallback(() => {
    if (paymentResult) {
      onSuccess(paymentResult);
    }
  }, [paymentResult, onSuccess]);

  const handleRetry = useCallback(() => {
    setSelectedMethod(null);
    setStep('method_select');
    setErrorMsg('');
  }, []);

  // --- Render Helpers ---

  const methodConfig = PAYMENT_METHODS.find((m) => m.id === selectedMethod);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {step !== 'processing' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-12 w-12"
              onClick={step === 'method_select' ? onBack : handleBackToMethods}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}
          <h1 className="text-xl font-semibold text-white">
            {step === 'method_select'
              ? 'Select Payment Method'
              : step === 'processing'
                ? 'Processing'
                : step === 'success'
                  ? 'Payment Complete'
                  : step === 'error'
                    ? 'Payment Issue'
                    : methodConfig?.label ?? 'Payment'}
          </h1>
        </div>

        {step !== 'processing' && step !== 'success' && (
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-12 w-12"
            onClick={onCancel}
          >
            <X className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Amount Display */}
      {step !== 'success' && (
        <div className="px-6 pb-4">
          <div className="bg-slate-800 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider mb-1">
              {description}
            </p>
            <p className="text-5xl font-bold text-white tracking-tight">
              {formatCurrency(amount)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {propertyName}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ==================== METHOD SELECT ==================== */}
          {step === 'method_select' && (
            <motion.div
              key="method_select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handleSelectMethod(method.id)}
                    className={cn(
                      'group bg-slate-800 hover:bg-slate-700 border-2 border-transparent hover:border-emerald-500/50',
                      'rounded-2xl p-6 text-left transition-all duration-200 active:scale-[0.98]',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900'
                    )}
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-slate-700 group-hover:bg-emerald-900/40 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 transition-colors">
                        {method.icon}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-white">
                          {method.label}
                        </p>
                        <p className="text-sm text-slate-400">
                          {method.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                <p className="text-xs text-slate-500">
                  Secure demo payment — no real charges will be made
                </p>
              </div>
            </motion.div>
          )}

          {/* ==================== CARD PAYMENT FORM ==================== */}
          {step === 'method_form' && selectedMethod === 'card' && (
            <motion.div
              key="card_form"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-slate-700 shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Card Payment</h2>
                      <p className="text-sm text-slate-400">Enter card details (demo mode)</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-4">
                    {/* Card Number */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Card Number
                      </label>
                      <Input
                        value={cardNumber}
                        onChange={(e) =>
                          setCardNumber(
                            e.target.value
                              .replace(/\D/g, '')
                              .replace(/(.{4})/g, '$1 ')
                              .trim()
                              .slice(0, 19)
                          )
                        }
                        placeholder="4242 4242 4242 4242"
                        className="h-14 text-lg bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                        autoFocus
                      />
                    </div>

                    {/* Expiry + CVV */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                          Expiry Date
                        </label>
                        <Input
                          value={cardExpiry}
                          onChange={(e) =>
                            setCardExpiry(
                              e.target.value
                                .replace(/\D/g, '')
                                .replace(/(\d{2})(\d)/, '$1/$2')
                                .slice(0, 5)
                            )
                          }
                          placeholder="MM/YY"
                          className="h-14 text-lg bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                          CVV
                        </label>
                        <Input
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="123"
                          type="password"
                          className="h-14 text-lg bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                    <p className="text-xs text-amber-300 text-center">
                      Demo Mode: Any card number will be accepted. No real charges.
                    </p>
                  </div>

                  {/* Pay Button */}
                  <Button
                    className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleSubmitCardPayment}
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay {formatCurrency(amount)}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={handleBackToMethods}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Payment Methods
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== UPI PAYMENT FORM ==================== */}
          {step === 'method_form' && selectedMethod === 'upi' && (
            <motion.div
              key="upi_form"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-slate-700 shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
                      <Smartphone className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">UPI Payment</h2>
                      <p className="text-sm text-slate-400">Enter your UPI ID</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        UPI ID
                      </label>
                      <Input
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="h-14 text-lg bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                    <p className="text-xs text-amber-300 text-center">
                      Demo Mode: Any UPI ID will be accepted. No real charges.
                    </p>
                  </div>

                  <Button
                    className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleSubmitUpiPayment}
                  >
                    <Smartphone className="h-5 w-5 mr-2" />
                    Pay {formatCurrency(amount)}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={handleBackToMethods}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Payment Methods
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== CASH PAYMENT ==================== */}
          {step === 'method_form' && selectedMethod === 'cash' && (
            <motion.div
              key="cash_form"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-slate-700 shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
                      <Banknote className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Cash Payment</h2>
                      <p className="text-sm text-slate-400">Pay at the front desk</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="bg-slate-900 rounded-xl p-6 text-center space-y-3">
                    <p className="text-sm text-slate-400 uppercase tracking-wider">
                      Amount Due
                    </p>
                    <p className="text-4xl font-bold text-white">
                      {formatCurrency(amount)}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-800/40 rounded-xl space-y-2">
                    <p className="text-sm text-blue-300 text-center font-medium">
                      Please pay at the front desk
                    </p>
                    <p className="text-xs text-blue-400/70 text-center">
                      A receipt will be generated upon confirmation. Our staff will collect the payment and confirm your transaction.
                    </p>
                  </div>

                  <Button
                    className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleSubmitCashPayment}
                  >
                    <Banknote className="h-5 w-5 mr-2" />
                    Confirm Cash Payment
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={handleBackToMethods}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Payment Methods
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== QR CODE PAYMENT ==================== */}
          {step === 'method_form' && selectedMethod === 'qr_code' && (
            <motion.div
              key="qr_form"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-slate-700 shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
                      <QrCode className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">QR Code Payment</h2>
                      <p className="text-sm text-slate-400">Scan to pay</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  {/* QR Code Placeholder */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                      <div className="text-center space-y-2">
                        <QrCode className="h-24 w-24 text-slate-800 mx-auto" />
                        <p className="text-xs text-slate-500 font-mono">DEMO-QR-CODE</p>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl px-6 py-3 text-center">
                      <p className="text-sm text-slate-400">Amount</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                    <p className="text-xs text-amber-300 text-center">
                      Demo Mode: Payment will be simulated. Scan recognition is not required.
                    </p>
                  </div>

                  <Button
                    className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleSubmitQrPayment}
                  >
                    <QrCode className="h-5 w-5 mr-2" />
                    Simulate QR Payment
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={handleBackToMethods}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Payment Methods
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== PROCESSING STATE ==================== */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <Card className="bg-slate-800 border-slate-700 shadow-2xl">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-white">
                      Processing Payment...
                    </h2>
                    <p className="text-slate-400">
                      {selectedMethod === 'card' && 'Authorizing card payment'}
                      {selectedMethod === 'upi' && 'Verifying UPI transaction'}
                      {selectedMethod === 'cash' && 'Recording cash payment'}
                      {selectedMethod === 'qr_code' && 'Confirming QR payment'}
                    </p>
                  </div>

                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-sm text-slate-300 font-medium">
                      {formatCurrency(amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {methodConfig?.label}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs text-slate-500">
                      Secure transaction
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== SUCCESS STATE ==================== */}
          {step === 'success' && paymentResult && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-emerald-700/50 shadow-2xl">
                <CardContent className="p-8 space-y-6">
                  {/* Success Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mx-auto w-20 h-20 rounded-full bg-emerald-900/40 flex items-center justify-center"
                  >
                    <CheckCircle className="h-10 w-10 text-emerald-400" />
                  </motion.div>

                  {/* Success Text */}
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold text-emerald-400">
                      Payment Successful!
                    </h2>
                    <p className="text-slate-400">
                      Your payment has been processed
                    </p>
                  </div>

                  <Separator className="bg-slate-700" />

                  {/* Receipt Summary */}
                  <div className="bg-slate-900 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider text-center">
                      Receipt
                    </h3>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Amount</span>
                        <span className="text-lg font-bold text-white">
                          {formatCurrency(paymentResult.amount)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Method</span>
                        <span className="text-sm font-medium text-white capitalize">
                          {paymentResult.method.replace('_', ' ')}
                        </span>
                      </div>

                      <Separator className="bg-slate-700" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Receipt No.</span>
                        <span className="text-sm font-mono text-emerald-400">
                          {paymentResult.receiptNumber}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Date</span>
                        <span className="text-sm text-white">
                          {new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Property</span>
                        <span className="text-sm text-white text-right max-w-[200px] truncate">
                          {propertyName}
                        </span>
                      </div>

                      {paymentResult.folioBalance > 0.01 && (
                        <>
                          <Separator className="bg-slate-700" />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Remaining Balance</span>
                            <span className="text-sm font-medium text-amber-400">
                              {formatCurrency(paymentResult.folioBalance)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleDone}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Continue
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== ERROR STATE ==================== */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              <Card className="bg-slate-800 border-red-700/50 shadow-2xl">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-900/40 flex items-center justify-center">
                    <X className="h-8 w-8 text-red-400" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-red-400">
                      Payment Failed
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {errorMsg || 'An unexpected error occurred'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-900 rounded-lg text-sm">
                    <p className="text-slate-300 font-medium">
                      Please visit the front desk for assistance
                    </p>
                    <p className="text-slate-500 mt-1">
                      Our staff will help you complete the payment
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-14 text-lg bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                      onClick={handleRetry}
                    >
                      Try Again
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-14 text-lg bg-slate-700 border-slate-600 text-red-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-700"
                      onClick={onCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-xs text-slate-600">
          Powered by StaySuite HospitalityOS
        </p>
      </div>
    </div>
  );
}
