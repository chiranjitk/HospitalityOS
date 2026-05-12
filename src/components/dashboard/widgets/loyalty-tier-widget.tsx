'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Shield,
  Medal,
  Crown,
  Gem,
  Star,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Gift,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────

interface TierDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
  minPoints: number;
  maxPoints: number;
  benefits: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
  barColor: string;
  stackedColor: string;
}

interface TopLoyaltyMember {
  name: string;
  tier: string;
  points: number;
  stays: number;
  avatar: string;
}

interface LoyaltyTierData {
  tiers: TierDefinition[];
  currentTier: string;
  currentPoints: number;
  nextTierPoints: number;
  topMembers: TopLoyaltyMember[];
  tierDistribution: { tier: string; percentage: number }[];
  totalMembers: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    icon: Shield,
    minPoints: 0,
    maxPoints: 2499,
    benefits: 3,
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/50',
    borderClass: 'border-orange-200 dark:border-orange-800',
    glowClass: 'shadow-orange-400/30',
    barColor: 'bg-orange-400',
    stackedColor: 'bg-orange-400',
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: Medal,
    minPoints: 2500,
    maxPoints: 7499,
    benefits: 6,
    colorClass: 'text-slate-500 dark:text-slate-300',
    bgClass: 'bg-slate-50 dark:bg-slate-800/50',
    borderClass: 'border-slate-300 dark:border-slate-600',
    glowClass: 'shadow-slate-400/30',
    barColor: 'bg-slate-400',
    stackedColor: 'bg-slate-400',
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: Crown,
    minPoints: 7500,
    maxPoints: 19999,
    benefits: 10,
    colorClass: 'text-amber-500 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-300 dark:border-amber-700',
    glowClass: 'shadow-amber-400/30',
    barColor: 'bg-amber-400',
    stackedColor: 'bg-amber-400',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: Gem,
    minPoints: 20000,
    maxPoints: 99999,
    benefits: 16,
    colorClass: 'text-violet-500 dark:text-violet-400',
    bgClass: 'bg-violet-50 dark:bg-violet-950/50',
    borderClass: 'border-violet-300 dark:border-violet-700',
    glowClass: 'shadow-violet-400/30',
    barColor: 'bg-violet-400',
    stackedColor: 'bg-violet-400',
  },
];

const MOCK_TOP_MEMBERS: TopLoyaltyMember[] = [
  { name: 'Rajesh Sharma', tier: 'platinum', points: 34520, stays: 48, avatar: 'RS' },
  { name: 'Priya Mehta', tier: 'gold', points: 18900, stays: 32, avatar: 'PM' },
  { name: 'David Chen', tier: 'gold', points: 12450, stays: 21, avatar: 'DC' },
  { name: 'Sarah Mitchell', tier: 'silver', points: 6780, stays: 14, avatar: 'SM' },
  { name: 'Anil Gupta', tier: 'silver', points: 4320, stays: 9, avatar: 'AG' },
];

const MOCK_TIER_DISTRIBUTION = [
  { tier: 'bronze', percentage: 45 },
  { tier: 'silver', percentage: 28 },
  { tier: 'gold', percentage: 18 },
  { tier: 'platinum', percentage: 9 },
];

// ── Skeleton ───────────────────────────────────────────────────────────────

function LoyaltyTierSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-orange-400 via-amber-400 to-violet-400" />
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        {/* Tier progression */}
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="flex-1 h-24 rounded-xl" />
          ))}
        </div>
        {/* Progress bar */}
        <Skeleton className="h-3 w-full rounded-full" />
        {/* Top members */}
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tier Card ──────────────────────────────────────────────────────────────

function TierCard({
  tier,
  index,
  isCurrent,
}: {
  tier: TierDefinition;
  index: number;
  isCurrent: boolean;
}) {
  const t = useTranslations('dashboard');
  const Icon = tier.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, duration: 0.4, ease: 'easeOut' }}
            className={cn(
              'relative flex-1 p-3 rounded-xl border cursor-pointer transition-all duration-300 group',
              isCurrent
                ? cn(
                    'ring-2 shadow-lg',
                    tier.borderClass,
                    tier.bgClass,
                    'ring-offset-1'
                  )
                : 'bg-card border-border/40 hover:border-border/60 hover:shadow-md'
            )}
          >
            {/* Animated glow for current tier */}
            {isCurrent && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-xl opacity-30 blur-md -z-10',
                  tier.barColor
                )}
                animate={{
                  opacity: [0.15, 0.35, 0.15],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Connector arrow */}
            {index < 3 && (
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}

            <div className="flex flex-col items-center text-center gap-2">
              {/* Icon */}
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300',
                  isCurrent
                    ? cn(tier.bgClass, 'shadow-md')
                    : 'bg-muted/60 group-hover:bg-muted/80'
                )}
              >
                <Icon className={cn('h-4.5 w-4.5', isCurrent ? tier.colorClass : 'text-muted-foreground')} />
              </motion.div>

              {/* Name */}
              <span className={cn(
                'text-[11px] font-bold leading-tight',
                isCurrent ? tier.colorClass : 'text-muted-foreground'
              )}>
                {tier.name}
              </span>

              {/* Points range */}
              <span className="text-[9px] text-muted-foreground/50 tabular-nums leading-tight">
                {tier.minPoints.toLocaleString()}–{tier.maxPoints === 99999 ? '∞' : tier.maxPoints.toLocaleString()}
              </span>

              {/* Benefits count */}
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                <Gift className="h-2.5 w-2.5" />
                <span>{tier.benefits}</span>
              </div>
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-semibold">{tier.name} Tier</p>
          <p className="text-muted-foreground">{tier.benefits} {t('loyaltyTierBenefits')}</p>
          <p className="text-muted-foreground">{tier.minPoints.toLocaleString()}+ {t('loyaltyTierPoints')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Top Member Row ────────────────────────────────────────────────────────

function TopMemberRow({ member, index }: { member: TopLoyaltyMember; index: number }) {
  const t = useTranslations('dashboard');
  const tierDef = MOCK_TIER_DEFINITIONS.find(t => t.id === member.tier);
  const TierIcon = tierDef?.icon || Star;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.07, duration: 0.3 }}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group"
    >
      {/* Avatar */}
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
        tierDef?.bgClass || 'bg-muted/60',
        tierDef?.colorClass || 'text-muted-foreground'
      )}>
        {member.avatar}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold truncate text-foreground">{member.name}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          {member.stays} {t('staysLower')} · {(member.points / 1000).toFixed(1)}K {t('loyaltyPointsLabel')}
        </p>
      </div>

      {/* Tier badge */}
      <div className="flex items-center gap-1 shrink-0">
        <Badge
          variant="outline"
          className={cn(
            'text-[9px] px-1.5 py-0 h-4 font-semibold border',
            tierDef?.borderClass || 'border-border',
            tierDef?.colorClass || 'text-muted-foreground',
            tierDef?.bgClass || ''
          )}
        >
          <TierIcon className="h-2.5 w-2.5 mr-0.5" />
          {member.tier.charAt(0).toUpperCase() + member.tier.slice(1)}
        </Badge>
        <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function LoyaltyTierWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<LoyaltyTierData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({
        tiers: MOCK_TIER_DEFINITIONS,
        currentTier: 'gold',
        currentPoints: 12450,
        nextTierPoints: 20000,
        topMembers: MOCK_TOP_MEMBERS,
        tierDistribution: MOCK_TIER_DISTRIBUTION,
        totalMembers: 1247,
      });
      setIsLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !data) {
    return <LoyaltyTierSkeleton />;
  }

  const currentTierDef = data.tiers.find(t => t.id === data.currentTier);
  const nextTierDef = data.tiers.find(t => t.minPoints > data.currentPoints);
  const progressToNext = nextTierDef
    ? ((data.currentPoints - (currentTierDef?.minPoints || 0)) / (nextTierDef.minPoints - (currentTierDef?.minPoints || 0))) * 100
    : 100;

  const pointsRemaining = nextTierDef ? nextTierDef.minPoints - data.currentPoints : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden hover-lift transition-all duration-300">
        {/* Gradient accent */}
        <div className="h-[2px] bg-gradient-to-r from-orange-400 via-amber-400 to-violet-400" />

        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-violet-500 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('loyaltyTierProgram')}</h3>
                <p className="text-[10px] text-muted-foreground/60">{data.totalMembers} {t('membersLower')}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-primary/40 text-primary bg-primary/5 font-medium">
              {(data.currentPoints / 1000).toFixed(1)}K {t('loyaltyPointsLabel')}
            </Badge>
          </div>

          {/* Tier Progression */}
          <div className="flex gap-1.5">
            {data.tiers.map((tier, i) => (
              <TierCard
                key={tier.id}
                tier={tier}
                index={i}
                isCurrent={tier.id === data.currentTier}
              />
            ))}
          </div>

          {/* Progress to next tier */}
          {nextTierDef && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {currentTierDef?.name} → {nextTierDef.name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-primary tabular-nums">
                  {pointsRemaining.toLocaleString()} pts to go
                </span>
              </div>
              <div className="relative">
                <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                    transition={{ delay: 0.6, duration: 1, ease: 'easeOut' }}
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r',
                      currentTierDef?.barColor || 'bg-primary',
                      'opacity-80'
                    )}
                  />
                </div>
                {/* Progress marker */}
                <motion.div
                  initial={{ left: 0, opacity: 0 }}
                  animate={{ left: `${Math.min(progressToNext, 100)}%`, opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                  className="absolute top-1/2 -translate-y-1/2 h-4 w-1.5 rounded-full bg-primary shadow-sm"
                />
              </div>
            </div>
          )}

          {/* Tier Distribution Bar */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              {t('tierDistribution')}
            </p>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
              {data.tierDistribution.map((d, i) => {
                const tierDef = data.tiers.find(t => t.id === d.tier);
                return (
                  <TooltipProvider key={d.tier} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${d.percentage}%` }}
                          transition={{ delay: 0.8 + i * 0.1, duration: 0.5, ease: 'easeOut' }}
                          className={cn('h-full rounded-full cursor-pointer', tierDef?.stackedColor || 'bg-muted')}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px]">
                        <p className="font-semibold">{tierDef?.name} – {d.percentage}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-3 pt-0.5">
              {data.tiers.map(tier => (
                <div key={tier.id} className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', tier.stackedColor)} />
                  <span className="text-[9px] text-muted-foreground/60">{tier.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Members */}
          <div className="space-y-1 pt-2 border-t border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              {t('topLoyaltyMembers')}
            </p>
            <div className="space-y-0.5 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
              {data.topMembers.map((member, i) => (
                <TopMemberRow key={member.name} member={member} index={i} />
              ))}
            </div>
          </div>

          {/* View All Link */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          >
            {t('viewAllMembers')}
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
