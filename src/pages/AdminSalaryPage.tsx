import { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { DollarSign, Download, ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateSalary, getCurrentPayrollPeriod, getMonthRange, formatCurrency } from '../utils/salary';
import { downloadCsv } from '../utils/export';
import { MONTHS_ARABIC } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export default function AdminSalaryPage() {
  const { users, attendance, settings, officialHolidays } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = new Date();
  const periods = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1, settings.monthStartDay);
    }),
    [settings.monthStartDay]
  );

  const period = periods[selectedPeriod] || getCurrentPayrollPeriod(settings.monthStartDay);
  const holidayDates = officialHolidays.map(h => h.date);

  const employees = users.filter(u => u.role === 'employee');

  const salaries = useMemo(() =>
    employees.map(emp => {
      const empAttendance = attendance.filter(r => r.userId === emp.id);
      const empSettings = {
        ...settings,
        baseSalary: emp.baseSalary,
        transportAllowance: emp.transportAllowance,
        workStartTime: emp.workStartTime,
        workEndTime: emp.workEndTime,
        weeklyOffDay: emp.weeklyOffDay,
        weeklyOffDay2: emp.weeklyOffDay2 ?? -1,
      };
      const breakdown = calculateSalary(empAttendance, empSettings, period.start, period.end, holidayDates);
      return { emp, breakdown };
    }),
    [employees, attendance, settings, period.start, period.end, holidayDates]
  );

  const totalNet = salaries.reduce((s, { breakdown }) => s + breakdown.netSalary, 0);
  const totalDeductions = salaries.reduce((s, { breakdown }) => s + breakdown.absenceDeduction + breakdown.lateDeduction, 0);
  const totalOvertime = salaries.reduce((s, { breakdown }) => s + breakdown.overtimePay, 0);

  const handleExportCsv = () => {
    const rows = salaries.map(({ emp, breakdown }) => ({
      'الموظف': emp.name,
      'القسم': emp.department || '',
      'الراتب الأساسي': emp.baseSalary,
      'بدل المواصلات': emp.transportAllowance,
      'أوفرتايم': breakdown.overtimePay,
      'خصم تأخير': breakdown.lateDeduction,
      'خصم غياب': breakdown.absenceDeduction,
      'خصم بدون راتب': breakdown.unpaidLeaveDeduction,
      'تأمين': breakdown.insuranceDeduction,
      'ضريبة': breakdown.taxDeduction,
      'الصافي': breakdown.netSalary,
      'أيام حضور': breakdown.presentDays,
      'أيام غياب': breakdown.absentDays,
    }));
    downloadCsv(`salaries_${period.label}.csv`, rows);
    toast.success('تم تصدير ملف CSV');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text(`Salary Report - ${period.label}`, 148, 15, { align: 'center' });

    autoTable(doc, {
      startY: 25,
      head: [['Employee', 'Dept', 'Base', 'Transport', 'OT', 'Deductions', 'Net Salary', 'Present', 'Absent']],
      body: salaries.map(({ emp, breakdown }) => [
        emp.name,
        emp.department || '',
        emp.baseSalary.toFixed(2),
        emp.transportAllowance.toFixed(2),
        breakdown.overtimePay.toFixed(2),
        (breakdown.absenceDeduction + breakdown.lateDeduction).toFixed(2),
        breakdown.netSalary.toFixed(2),
        breakdown.presentDays.toString(),
        breakdown.absentDays.toString(),
      ]),
      foot: [['TOTAL', '', '', '', '', '', totalNet.toFixed(2), '', '']],
      styles: { fontSize: 8, halign: 'right' },
      headStyles: { fillColor: [22, 78, 180] },
      footStyles: { fillColor: [22, 78, 180], fontStyle: 'bold' },
    });

    doc.save(`salaries_${period.label}.pdf`);
    toast.success('تم تصدير PDF');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-success" />
            </div>
            <h1 className="text-lg font-black text-foreground">كشف الرواتب</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCsv} className="px-3 py-2 bg-success/10 border border-success/20 text-success rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-success/20">
              <Download size={14} /> CSV
            </button>
            <button onClick={handleExportPDF} className="px-3 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-destructive/20">
              <Download size={14} /> PDF
            </button>
          </div>
        </div>

        {/* اختيار الفترة */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {periods.slice(0, 6).map((p, i) => (
            <button key={i} onClick={() => setSelectedPeriod(i)}
              className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                selectedPeriod === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* إجماليات */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">إجمالي الصافي</p>
            <p className="text-base font-black text-success font-mono">{formatCurrency(totalNet)}</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">الخصومات</p>
            <p className="text-base font-black text-destructive font-mono">{formatCurrency(totalDeductions)}</p>
          </div>
          <div className="bg-info/10 border border-info/20 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">الأوفرتايم</p>
            <p className="text-base font-black text-info font-mono">{formatCurrency(totalOvertime)}</p>
          </div>
        </div>

        {/* قائمة الموظفين */}
        <div className="space-y-2">
          {salaries.map(({ emp, breakdown }) => (
            <SalaryCard
              key={emp.id}
              emp={emp}
              breakdown={breakdown}
              expanded={expandedId === emp.id}
              onToggle={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SalaryCard({ emp, breakdown, expanded, onToggle }: {
  emp: { name: string; department?: string };
  breakdown: ReturnType<typeof calculateSalary>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={onToggle}>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
          {emp.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">{emp.name}</p>
          <p className="text-[10px] text-muted-foreground">{emp.department} · حضور {breakdown.presentDays}/{breakdown.workingDays}</p>
        </div>
        <div className="text-left shrink-0">
          <p className="text-base font-black text-success font-mono">{formatCurrency(breakdown.netSalary)}</p>
          <p className="text-[9px] text-muted-foreground text-left">صافي</p>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3 space-y-1.5 text-xs">
          <Row label="الراتب الأساسي" value={formatCurrency(breakdown.baseSalary)} />
          <Row label="بدل المواصلات" value={formatCurrency(breakdown.transportAllowance)} />
          {breakdown.overtimePay > 0 && <Row label="أوفرتايم" value={`+${formatCurrency(breakdown.overtimePay)}`} color="success" icon={<TrendingUp size={10} className="text-success" />} />}
          {breakdown.lateDeduction > 0 && <Row label="خصم تأخير" value={`-${formatCurrency(breakdown.lateDeduction)}`} color="warning" icon={<TrendingDown size={10} className="text-warning" />} />}
          {breakdown.absenceDeduction > 0 && <Row label="خصم غياب" value={`-${formatCurrency(breakdown.absenceDeduction)}`} color="destructive" icon={<TrendingDown size={10} className="text-destructive" />} />}
          {breakdown.unpaidLeaveDeduction > 0 && <Row label="خصم إجازة بدون راتب" value={`-${formatCurrency(breakdown.unpaidLeaveDeduction)}`} color="destructive" />}
          {breakdown.insuranceDeduction > 0 && <Row label="التأمين" value={`-${formatCurrency(breakdown.insuranceDeduction)}`} />}
          {breakdown.taxDeduction > 0 && <Row label="الضريبة" value={`-${formatCurrency(breakdown.taxDeduction)}`} />}
          <div className="border-t border-border pt-2 flex justify-between font-black">
            <span className="text-foreground">الصافي</span>
            <span className="text-success font-mono">{formatCurrency(breakdown.netSalary)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className={cn('font-black font-mono', color ? `text-${color}` : 'text-foreground')}>{value}</span>
    </div>
  );
}
