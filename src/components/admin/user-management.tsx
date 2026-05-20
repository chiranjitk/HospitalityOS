'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Key,
  MoreHorizontal,
  Shield,
  Mail,
  Phone,
  Building,
  Building2,
  Loader2,
  UserCheck,
  UserX,
  RefreshCw,
  Star,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SectionGuard } from '@/components/common/section-guard';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { useTranslations } from 'next-intl';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserPropertyAssignment {
  id: string;
  userId: string;
  propertyId: string;
  role: string;
  isDefault: boolean;
  property: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Tenant {
  id: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
  slug?: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  status: string;
  roleId?: string;
  tenantId?: string;
  isPlatformAdmin?: boolean;
  role?: {
    id: string;
    name: string;
    displayName: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  userPropertyAssignments?: UserPropertyAssignment[];
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PROPERTY_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'night_auditor', label: 'Night Auditor' },
  { value: 'revenue_manager', label: 'Revenue Manager' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'accountant', label: 'Accountant' },
];

const TOTAL_STEPS_TENANT = 3; // Basic Info → Property Assignment → Review
const TOTAL_STEPS_PLATFORM = 2; // Basic Info → Review (skip property step)

function getPropertyRoleLabel(roleValue: string): string {
  const found = PROPERTY_ROLES.find(r => r.value === roleValue);
  return found ? found.label : roleValue;
}

// ─── Step Indicator Component ────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  totalSteps,
  stepLabels,
}: {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <div key={step} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-200',
                  isCompleted &&
                    'bg-teal-600 text-white shadow-md shadow-teal-500/25',
                  isCurrent &&
                    'bg-white border-2 border-teal-600 text-teal-600 dark:bg-teal-950 dark:border-teal-400 dark:text-teal-400',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step}
              </div>
              <span
                className={cn(
                  'text-[10px] sm:text-xs hidden sm:block',
                  isCurrent ? 'font-medium text-teal-600 dark:text-teal-400' : 'text-muted-foreground'
                )}
              >
                {stepLabels[i]}
              </span>
            </div>
            {step < totalSteps && (
              <div
                className={cn(
                  'w-8 sm:w-12 h-0.5 rounded-full transition-colors duration-200',
                  step < currentStep ? 'bg-teal-600' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Property Badge Component ────────────────────────────────────────────────

function PropertyBadges({ assignments }: { assignments?: UserPropertyAssignment[] }) {
  if (!assignments || assignments.length === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 gap-1"
      >
        <AlertTriangle className="w-3 h-3" />
        No Property Assigned
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignments.map((a) => (
        <Badge
          key={a.id}
          variant="secondary"
          className="bg-gradient-to-r from-teal-50 to-stone-50 text-teal-800 border border-teal-200 dark:from-teal-950 dark:to-stone-950 dark:text-teal-300 dark:border-teal-800 gap-0.5 px-1.5 py-0.5 text-[11px]"
        >
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[100px]">{a.property.name}</span>
          <span className="text-teal-600 dark:text-teal-400 font-medium">
            ({getPropertyRoleLabel(a.role)})
          </span>
          {a.isDefault && (
            <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
          )}
        </Badge>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UserManagement() {
  const t = useTranslations('admin');
  const { user: currentUser, isPlatformAdmin } = useAuth();
  const { hasPermission } = usePermissions();

  // ─── Data State ──────────────────────────────────────────────────────────

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // Tenant admin: only show staff roles (no admin/platform_admin)
  const availableRoles = useMemo(() => {
    if (isPlatformAdmin) return roles;
    const STAFF_ONLY_ROLES = [
      'manager', 'front_desk', 'housekeeping', 'night_auditor',
      'revenue_manager', 'marketing', 'accountant', 'maintenance',
    ];
    return roles.filter((r) => STAFF_ONLY_ROLES.includes(r.name));
  }, [roles, isPlatformAdmin]);

  // ─── Filter State ────────────────────────────────────────────────────────

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // ─── Dialog States ───────────────────────────────────────────────────────

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Stepper State ───────────────────────────────────────────────────────

  const [currentStep, setCurrentStep] = useState(1);

  // ─── Form State ──────────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    jobTitle: '',
    department: '',
    roleId: '',
    status: 'active',
    password: '',
    tenantId: '',
    isPlatformAdmin: false,
    propertyAssignments: [] as Array<{
      propertyId: string;
      role: string;
      isDefault: boolean;
    }>,
  });

  const totalSteps = isPlatformAdmin ? TOTAL_STEPS_PLATFORM : TOTAL_STEPS_TENANT;

  const stepLabels = isPlatformAdmin
    ? ['Basic Info', 'Review']
    : ['Basic Info', 'Properties', 'Review'];

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (isPlatformAdmin && tenantFilter !== 'all') {
        params.set('tenantId', tenantFilter);
      }
      const url = `/api/users${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || data.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data.roles || data.data || []);
    } catch {
      // Silently fail
    }
  };

  const fetchTenants = async () => {
    if (!isPlatformAdmin) return;
    try {
      const response = await fetch('/api/tenants');
      if (!response.ok) return;
      const data = await response.json();
      setTenants(
        (data.data?.tenants || data.tenants || []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        }))
      );
    } catch {
      // Silently fail
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties?limit=100');
      if (!response.ok) return;
      const data = await response.json();
      const list = data.properties || data.data || [];
      setProperties(
        list.map((p: { id: string; name: string; slug?: string }) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))
      );
    } catch {
      // Silently fail
    }
  };

  const initialFetchDone = useRef(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchTenants();
    fetchProperties();
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      return;
    }
    fetchUsers();
  }, [tenantFilter]);

  // ─── Form Helpers ────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      jobTitle: '',
      department: '',
      roleId: '',
      status: 'active',
      password: '',
      tenantId: currentUser?.tenantId || '',
      isPlatformAdmin: false,
      propertyAssignments: [],
    });
    setCurrentStep(1);
  }, [currentUser?.tenantId]);

  const togglePropertyAssignment = useCallback(
    (propertyId: string, checked: boolean) => {
      setFormData((prev) => {
        const exists = prev.propertyAssignments.find((a) => a.propertyId === propertyId);
        if (checked && !exists) {
          // Add with default role; first added becomes default if none exists
          const hasDefault = prev.propertyAssignments.some((a) => a.isDefault);
          return {
            ...prev,
            propertyAssignments: [
              ...prev.propertyAssignments,
              { propertyId, role: 'front_desk', isDefault: !hasDefault },
            ],
          };
        }
        if (!checked && exists) {
          const removed = prev.propertyAssignments.filter((a) => a.propertyId !== propertyId);
          // If removed was default, make the first remaining one default
          if (exists.isDefault && removed.length > 0 && !removed.some((a) => a.isDefault)) {
            removed[0].isDefault = true;
          }
          return { ...prev, propertyAssignments: removed };
        }
        return prev;
      });
    },
    []
  );

  const updatePropertyRole = useCallback((propertyId: string, role: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyAssignments: prev.propertyAssignments.map((a) =>
        a.propertyId === propertyId ? { ...a, role } : a
      ),
    }));
  }, []);

  const setPropertyDefault = useCallback((propertyId: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyAssignments: prev.propertyAssignments.map((a) => ({
        ...a,
        isDefault: a.propertyId === propertyId,
      })),
    }));
  }, []);

  // ─── CRUD Handlers ──────────────────────────────────────────────────────

  const handleAddUser = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Tenant admin: require at least one property assignment
    if (!isPlatformAdmin && formData.propertyAssignments.length === 0) {
      toast.error('Please assign the user to at least one property');
      return;
    }

    try {
      setIsSaving(true);
      const payload: Record<string, unknown> = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        jobTitle: formData.jobTitle,
        department: formData.department,
        roleId: formData.roleId || null,
        status: formData.status,
        password: formData.password,
        propertyAssignments: formData.propertyAssignments,
      };

      if (isPlatformAdmin) {
        payload.tenantId = formData.tenantId || currentUser?.tenantId;
        payload.isPlatformAdmin = formData.isPlatformAdmin;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      toast.success('User created successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !formData.email || !formData.firstName || !formData.lastName) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Tenant admin: require at least one property assignment
    if (!isPlatformAdmin && formData.propertyAssignments.length === 0) {
      toast.error('Please assign the user to at least one property');
      return;
    }

    try {
      setIsSaving(true);
      const payload: Record<string, unknown> = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        jobTitle: formData.jobTitle,
        department: formData.department,
        roleId: formData.roleId || null,
        status: formData.status,
        propertyAssignments: formData.propertyAssignments,
      };

      if (isPlatformAdmin) {
        payload.isPlatformAdmin = formData.isPlatformAdmin;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      toast.success('User updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !formData.password) {
      toast.error('Please enter a new password');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: formData.password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully');
      setIsResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setFormData((prev) => ({ ...prev, password: '' }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch {
      toast.error('Failed to update user status');
    }
  };

  // ─── Dialog Openers ─────────────────────────────────────────────────────

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setCurrentStep(1);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      jobTitle: user.jobTitle || '',
      department: user.department || '',
      roleId: user.roleId || '',
      status: user.status,
      password: '',
      tenantId: user.tenantId || '',
      isPlatformAdmin: user.isPlatformAdmin || false,
      propertyAssignments: (user.userPropertyAssignments || []).map((a) => ({
        propertyId: a.propertyId,
        role: a.role,
        isDefault: a.isDefault,
      })),
    });
    setIsEditDialogOpen(true);
  };

  // ─── Stepper Navigation ─────────────────────────────────────────────────

  const canProceedFromStep1 = (): boolean => {
    if (isAddDialogOpen) {
      return !!(
        formData.firstName.trim() &&
        formData.lastName.trim() &&
        formData.email.trim() &&
        formData.password.trim()
      );
    }
    return !!(
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim()
    );
  };

  const canProceedFromStep2 = (): boolean => {
    return formData.propertyAssignments.length > 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !canProceedFromStep1()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (currentStep === 2 && !canProceedFromStep2()) {
      toast.error('Please assign the user to at least one property');
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────

  const tenantSafeUsers = useMemo(() => {
    if (isPlatformAdmin) return users;
    return users.filter(
      (user) => user.tenantId === currentUser?.tenantId && !user.isPlatformAdmin
    );
  }, [users, isPlatformAdmin, currentUser?.tenantId]);

  const filteredUsers = useMemo(() => {
    return tenantSafeUsers.filter((user) => {
      const matchesSearch =
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${user.firstName} ${user.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.roleId === roleFilter;

      const matchesProperty =
        propertyFilter === 'all' ||
        (user.userPropertyAssignments || []).some((a) => a.propertyId === propertyFilter);

      return matchesSearch && matchesStatus && matchesRole && matchesProperty;
    });
  }, [tenantSafeUsers, searchQuery, statusFilter, roleFilter, propertyFilter]);

  // ─── Badge Helpers ──────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: 'default' | 'destructive' | 'secondary' | 'outline'; label: string; className?: string }
    > = {
      active: {
        variant: 'outline',
        label: 'Active',
        className:
          'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-900 dark:to-emerald-800 dark:text-emerald-300',
      },
      inactive: {
        variant: 'secondary',
        label: 'Inactive',
        className:
          'bg-gradient-to-r from-red-100 to-red-200 text-red-800 dark:from-red-900 dark:to-red-800 dark:text-red-300',
      },
      suspended: {
        variant: 'destructive',
        label: 'Suspended',
        className:
          'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300',
      },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return (
      <Badge variant={config.variant} className={cn(config.className, 'shadow-sm')}>
        {config.label}
      </Badge>
    );
  };

  const getRoleBadge = (role?: { name: string; displayName: string }) => {
    if (!role) return <Badge variant="outline">No Role</Badge>;
    const colors: Record<string, string> = {
      admin: 'bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 dark:from-violet-900 dark:to-violet-800 dark:text-violet-300',
      manager: 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900 dark:to-blue-800 dark:text-blue-300',
      front_desk:
        'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-900 dark:to-emerald-800 dark:text-emerald-300',
      housekeeping:
        'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300',
    };
    const colorClass =
      colors[role.name] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium shadow-sm', colorClass)}>
        {role.displayName}
      </span>
    );
  };

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = {
    total: tenantSafeUsers.length,
    active: tenantSafeUsers.filter((u) => u.status === 'active').length,
    inactive: tenantSafeUsers.filter((u) => u.status === 'inactive').length,
    verified: tenantSafeUsers.filter((u) => u.isVerified).length,
  };

  // ─── Table column count helper ──────────────────────────────────────────

  const tableColumns = useMemo(() => {
    let count = 3; // User, Role, Actions
    if (isPlatformAdmin) count += 1; // Tenant
    count += 2; // Department, Status, Last Login → 3 but we'll merge
    count += 1; // Assigned Properties
    count += 1; // Last Login
    return count;
  }, [isPlatformAdmin]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  // ─── Render: Stepper Dialog Content ─────────────────────────────────────

  const renderStep1Content = (isEdit: boolean) => (
    <div className="space-y-4">
      {/* Tenant selector: only visible to platform admins */}
      {!isEdit && isPlatformAdmin && tenants.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="tenant">Tenant *</Label>
          <Select
            value={formData.tenantId}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, tenantId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Platform admin toggle: only visible to platform admins */}
      {isPlatformAdmin && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
          <input
            type="checkbox"
            id={isEdit ? 'edit-isPlatformAdmin' : 'isPlatformAdmin'}
            checked={formData.isPlatformAdmin}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isPlatformAdmin: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300 text-purple-600 dark:text-purple-400 focus:ring-purple-500"
          />
          <div>
            <Label
              htmlFor={isEdit ? 'edit-isPlatformAdmin' : 'isPlatformAdmin'}
              className="text-sm font-medium text-purple-900 dark:text-purple-200"
            >
              Platform Admin
            </Label>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              Grant full access to all tenants and platform-level features
            </p>
          </div>
        </div>
      )}

      {/* Tenant info for platform admins (edit only) */}
      {isEdit && isPlatformAdmin && selectedUser?.tenant?.name && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Tenant: {selectedUser.tenant.name}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-firstName' : 'firstName'}>
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={isEdit ? 'edit-firstName' : 'firstName'}
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-lastName' : 'lastName'}>
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={isEdit ? 'edit-lastName' : 'lastName'}
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={isEdit ? 'edit-email' : 'email'}>
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id={isEdit ? 'edit-email' : 'email'}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="john@company.com"
        />
      </div>

      {/* Password: only in Add mode */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="password">
            Password <span className="text-red-500">*</span>
          </Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Minimum 6 characters"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-phone' : 'phone'}>Phone</Label>
          <Input
            id={isEdit ? 'edit-phone' : 'phone'}
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+1-555-0100"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-role' : 'role'}>Role</Label>
          <Select
            value={formData.roleId}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, roleId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-jobTitle' : 'jobTitle'}>Job Title</Label>
          <Input
            id={isEdit ? 'edit-jobTitle' : 'jobTitle'}
            value={formData.jobTitle}
            onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
            placeholder="Manager"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={isEdit ? 'edit-department' : 'department'}>Department</Label>
          <Input
            id={isEdit ? 'edit-department' : 'department'}
            value={formData.department}
            onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
            placeholder="Front Desk"
          />
        </div>
      </div>

      {/* Status: only in Edit mode */}
      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="edit-status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const renderStep2Content = () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Assign to Properties</h4>
        <p className="text-xs text-muted-foreground">
          Select which properties this user can access and set their per-property role.
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Building2 className="h-8 w-8" />
          <p className="text-sm">No properties found in your tenant.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-3">
            {properties.map((prop) => {
              const assignment = formData.propertyAssignments.find(
                (a) => a.propertyId === prop.id
              );
              const isChecked = !!assignment;

              return (
                <div
                  key={prop.id}
                  className={cn(
                    'rounded-lg border p-3 transition-all duration-150',
                    isChecked
                      ? 'border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-950/30'
                      : 'border-muted hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        togglePropertyAssignment(prop.id, !!checked)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span className="font-medium text-sm truncate">{prop.name}</span>
                        {isChecked && assignment?.isDefault && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-[10px] gap-0.5 ml-auto shrink-0"
                          >
                            <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            Default
                          </Badge>
                        )}
                      </div>

                      {isChecked && (
                        <div className="flex flex-col sm:flex-row gap-2 mt-2 pl-6">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">
                              Per-Property Role
                            </Label>
                            <Select
                              value={assignment?.role || 'front_desk'}
                              onValueChange={(value) =>
                                updatePropertyRole(prop.id, value)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROPERTY_ROLES.map((pr) => (
                                  <SelectItem key={pr.value} value={pr.value}>
                                    {pr.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => setPropertyDefault(prop.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors h-8',
                                assignment?.isDefault
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                                  : 'text-muted-foreground hover:bg-muted'
                              )}
                              title="Set as default landing property"
                            >
                              <Star
                                className={cn(
                                  'w-3 h-3',
                                  assignment?.isDefault
                                    ? 'text-amber-500 fill-amber-500'
                                    : ''
                                )}
                              />
                              Default
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground text-center pt-2">
        {formData.propertyAssignments.length === 0
          ? 'No properties selected'
          : `User will be assigned to ${formData.propertyAssignments.length} propert${formData.propertyAssignments.length === 1 ? 'y' : 'ies'}`}
      </div>
    </div>
  );

  const renderStep3Content = (isEdit: boolean) => {
    const selectedRole = roles.find((r) => r.id === formData.roleId);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {formData.firstName} {formData.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </p>
              <p className="text-sm font-semibold mt-0.5">{formData.email}</p>
            </div>
          </div>

          {(formData.phone || formData.jobTitle || formData.department) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {formData.phone && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Phone
                  </p>
                  <p className="text-sm mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {formData.phone}
                  </p>
                </div>
              )}
              {formData.jobTitle && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Job Title
                  </p>
                  <p className="text-sm mt-0.5">{formData.jobTitle}</p>
                </div>
              )}
              {formData.department && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Department
                  </p>
                  <p className="text-sm mt-0.5">{formData.department}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Role
            </p>
            {selectedRole ? getRoleBadge(selectedRole) : <Badge variant="outline">No Role</Badge>}
          </div>

          {!isPlatformAdmin && formData.propertyAssignments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Property Assignments
              </p>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs h-8">Property</TableHead>
                      <TableHead className="text-xs h-8">Role</TableHead>
                      <TableHead className="text-xs h-8 w-20 text-center">Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.propertyAssignments.map((a) => {
                      const prop = properties.find((p) => p.id === a.propertyId);
                      return (
                        <TableRow key={a.propertyId} className="h-8">
                          <TableCell className="text-xs py-2">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              {prop?.name || a.propertyId}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {getPropertyRoleLabel(a.role)}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-center">
                            {a.isDefault ? (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepperFooter = (
    isEdit: boolean,
    onSave: () => void,
    saveLabel: string
  ) => (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        onClick={handlePrevStep}
        disabled={currentStep === 1}
        className="gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            if (isEdit) setIsEditDialogOpen(false);
            else setIsAddDialogOpen(false);
            resetForm();
          }}
        >
          Cancel
        </Button>
        {currentStep < totalSteps ? (
          <Button onClick={handleNextStep} className="gap-1">
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  );

  // ─── User Actions (shared for mobile and desktop) ───────────────────────

  const renderUserActions = (user: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openEditDialog(user)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit User
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
          {user.status === 'active' ? (
            <>
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </>
          ) : (
            <>
              <UserCheck className="mr-2 h-4 w-4" />
              Activate
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setSelectedUser(user);
            setFormData((prev) => ({ ...prev, password: '' }));
            setIsResetPasswordDialogOpen(true);
          }}
        >
          <Key className="mr-2 h-4 w-4" />
          Reset Password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setSelectedUser(user);
            setIsDeleteDialogOpen(true);
          }}
          className="text-red-600 dark:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <SectionGuard permission="admin.users">
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
            <p className="text-muted-foreground">
              {isPlatformAdmin
                ? 'Manage users across all tenants'
                : currentUser?.tenant?.name
                  ? `Manage users for ${currentUser.tenant.name}`
                  : 'Manage users, roles, and permissions for your property'}
            </p>
          </div>
          <Button
            onClick={openAddDialog}
            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* ── Tenant Admin Indicator ──────────────────────────────────────── */}
        {!isPlatformAdmin && currentUser?.tenant?.name && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Tenant: <strong>{currentUser.tenant.name}</strong> — You can only manage users
              within your tenant.
            </span>
          </div>
        )}

        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
                {stats.total}
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
                {stats.active}
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-gray-500 to-gray-400 bg-clip-text text-transparent">
                {stats.inactive}
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <Shield className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.verified}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px] focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Tenant filter: only visible to platform admins */}
              {isPlatformAdmin && tenants.length > 0 && (
                <Select value={tenantFilter} onValueChange={setTenantFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="All Tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Property filter */}
              {properties.length > 0 && (
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Users List ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              {isPlatformAdmin
                ? 'A list of all users across tenants'
                : 'A list of all users in your organization'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {/* ── Mobile: Card layout ───────────────────────────────────── */}
              <div className="block sm:hidden space-y-3">
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-medium text-sm">
                              {user.firstName[0]}
                              {user.lastName[0]}
                            </div>
                            {user.status === 'active' && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        {renderUserActions(user)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {getRoleBadge(user.role)}
                        {getStatusBadge(user.status)}
                        {user.department && (
                          <span className="text-xs text-muted-foreground">
                            {user.department}
                          </span>
                        )}
                      </div>
                      {/* Property badges (mobile) */}
                      {(user.userPropertyAssignments || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {user.userPropertyAssignments!.map((a) => (
                            <Badge
                              key={a.id}
                              variant="secondary"
                              className="bg-gradient-to-r from-teal-50 to-stone-50 text-teal-800 border border-teal-200 dark:from-teal-950 dark:to-stone-950 dark:text-teal-300 dark:border-teal-800 gap-0.5 px-1.5 py-0.5 text-[10px]"
                            >
                              <Building2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[80px]">{a.property.name}</span>
                              <span className="text-teal-600 dark:text-teal-400">
                                ({getPropertyRoleLabel(a.role)})
                              </span>
                              {a.isDefault && (
                                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Last login:{' '}
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── Desktop: Table layout ──────────────────────────────────── */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        {isPlatformAdmin && <TableHead>Tenant</TableHead>}
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Assigned Properties</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={tableColumns}
                            className="text-center py-8"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Users className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No users found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-medium">
                                    {user.firstName[0]}
                                    {user.lastName[0]}
                                  </div>
                                  {user.status === 'active' && (
                                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">
                                      {user.firstName} {user.lastName}
                                    </p>
                                    {user.isPlatformAdmin && (
                                      <Badge
                                        variant="default"
                                        className="bg-purple-600 text-white text-[10px] px-1.5 py-0"
                                      >
                                        Platform Admin
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            {isPlatformAdmin && (
                              <TableCell>
                                <span className="text-sm">
                                  {user.tenant?.name || user.tenantId || '-'}
                                </span>
                              </TableCell>
                            )}
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <span className="text-sm">{user.department || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <PropertyBadges assignments={user.userPropertyAssignments} />
                            </TableCell>
                            <TableCell>{getStatusBadge(user.status)}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {user.lastLoginAt
                                  ? new Date(user.lastLoginAt).toLocaleDateString()
                                  : 'Never'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {renderUserActions(user)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            DIALOGS
           ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Add User Dialog (Multi-step Stepper) ────────────────────────── */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-lg sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                {currentStep === 1 && 'Enter basic user information.'}
                {currentStep === 2 && 'Assign this user to properties and set their roles.'}
                {currentStep === totalSteps && 'Review the details and confirm.'}
              </DialogDescription>
            </DialogHeader>

            <StepIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepLabels={stepLabels}
            />

            <ScrollArea className="max-h-[60vh] pr-1">
              {currentStep === 1 && renderStep1Content(false)}
              {currentStep === 2 && !isPlatformAdmin && renderStep2Content()}
              {currentStep === totalSteps && renderStep3Content(false)}
            </ScrollArea>

            <DialogFooter className="mt-4">
              {renderStepperFooter(false, handleAddUser, 'Create User')}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit User Dialog (Multi-step Stepper) ───────────────────────── */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditDialogOpen(false);
              setSelectedUser(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-lg sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                {currentStep === 1 && 'Update user information.'}
                {currentStep === 2 && 'Manage property assignments and roles.'}
                {currentStep === totalSteps && 'Review changes and confirm.'}
              </DialogDescription>
            </DialogHeader>

            <StepIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepLabels={stepLabels}
            />

            <ScrollArea className="max-h-[60vh] pr-1">
              {currentStep === 1 && renderStep1Content(true)}
              {currentStep === 2 && !isPlatformAdmin && renderStep2Content()}
              {currentStep === totalSteps && renderStep3Content(true)}
            </ScrollArea>

            <DialogFooter className="mt-4">
              {renderStepperFooter(true, handleEditUser, 'Save Changes')}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reset Password Dialog ───────────────────────────────────────── */}
        <Dialog
          open={isResetPasswordDialogOpen}
          onOpenChange={setIsResetPasswordDialogOpen}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {selectedUser?.firstName} {selectedUser?.lastName}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password *</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsResetPasswordDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedUser?.firstName}{' '}
                {selectedUser?.lastName}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-red-600 hover:bg-red-700"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SectionGuard>
  );
}

export default UserManagement;
