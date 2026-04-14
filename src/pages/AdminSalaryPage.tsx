import { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { DollarSign, Download, ChevronDown, TrendingDown, TrendingUp, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateSalary, getCurrentPayrollPeriod, getMonthRange, formatCurrency } from '../utils/salary';
import { downloadCsv } from '../utils/export';
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
  const totalGross = salaries.reduce((s, { breakdown }) => s + breakdown.baseSalary + breakdown.transportAllowance + breakdown.overtimePay, 0);

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
      'أيام عمل': breakdown.workingDays,
    }));
    downloadCsv(`رواتب_${period.label}.csv`, rows);
    toast.success('✅ تم تصدير ملف CSV بنجاح');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ─── Header ─────────────────────────────────────────────────────
    // خلفية Header
    doc.setFillColor(22, 78, 180);
    doc.rect(0, 0, 297, 38, 'F');

    // عنوان التقرير
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Salary Report - Payroll Sheet', 148.5, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(200, 220, 255);
    doc.text(`Period: ${period.label}   |   Date: ${new Date().toLocaleDateString('en-GB')}`, 148.5, 22, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(180, 200, 255);
    doc.text(`Employees: ${employees.length}   |   Total Net: ${formatCurrency(totalNet)}   |   Total Deductions: ${formatCurrency(totalDeductions)}`, 148.5, 30, { align: 'center' });

    // ─── Summary Cards ────────────────────────────────────────────────
    const cardY = 44;
    const cards = [
      { label: 'Total Gross', value: formatCurrency(totalGross), color: [34, 197, 94] as [number, number, number] },
      { label: 'Total Overtime', value: formatCurrency(totalOvertime), color: [59, 130, 246] as [number, number, number] },
      { label: 'Total Deductions', value: formatCurrency(totalDeductions), color: [239, 68, 68] as [number, number, number] },
      { label: 'Total Net Salary', value: formatCurrency(totalNet), color: [22, 78, 180] as [number, number, number] },
    ];

    cards.forEach((card, i) => {
      const x = 10 + i * 70;
      doc.setFillColor(...card.color);
      doc.roundedRect(x, cardY, 67, 18, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(card.label, x + 33.5, cardY + 6, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(card.value, x + 33.5, cardY + 14, { align: 'center' });
    });

    // ─── Main Table ──────────────────────────────────────────────────
    autoTable(doc, {
      startY: cardY + 24,
      head: [[
        'Employee Name', 'Dept', 'Base Salary', 'Transport',
        'Overtime', 'Late Ded.', 'Absent Ded.', 'Unpaid',
        'Insurance', 'Tax', 'Net Salary', 'Present', 'Absent', 'Days'
      ]],
      body: salaries.map(({ emp, breakdown }) => [
        emp.name,
        emp.department || '—',
        formatCurrency(breakdown.baseSalary),
        formatCurrency(breakdown.transportAllowance),
        breakdown.overtimePay > 0 ? `+${formatCurrency(breakdown.overtimePay)}` : '—',
        breakdown.lateDeduction > 0 ? `-${formatCurrency(breakdown.lateDeduction)}` : '—',
        breakdown.absenceDeduction > 0 ? `-${formatCurrency(breakdown.absenceDeduction)}` : '—',
        breakdown.unpaidLeaveDeduction > 0 ? `-${formatCurrency(breakdown.unpaidLeaveDeduction)}` : '—',
        breakdown.insuranceDeduction > 0 ? `-${formatCurrency(breakdown.insuranceDeduction)}` : '—',
        breakdown.taxDeduction > 0 ? `-${formatCurrency(breakdown.taxDeduction)}` : '—',
        formatCurrency(breakdown.netSalary),
        `${breakdown.presentDays}`,
        `${breakdown.absentDays}`,
        `${breakdown.workingDays}`,
      ]),
      foot: [[
        'TOTAL', `${employees.length} emp`, '', '',
        totalOvertime > 0 ? `+${formatCurrency(totalOvertime)}` : '—',
        totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : '—',
        '', '', '', '',
        formatCurrency(totalNet), '', '', '',
      ]],
      styles: {
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 3,
        font: 'helvetica',
        textColor: [30, 30, 30],
        lineColor: [220, 220, 230],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [22, 78, 180],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      footStyles: {
        fillColor: [22, 78, 180],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 248, 255],
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        10: { fontStyle: 'bold', textColor: [22, 78, 180] as [number, number, number] },
      },
      margin: { left: 10, right: 10 },
      tableLineColor: [200, 210, 230],
      tableLineWidth: 0.5,
    });

    // ─── Footer ───────────────────────────────────────────────────────
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated by Attendance & Salary Tracker Pro — ${new Date().toLocaleDateString('en-GB')} — Page ${p}/${pageCount}`,
        148.5,
        pageH - 6,
        { align: 'center' }
      );
    }

    const filename = `Payroll_${period.label.replace(/\s/g, '_')}.pdf`;
    doc.save(filename);
    toast.success('✅ تم تصدير PDF بنجاح');
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
            <button onClick={handleExportCsv}
              className="px-3 py-2 bg-success/10 border border-success/20 text-success rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-success/20 transition-all">
              <Download size={14} /> CSV
            </button>
            <button onClick={handleExportPDF}
              className="px-3 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-primary/20 transition-all">
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {/* اختيار الفترة */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {periods.slice(0, 6).map((p, i) => (
            <button key={i} onClick={() => setSelectedPeriod(i)}
              className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                selectedPeriod === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/30'
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* إجماليات */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">إجمالي الصافي</p>
            <p className="text-base font-black text-success font-mono">{formatCurrency(totalNet)}</p>
          </div>
          <div className="bg-muted border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">إجمالي الإجمالي</p>
            <p className="text-base font-black text-foreground font-mono">{formatCurrency(totalGross)}</p>
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
        {salaries.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <DollarSign size={40} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">لا يوجد موظفون</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

function SalaryCard({ emp, breakdown, expanded, onToggle }: {
  emp: { id: string; name: string; department?: string };
  breakdown: ReturnType<typeof calculateSalary>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const attendancePct = breakdown.workingDays > 0
    ? Math.round((breakdown.presentDays / breakdown.workingDays) * 100)
    : 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={onToggle}>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
          {emp.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground truncate">{emp.name}</p>
          <p className="text-[10px] text-muted-foreground">{emp.department || '—'} · حضور {breakdown.presentDays}/{breakdown.workingDays} ({attendancePct}%)</p>
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
          {breakdown.overtimePay > 0 && <Row label={`أوفرتايم (${breakdown.overtimeHours.toFixed(1)}ساعة)`} value={`+${formatCurrency(breakdown.overtimePay)}`} color="success" icon={<TrendingUp size={10} className="text-success" />} />}
          {breakdown.lateDeduction > 0 && <Row label={`خصم تأخير (${breakdown.lateDays} يوم)`} value={`-${formatCurrency(breakdown.lateDeduction)}`} color="warning" icon={<TrendingDown size={10} className="text-warning" />} />}
          {breakdown.absenceDeduction > 0 && <Row label={`خصم غياب (${breakdown.absentDays} يوم)`} value={`-${formatCurrency(breakdown.absenceDeduction)}`} color="destructive" icon={<TrendingDown size={10} className="text-destructive" />} />}
          {breakdown.unpaidLeaveDeduction > 0 && <Row label={`خصم إجازة بدون راتب (${breakdown.unpaidLeaveDays} يوم)`} value={`-${formatCurrency(breakdown.unpaidLeaveDeduction)}`} color="destructive" />}
          {breakdown.sickLeaveDays > 0 && <Row label={`إجازات مرضية`} value={`${breakdown.sickLeaveDays} يوم`} />}
          {breakdown.annualLeaveDays > 0 && <Row label={`إجازات سنوية`} value={`${breakdown.annualLeaveDays} يوم`} />}
          {breakdown.insuranceDeduction > 0 && <Row label="التأمين الاجتماعي" value={`-${formatCurrency(breakdown.insuranceDeduction)}`} />}
          {breakdown.taxDeduction > 0 && <Row label="ضريبة الدخل" value={`-${formatCurrency(breakdown.taxDeduction)}`} />}
          <div className="border-t border-border pt-2 flex justify-between font-black">
            <span className="text-foreground">الصافي النهائي</span>
            <span className="text-success font-mono text-base">{formatCurrency(breakdown.netSalary)}</span>
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
