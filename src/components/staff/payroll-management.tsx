'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Mail,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Building2,
  Calculator,
  Receipt,
  Shield,
  FileCheck,
  ChevronRight,
  Printer,
  Send,
  IndianRupee,
  Banknote,
  PiggyBank,
  Briefcase,
  UserCheck,
  Filter,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  designation: string;
  pan: string;
  bankAccount: string;
}

interface PayrollRecord {
  employee: Employee;
  daysWorked: number;
  totalDays: number;
  basicSalary: number;
  hra: number;
  da: number;
  specialAllowance: number;
  overtime: number;
  bonus: number;
  conveyance: number;
  medical: number;
  totalEarnings: number;
  pf: number;
  esi: number;
  tds: number;
  profTax: number;
  loanEmi: number;
  advanceRecovery: number;
  totalDeductions: number;
  netPay: number;
  leaveAdjustment: number;
  lateDeduction: number;
  status: 'processed' | 'pending' | 'on_hold';
}

interface PayrollCalendar {
  month: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  processingDate: string;
  paymentDate: string;
  totalEmployees: number;
  totalNetPay: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────

const DEPARTMENTS = ['Front Office', 'Housekeeping', 'F&B Service', 'Kitchen', 'Maintenance', 'Security', 'Spa & Wellness', 'Finance'];

const MOCK_EMPLOYEES: Employee[] = [
  { id: 'e-001', name: 'Rajesh Kumar', employeeId: 'EMP-001', department: 'Front Office', designation: 'Front Desk Manager', pan: 'ABCPK1234A', bankAccount: 'XXXX-XXXX-1234' },
  { id: 'e-002', name: 'Priya Sharma', employeeId: 'EMP-002', department: 'Front Office', designation: 'Receptionist', pan: 'BCDPS5678B', bankAccount: 'XXXX-XXXX-2345' },
  { id: 'e-003', name: 'Amit Patel', employeeId: 'EMP-003', department: 'Housekeeping', designation: 'HK Supervisor', pan: 'CDEAP9012C', bankAccount: 'XXXX-XXXX-3456' },
  { id: 'e-004', name: 'Sunita Devi', employeeId: 'EMP-004', department: 'Housekeeping', designation: 'Room Attendant', pan: 'DEFSD3456D', bankAccount: 'XXXX-XXXX-4567' },
  { id: 'e-005', name: 'Vikram Singh', employeeId: 'EMP-005', department: 'F&B Service', designation: 'F&B Manager', pan: 'EFGVS7890E', bankAccount: 'XXXX-XXXX-5678' },
  { id: 'e-006', name: 'Neha Gupta', employeeId: 'EMP-006', department: 'F&B Service', designation: 'Captain', pan: 'FGHNG1234F', bankAccount: 'XXXX-XXXX-6789' },
  { id: 'e-007', name: 'Arjun Reddy', employeeId: 'EMP-007', department: 'Kitchen', designation: 'Executive Chef', pan: 'GHIRA5678G', bankAccount: 'XXXX-XXXX-7890' },
  { id: 'e-008', name: 'Kavita Menon', employeeId: 'EMP-008', department: 'Kitchen', designation: 'Sous Chef', pan: 'HIJKM9012H', bankAccount: 'XXXX-XXXX-8901' },
  { id: 'e-009', name: 'Suresh Nair', employeeId: 'EMP-009', department: 'Maintenance', designation: 'Maintenance Lead', pan: 'IJKLS3456I', bankAccount: 'XXXX-XXXX-9012' },
  { id: 'e-010', name: 'Deepa Iyer', employeeId: 'EMP-010', department: 'Security', designation: 'Security Officer', pan: 'JKLID7890J', bankAccount: 'XXXX-XXXX-0123' },
  { id: 'e-011', name: 'Rahul Joshi', employeeId: 'EMP-011', department: 'Spa & Wellness', designation: 'Spa Manager', pan: 'KLMRJ1234K', bankAccount: 'XXXX-XXXX-1234' },
  { id: 'e-012', name: 'Meera Krishnan', employeeId: 'EMP-012', department: 'Finance', designation: 'Accounts Manager', pan: 'LMNRM5678L', bankAccount: 'XXXX-XXXX-2345' },
  { id: 'e-013', name: 'Sanjay Verma', employeeId: 'EMP-013', department: 'Housekeeping', designation: 'Room Attendant', pan: 'MNOSV9012M', bankAccount: 'XXXX-XXXX-3456' },
  { id: 'e-014', name: 'Anita Desai', employeeId: 'EMP-014', department: 'F&B Service', designation: 'Steward', pan: 'NO PAD3456N', bankAccount: 'XXXX-XXXX-4567' },
  { id: 'e-015', name: 'Kiran Rao', employeeId: 'EMP-015', department: 'Kitchen', designation: 'Commis Chef', pan: 'OPBKR7890O', bankAccount: 'XXXX-XXXX-5678' },
  { id: 'e-016', name: 'Lakshmi Pillai', employeeId: 'EMP-016', department: 'Front Office', designation: 'Concierge', pan: 'PQCLP1234P', bankAccount: 'XXXX-XXXX-6789' },
  { id: 'e-017', name: 'Manish Tiwari', employeeId: 'EMP-017', department: 'Maintenance', designation: 'Electrician', pan: 'QRDMT5678Q', bankAccount: 'XXXX-XXXX-7890' },
  { id: 'e-018', name: 'Pooja Agarwal', employeeId: 'EMP-018', department: 'Spa & Wellness', designation: 'Therapist', pan: 'RSTEP9012R', bankAccount: 'XXXX-XXXX-8901' },
];

function generatePayroll(emp: Employee, index: number): PayrollRecord {
  const baseSalaries: Record<string, number> = {
    'Front Desk Manager': 45000, 'Receptionist': 22000, 'HK Supervisor': 28000, 'Room Attendant': 16000,
    'F&B Manager': 50000, 'Captain': 24000, 'Executive Chef': 75000, 'Sous Chef': 42000,
    'Maintenance Lead': 30000, 'Security Officer': 25000, 'Spa Manager': 40000, 'Accounts Manager': 48000,
    'Steward': 18000, 'Commis Chef': 20000, 'Concierge': 26000, 'Electrician': 22000, 'Therapist': 28000,
  };
  const base = baseSalaries[emp.designation] || 25000;
  const hra = Math.round(base * 0.4);
  const da = Math.round(base * 0.1);
  const special = Math.round(base * 0.2);
  const ot = index % 3 === 0 ? Math.round(base * 0.08) : 0;
  const bonus = index % 5 === 0 ? 5000 : 0;
  const conv = 1600;
  const med = 1250;
  const totalEarn = base + hra + da + special + ot + bonus + conv + med;
  const pf = Math.round((base + da) * 0.12);
  const esi = base <= 21000 ? Math.round(base * 0.0075) : 0;
  const tds = Math.round(totalEarn * (index % 4 === 0 ? 0.1 : 0.05));
  const profTax = 200;
  const loan = index === 2 ? 3000 : 0;
  const advance = index === 6 ? 2000 : 0;
  const totalDed = pf + esi + tds + profTax + loan + advance;
  const lateDed = index % 7 === 0 ? 200 : 0;
  const leaveAdj = index % 8 === 0 ? Math.round(base / 30) : 0;

  return {
    employee: emp,
    daysWorked: 26 - (index % 3 === 0 ? 0 : 1),
    totalDays: 26,
    basicSalary: base,
    hra, da, specialAllowance: special, overtime: ot, bonus, conveyance: conv, medical: med,
    totalEarnings: totalEarn,
    pf, esi, tds, profTax, loanEmi: loan, advanceRecovery: advance,
    totalDeductions: totalDed + lateDed + leaveAdj,
    netPay: totalEarn - totalDed - lateDed - leaveAdj,
    leaveAdjustment: leaveAdj,
    lateDeduction: lateDed,
    status: index === 5 ? 'on_hold' : index < 16 ? 'processed' : 'pending',
  };
}

const MOCK_PAYROLL: PayrollRecord[] = MOCK_EMPLOYEES.map((emp, i) => generatePayroll(emp, i));

const MOCK_CALENDAR: PayrollCalendar[] = [
  { month: 'January 2025', status: 'completed', processingDate: '25 Jan 2025', paymentDate: '31 Jan 2025', totalEmployees: 17, totalNetPay: 0 },
  { month: 'February 2025', status: 'completed', processingDate: '25 Feb 2025', paymentDate: '28 Feb 2025', totalEmployees: 17, totalNetPay: 0 },
  { month: 'March 2025', status: 'completed', processingDate: '25 Mar 2025', paymentDate: '31 Mar 2025', totalEmployees: 17, totalNetPay: 0 },
  { month: 'April 2025', status: 'completed', processingDate: '25 Apr 2025', paymentDate: '30 Apr 2025', totalEmployees: 18, totalNetPay: 0 },
  { month: 'May 2025', status: 'completed', processingDate: '25 May 2025', paymentDate: '31 May 2025', totalEmployees: 18, totalNetPay: 0 },
  { month: 'June 2025', status: 'in_progress', processingDate: '25 Jun 2025', paymentDate: '30 Jun 2025', totalEmployees: 18, totalNetPay: 0 },
  { month: 'July 2025', status: 'upcoming', processingDate: '25 Jul 2025', paymentDate: '31 Jul 2025', totalEmployees: 18, totalNetPay: 0 },
  { month: 'August 2025', status: 'upcoming', processingDate: '25 Aug 2025', paymentDate: '31 Aug 2025', totalEmployees: 18, totalNetPay: 0 },
];

const DEPT_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6'];

const ctcChartConfig: ChartConfig = {
  basic: { label: 'Basic', color: '#f59e0b' },
  hra: { label: 'HRA', color: '#ef4444' },
  da: { label: 'DA', color: '#10b981' },
  special: { label: 'Special', color: '#8b5cf6' },
  other: { label: 'Other', color: '#06b6d4' },
};

const deptChartConfig: ChartConfig = {
  payroll: { label: 'Payroll Cost', color: '#f59e0b' },
  headcount: { label: 'Headcount', color: '#06b6d4' },
};

// ── Component ──────────────────────────────────────────────────────────

export default function PayrollManagement() {
  const [activeTab, setActiveTab] = useState('processing');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taxRegime, setTaxRegime] = useState<'old' | 'new'>('new');
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  // ── Computed ─────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    return MOCK_PAYROLL.filter(r => {
      if (selectedDept !== 'all' && r.employee.department !== selectedDept) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.employee.name.toLowerCase().includes(q) || r.employee.employeeId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedDept, searchQuery]);

  const payrollSummary = useMemo(() => {
    const processed = MOCK_PAYROLL.filter(r => r.status === 'processed');
    return {
      totalGross: processed.reduce((s, r) => s + r.totalEarnings, 0),
      totalDeductions: processed.reduce((s, r) => s + r.totalDeductions, 0),
      totalNet: processed.reduce((s, r) => s + r.netPay, 0),
      processedCount: processed.length,
      pendingCount: MOCK_PAYROLL.filter(r => r.status === 'pending').length,
      onHoldCount: MOCK_PAYROLL.filter(r => r.status === 'on_hold').length,
    };
  }, []);

  const departmentBreakdown = useMemo(() => {
    const deptMap = new Map<string, { total: number; count: number }>();
    MOCK_PAYROLL.forEach(r => {
      const d = r.employee.department;
      const existing = deptMap.get(d) || { total: 0, count: 0 };
      deptMap.set(d, { total: existing.total + r.netPay, count: existing.count + 1 });
    });
    return Array.from(deptMap.entries()).map(([dept, data]) => ({
      department: dept.length > 15 ? dept.substring(0, 15) + '...' : dept,
      fullDepartment: dept,
      total: data.total,
      count: data.count,
    }));
  }, []);

  const ctcBreakdown = useMemo(() => {
    const processed = MOCK_PAYROLL.filter(r => r.status === 'processed');
    return [
      { name: 'Basic', value: processed.reduce((s, r) => s + r.basicSalary, 0), key: 'basic' },
      { name: 'HRA', value: processed.reduce((s, r) => s + r.hra, 0), key: 'hra' },
      { name: 'DA', value: processed.reduce((s, r) => s + r.da, 0), key: 'da' },
      { name: 'Special Allow.', value: processed.reduce((s, r) => s + r.specialAllowance, 0), key: 'special' },
      { name: 'Other', value: processed.reduce((s, r) => s + r.conveyance + r.medical + r.overtime + r.bonus, 0), key: 'other' },
    ];
  }, []);

  // Update calendar totals
  useMemo(() => {
    MOCK_CALENDAR.forEach(cal => {
      cal.totalNetPay = MOCK_PAYROLL.filter(r => r.status !== 'pending').reduce((s, r) => s + r.netPay, 0);
    });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleProcessPayroll = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast.success('Payroll Processed', { description: `${MOCK_PAYROLL.length} employee payslips generated` });
    }, 2500);
  };

  const handleViewPayslip = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setIsPayslipOpen(true);
  };

  const handleBulkDownload = () => {
    toast.success('Download Started', { description: 'Generating PDF payslips for all employees' });
  };

  const handleEmailPayslips = () => {
    toast.success('Emails Queued', { description: 'Payslips will be sent to all processed employees' });
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payroll Management</h2>
          <p className="text-muted-foreground">Process payroll, manage salaries, and generate payslips</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleBulkDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Bulk Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleEmailPayslips}>
            <Send className="h-4 w-4 mr-1.5" />
            Email Payslips
          </Button>
          <Button size="sm" onClick={handleProcessPayroll} disabled={isProcessing}>
            {isProcessing ? <CheckCircle2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Calculator className="h-4 w-4 mr-1.5" />}
            {isProcessing ? 'Processing...' : 'Run Payroll'}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Gross</span>
          </div>
          <p className="text-xl font-bold">{formatAmount(payrollSummary.totalGross)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Deductions</span>
          </div>
          <p className="text-xl font-bold text-red-600">{formatAmount(payrollSummary.totalDeductions)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Net Pay</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatAmount(payrollSummary.totalNet)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Processed</span>
          </div>
          <p className="text-xl font-bold">{payrollSummary.processedCount}/{MOCK_PAYROLL.length}</p>
          <Progress value={(payrollSummary.processedCount / MOCK_PAYROLL.length) * 100} className="mt-2 h-1.5" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Pending / On Hold</span>
          </div>
          <p className="text-xl font-bold">
            <span className="text-amber-600">{payrollSummary.pendingCount}</span>
            {' / '}
            <span className="text-red-600">{payrollSummary.onHoldCount}</span>
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="processing">Payroll</TabsTrigger>
          <TabsTrigger value="salary">Salary Structure</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        {/* ── Payroll Processing Tab ─────────────────────────────── */}
        <TabsContent value="processing" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employee..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Tax Regime:</Label>
              <div className="flex gap-1">
                <Button variant={taxRegime === 'old' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setTaxRegime('old')}>Old</Button>
                <Button variant={taxRegime === 'new' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setTaxRegime('new')}>New</Button>
              </div>
            </div>
          </div>

          {/* Payroll Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="hidden lg:table-cell">Days</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map(record => (
                      <TableRow key={record.employee.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{record.employee.name}</p>
                            <p className="text-xs text-muted-foreground">{record.employee.employeeId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">{record.employee.department}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm">{record.daysWorked}/{record.totalDays}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-emerald-600">{formatAmount(record.totalEarnings)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-red-600">{formatAmount(record.totalDeductions)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold">{formatAmount(record.netPay)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn(
                            'text-xs',
                            record.status === 'processed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                            record.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                            record.status === 'on_hold' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                          )}>
                            {record.status === 'processed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {record.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {record.status === 'on_hold' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {record.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleViewPayslip(record)}>
                            <Eye className="h-3 w-3 mr-1" />
                            Payslip
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Salary Structure Tab ────────────────────────────────── */}
        <TabsContent value="salary" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* CTC Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  CTC Breakdown (Aggregate)
                </CardTitle>
                <CardDescription>Distribution of salary components across all employees</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={ctcChartConfig} className="h-[300px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={ctcBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={2}
                    >
                      {ctcBreakdown.map((_, i) => (
                        <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Pay Components Config */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Pay Components
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Earnings</h4>
                  <div className="space-y-1.5">
                    {[
                      { name: 'Basic Salary', type: 'Fixed % of CTC', value: '40-50%', active: true },
                      { name: 'HRA', type: '% of Basic', value: '40%', active: true },
                      { name: 'Dearness Allowance', type: '% of Basic', value: '10%', active: true },
                      { name: 'Special Allowance', type: 'Balancing', value: 'Variable', active: true },
                      { name: 'Conveyance', type: 'Fixed', value: '₹1,600', active: true },
                      { name: 'Medical Allowance', type: 'Fixed', value: '₹1,250', active: true },
                      { name: 'Overtime', type: 'Hourly rate', value: '2× Basic/hr', active: true },
                      { name: 'Bonus', type: 'Annual', value: '8.33% of Gross', active: false },
                    ].map(comp => (
                      <div key={comp.name} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Switch checked={comp.active} className="scale-75" />
                          <div>
                            <p className="text-sm font-medium">{comp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{comp.type}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{comp.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deductions</h4>
                  <div className="space-y-1.5">
                    {[
                      { name: 'PF (Employee)', type: '% of Basic+DA', value: '12%' },
                      { name: 'ESI', type: '% of Gross', value: '0.75%' },
                      { name: 'TDS', type: 'Tax regime', value: taxRegime === 'new' ? 'New Regime' : 'Old Regime' },
                      { name: 'Professional Tax', type: 'Fixed', value: '₹200' },
                      { name: 'Loan EMI', type: 'Per employee', value: 'Variable' },
                      { name: 'Advance Recovery', type: 'Per employee', value: 'Variable' },
                    ].map(comp => (
                      <div key={comp.name} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{comp.name}</p>
                          <p className="text-[10px] text-muted-foreground">{comp.type}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{comp.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department-wise Payroll */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Department-wise Payroll Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={deptChartConfig} className="h-[280px] w-full">
                <BarChart data={departmentBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance Integration Tab ──────────────────────────── */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Attendance Integration — June 2025
              </CardTitle>
              <CardDescription>Auto-imported from attendance system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Days Worked</TableHead>
                      <TableHead>Leave Types</TableHead>
                      <TableHead className="hidden sm:table-cell">Late Mins</TableHead>
                      <TableHead className="hidden sm:table-cell">Late Deduction</TableHead>
                      <TableHead className="hidden md:table-cell">Leave Adjustment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_PAYROLL.slice(0, 12).map(record => (
                      <TableRow key={record.employee.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{record.employee.name}</p>
                          <p className="text-xs text-muted-foreground">{record.employee.employeeId}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{record.employee.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{record.daysWorked}/{record.totalDays}</span>
                            <Progress value={(record.daysWorked / record.totalDays) * 100} className="w-16 h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {record.totalDays - record.daysWorked > 0 && (
                              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                CL: {record.totalDays - record.daysWorked}
                              </Badge>
                            )}
                            {record.leaveAdjustment > 0 && (
                              <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                LWP
                              </Badge>
                            )}
                            {record.totalDays - record.daysWorked === 0 && record.leaveAdjustment === 0 && (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Full
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={cn('text-sm', record.lateDeduction > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                            {record.lateDeduction > 0 ? '45' : '0'} mins
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={cn('text-sm', record.lateDeduction > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                            {record.lateDeduction > 0 ? formatAmount(record.lateDeduction) : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className={cn('text-sm', record.leaveAdjustment > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                            {record.leaveAdjustment > 0 ? formatAmount(record.leaveAdjustment) : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Leave Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Casual Leave (CL)</div>
              <div className="text-xl font-bold">12 <span className="text-sm text-muted-foreground font-normal">/ year</span></div>
              <Progress value={65} className="mt-2 h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">65% utilized</p>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Sick Leave (SL)</div>
              <div className="text-xl font-bold">10 <span className="text-sm text-muted-foreground font-normal">/ year</span></div>
              <Progress value={30} className="mt-2 h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">30% utilized</p>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Earned Leave (EL)</div>
              <div className="text-xl font-bold">15 <span className="text-sm text-muted-foreground font-normal">/ year</span></div>
              <Progress value={40} className="mt-2 h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">40% utilized</p>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Loss of Pay (LWP)</div>
              <div className="text-xl font-bold text-red-600">2 <span className="text-sm text-muted-foreground font-normal">days</span></div>
              <p className="text-[10px] text-muted-foreground mt-2">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.leaveAdjustment, 0))} total deduction</p>
            </Card>
          </div>
        </TabsContent>

        {/* ── Compliance Tab ──────────────────────────────────────── */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* PF/ESI */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PiggyBank className="h-5 w-5 text-amber-500" />
                <h4 className="font-semibold text-sm">PF Contribution</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employee PF</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.pf, 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employer PF</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.pf, 0))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total PF</span>
                  <span>{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.pf * 2, 0))}</span>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">Remittance up to date</Badge>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-sky-500" />
                <h4 className="font-semibold text-sm">ESI Contribution</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employee ESI</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.esi, 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employer ESI</span>
                  <span className="font-medium">{formatAmount(Math.round(MOCK_PAYROLL.reduce((s, r) => s + r.esi, 0) * 3.25))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total ESI</span>
                  <span>{formatAmount(Math.round(MOCK_PAYROLL.reduce((s, r) => s + r.esi * 4.25, 0)))}</span>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">Eligible: {MOCK_PAYROLL.filter(r => r.esi > 0).length} employees</Badge>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-5 w-5 text-emerald-500" />
                <h4 className="font-semibold text-sm">TDS / Form 16</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total TDS</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.tds, 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Regime</span>
                  <Badge variant="outline" className="text-xs">{taxRegime === 'new' ? 'New Regime' : 'Old Regime'}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Form 16 Status</span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs">Pending Generation</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="h-5 w-5 text-violet-500" />
                <h4 className="font-semibold text-sm">Professional Tax</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly PT</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.profTax, 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Compliance</span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">Compliant</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-5 w-5 text-orange-500" />
                <h4 className="font-semibold text-sm">Minimum Wage Check</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">State Min. Wage</span>
                  <span className="font-medium">₹15,000/month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lowest Paid</span>
                  <span className="font-medium">{formatAmount(Math.min(...MOCK_PAYROLL.map(r => r.basicSalary)))}</span>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">All compliant ✓</Badge>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-pink-500" />
                <h4 className="font-semibold text-sm">Loan Recovery</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Loans</span>
                  <span className="font-medium">{MOCK_PAYROLL.filter(r => r.loanEmi > 0).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Recovery</span>
                  <span className="font-medium">{formatAmount(MOCK_PAYROLL.reduce((s, r) => s + r.loanEmi + r.advanceRecovery, 0))}</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Calendar Tab ────────────────────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Processing Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Payment Date</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead className="hidden sm:table-cell">Total Net Pay</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_CALENDAR.map(cal => (
                    <TableRow key={cal.month}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{cal.month}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn(
                          'text-xs',
                          cal.status === 'completed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                          cal.status === 'in_progress' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                          cal.status === 'upcoming' && 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
                        )}>
                          {cal.status === 'completed' && 'Completed'}
                          {cal.status === 'in_progress' && 'In Progress'}
                          {cal.status === 'upcoming' && 'Upcoming'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{cal.processingDate}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{cal.paymentDate}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{cal.totalEmployees}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-medium">{cal.totalNetPay > 0 ? formatAmount(cal.totalNetPay) : '—'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {cal.status === 'completed' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                        {cal.status === 'in_progress' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Payslip Dialog ────────────────────────────────────────── */}
      <Dialog open={isPayslipOpen} onOpenChange={setIsPayslipOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip — {selectedRecord?.employee.name}
            </DialogTitle>
            <DialogDescription>
              June 2025 • {selectedRecord?.employee.designation} • {selectedRecord?.employee.department}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 text-xs">
                  <div><span className="text-muted-foreground">Employee ID:</span> <span className="font-medium ml-1">{selectedRecord.employee.employeeId}</span></div>
                  <div><span className="text-muted-foreground">PAN:</span> <span className="font-medium ml-1">{selectedRecord.employee.pan}</span></div>
                  <div><span className="text-muted-foreground">Bank A/C:</span> <span className="font-medium ml-1">{selectedRecord.employee.bankAccount}</span></div>
                  <div><span className="text-muted-foreground">Days Worked:</span> <span className="font-medium ml-1">{selectedRecord.daysWorked}/{selectedRecord.totalDays}</span></div>
                </div>

                {/* Earnings */}
                <div>
                  <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Earnings</h4>
                  <div className="space-y-1.5">
                    {[
                      ['Basic Salary', selectedRecord.basicSalary],
                      ['HRA', selectedRecord.hra],
                      ['Dearness Allowance', selectedRecord.da],
                      ['Special Allowance', selectedRecord.specialAllowance],
                      ['Conveyance', selectedRecord.conveyance],
                      ['Medical Allowance', selectedRecord.medical],
                      ['Overtime', selectedRecord.overtime],
                      ['Bonus', selectedRecord.bonus],
                    ].filter(([, v]) => v > 0).map(([label, value]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label as string}</span>
                        <span className="font-medium">{formatAmount(value as number)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total Earnings</span>
                      <span className="text-emerald-600">{formatAmount(selectedRecord.totalEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Deductions</h4>
                  <div className="space-y-1.5">
                    {[
                      ['Provident Fund', selectedRecord.pf],
                      ['ESI', selectedRecord.esi],
                      ['TDS', selectedRecord.tds],
                      ['Professional Tax', selectedRecord.profTax],
                      ['Loan EMI', selectedRecord.loanEmi],
                      ['Advance Recovery', selectedRecord.advanceRecovery],
                      ['Late Coming Ded.', selectedRecord.lateDeduction],
                      ['Leave Adjustment', selectedRecord.leaveAdjustment],
                    ].filter(([, v]) => (v as number) > 0).map(([label, value]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label as string}</span>
                        <span className="font-medium text-red-600">{formatAmount(value as number)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total Deductions</span>
                      <span className="text-red-600">{formatAmount(selectedRecord.totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Pay */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Net Pay</span>
                    <span className="text-2xl font-bold">{formatAmount(selectedRecord.netPay)}</span>
                  </div>
                  <p className="text-xs text-emerald-100 mt-1">Credited to A/C {selectedRecord.employee.bankAccount}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayslipOpen(false)}>Close</Button>
            <Button variant="outline" onClick={() => toast.success('Payslip sent via email')}>
              <Mail className="h-4 w-4 mr-1.5" />
              Email
            </Button>
            <Button onClick={() => toast.success('PDF downloaded')}>
              <Download className="h-4 w-4 mr-1.5" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
