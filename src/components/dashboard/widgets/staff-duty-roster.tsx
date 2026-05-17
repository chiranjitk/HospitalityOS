'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Users,
  Shield,
  Wrench,
  Coffee,
  Hotel,
  HeadphonesIcon,
  Clock,
  Phone,
  Mail,
  CircleDot,
  ArrowRight,
  RefreshCw,
  UserCheck,
  UserMinus,
  ChefHat,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  department: string;
  position: string;
  shift: string;
  status: 'active' | 'break' | 'off_duty';
  phone?: string;
  email?: string;
  avatarColor: string;
}

interface DepartmentGroup {
  id: string;
  name: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  borderColor: string;
  staff: StaffMember[];
}

// ─── Department Config ──────────────────────────────────────────────────

const departmentConfig: Record<string, {
  icon: typeof Users;
  color: string;
  gradient: string;
  bg: string;
  border: string;
}> = {
  'front-office': {
    icon: Hotel,
    color: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/50 dark:border-emerald-800/30',
  },
  'housekeeping': {
    icon: Shield,
    color: 'text-cyan-600 dark:text-cyan-400',
    gradient: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200/50 dark:border-cyan-800/30',
  },
  'maintenance': {
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200/50 dark:border-amber-800/30',
  },
  'food-beverage': {
    icon: ChefHat,
    color: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200/50 dark:border-rose-800/30',
  },
  'security': {
    icon: CircleDot,
    color: 'text-slate-600 dark:text-slate-400',
    gradient: 'from-slate-500 to-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-200/50 dark:border-slate-700/30',
  },
  'concierge': {
    icon: HeadphonesIcon,
    color: 'text-violet-600 dark:text-violet-400',
    gradient: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200/50 dark:border-violet-800/30',
  },
};

// ─── Status Config ──────────────────────────────────────────────────────

const statusConfig = {
  active: { label: 'Active', color: 'bg-emerald-500', ring: 'ring-emerald-500/30', badgeBg: 'bg-emerald-100 dark:bg-emerald-950/50', badgeText: 'text-emerald-700 dark:text-emerald-400' },
  break: { label: 'Break', color: 'bg-amber-500', ring: 'ring-amber-500/30', badgeBg: 'bg-amber-100 dark:bg-amber-950/50', badgeText: 'text-amber-700 dark:text-amber-400' },
  off_duty: { label: 'Off', color: 'bg-slate-400', ring: 'ring-slate-400/30', badgeBg: 'bg-slate-100 dark:bg-slate-800/50', badgeText: 'text-slate-500 dark:text-slate-400' },
};

// ─── Utility Helpers ──────────────────────────────────────────────────────

const avatarColors = [
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-purple-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-teal-500',
  'from-slate-400 to-slate-600',
  'from-primary to-primary/70',
];

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}



// ─── Skeleton ───────────────────────────────────────────────────────────

function RosterSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <div className="flex gap-2 pl-2">
            {[...Array(2)].map((_, j) => (
              <Skeleton key={j} className="h-20 flex-1 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Staff Card ─────────────────────────────────────────────────────────

function StaffCard({ staff, index }: { staff: StaffMember; index: number }) {
  const sConfig = statusConfig[staff.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        "group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5",
        "bg-card border-border/40 hover:border-border/60",
        departmentConfig[staff.department]?.bg,
        departmentConfig[staff.department]?.border
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        "absolute top-3 right-3",
      )}>
        <div className="flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full", sConfig.color, staff.status === 'active' && "animate-pulse")} />
          <span className={cn("text-[9px] font-medium", sConfig.badgeText)}>{sConfig.label}</span>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn(
          "relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br shadow-sm",
          "group-hover:shadow-md transition-all duration-200",
          staff.avatarColor
        )}>
          <span className="text-[11px] font-bold text-white">{staff.initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">{staff.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{staff.position}</p>
        </div>
      </div>

      {/* Shift info */}
      <div className="flex items-center gap-1.5 mt-1">
        <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/70">{staff.shift}</span>
      </div>

      {/* Contact actions on hover */}
      {staff.phone && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button className="flex items-center justify-center h-6 w-6 rounded-md bg-muted/50 hover:bg-muted transition-colors">
            <Phone className="h-3 w-3 text-muted-foreground" />
          </button>
          <button className="flex items-center justify-center h-6 w-6 rounded-md bg-muted/50 hover:bg-muted transition-colors">
            <Mail className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Department Section ─────────────────────────────────────────────────

function DepartmentSection({ dept, index }: { dept: DepartmentGroup; index: number }) {
  const config = departmentConfig[dept.id] || departmentConfig['front-office'];
  const Icon = config.icon;
  const activeCount = dept.staff.filter(s => s.status === 'active').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="space-y-2"
    >
      {/* Department header */}
      <div className="flex items-center gap-2 px-1">
        <div className={cn(
          "flex items-center justify-center h-6 w-6 rounded-md shadow-sm",
          "bg-gradient-to-br", config.gradient
        )}>
          <Icon className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-foreground">{dept.name}</span>
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 h-4 rounded-full border-transparent font-medium bg-muted/50 text-muted-foreground"
        >
          {activeCount}/{dept.staff.length} active
        </Badge>
      </div>

      {/* Staff cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {dept.staff.map((staff, sIdx) => (
          <StaffCard key={staff.id} staff={staff} index={sIdx} />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function StaffDutyRosterWidget() {
  const t = useTranslations('dashboard');
  const [departments, setDepartments] = useState<DepartmentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/staff-on-duty');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.staff?.length > 0) {
          // Map API data to department groups
          const deptMap: Record<string, DepartmentGroup> = {};
          json.data.staff.forEach((s: any) => {
            const deptId = (s.department || 'front-office').toLowerCase().replace(/\s+/g, '-');
            if (!deptMap[deptId]) {
              const cfg = departmentConfig[deptId] || departmentConfig['front-office'];
              deptMap[deptId] = {
                id: deptId,
                name: s.department || 'General',
                icon: cfg.icon,
                color: cfg.color,
                bgColor: cfg.bg,
                borderColor: cfg.border,
                staff: [],
              };
            }
            deptMap[deptId].staff.push({
              id: s.id || `s-${Math.random()}`,
              name: s.name || 'Staff',
              initials: getInitials(s.name || 'Staff'),
              department: s.department || 'General',
              position: s.position || s.role || 'Staff',
              shift: s.shift || 'On Duty',
              status: s.status === 'active' ? 'active' : s.status === 'break' ? 'break' : 'off_duty',
              phone: s.phone,
              avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
            });
          });
          const depts = Object.values(deptMap);
          setDepartments(depts);
          setError(false);
        } else {
          setDepartments([]);
          setError(true);
        }
      } else {
        setDepartments([]);
        setError(true);
      }
    } catch {
      setDepartments([]);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchStaff, 0);
    const interval = setInterval(fetchStaff, 120000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [fetchStaff]);

  const totalStaff = departments.reduce((sum, d) => sum + d.staff.length, 0);
  const activeStaff = departments.reduce((sum, d) => sum + d.staff.filter(s => s.status === 'active').length, 0);

  const displayedDepts = showAll ? departments : departments.slice(0, 3);

  return (
    <Card className="border border-border/60 shadow-md rounded-2xl bg-card overflow-hidden">
      {/* Top accent */}
      <div className="h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 shadow-sm">
              <Users className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('staffRoster')}</h3>
              <p className="text-[10px] text-muted-foreground/60">{t('staffRosterDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0 h-5 rounded-full border-transparent bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-medium"
            >
              <UserCheck className="h-2.5 w-2.5 mr-1" />
              {activeStaff} {t('activeStaff')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-muted/60"
              onClick={fetchStaff}
            >
              <RefreshCw className={cn("h-3 w-3 text-muted-foreground", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <RosterSkeleton />
        ) : error && departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-3 mb-2">
              <UserMinus className="h-6 w-6 text-red-400 dark:text-red-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Unable to load data.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setError(false); fetchStaff(); }}>Retry</Button>
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted/50 p-3 mb-2">
              <UserMinus className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t('noStaffOnDuty')}</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {displayedDepts.map((dept, idx) => (
              <DepartmentSection key={dept.id} dept={dept} index={idx} />
            ))}

            {/* Show more/less button */}
            {departments.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 hover:bg-muted/40 text-xs font-medium text-muted-foreground"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show All ${departments.length} Departments`}
                <ArrowRight className={cn("ml-1 h-3 w-3 transition-transform duration-200", showAll && "rotate-90")} />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
