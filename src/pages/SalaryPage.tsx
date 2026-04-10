import { useState, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { DollarSign, TrendingUp, TrendingDown, Download, Plus, Trash2, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  calculateSalary, getCurrentPayrollPeriod, getMonthRange,
  formatCurrency, generateId
} from '../utils/salary';
import type { SalaryComparison } from '../types';
import { MONTHS_ARABIC } from '../constants';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalaryPage() {
  const { user, attendance, settings, salaryComparisons, officialHolidays, addSalaryComparison, deleteSalaryComparison } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(0); // 0 = حالي, -1، -2...
  const [showAddComparison, setShowAddComparison] = useState(false);

  const now = new Date();
  const periods = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1, settings.monthStartDay);
    });
  }, [settings.monthStartDay]);

  const period = periods[-selectedPeriod] || getCurrentPayrollPeriod(settings.monthStartDay);
  const holidayDates = officialHolidays.map(h => h.date);

  const breakdown = useMemo(() => {
    if (!user) return null;
    const myAttendance = attendance.filter(r => r.userId === user.id);
    return calculateSalary(myAttendance, settings, period.start, period.end, holidayDates);
  }, [user, attendance, settings, period.start, period.end, holidayDates]);

  const myComparisons = salaryComparisons.filter(c => c.userId === user?.id);

  const handleExportPDF = () => {
    if (!breakdown || !user) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.addFont('Helvetica', 'Helvetica', 'normal');
    doc.setFont('Helvetica');
    
    // Header
    doc.setFontSize(18);
    doc.text('Salary Report', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Period: ${period.label}`, 105, 30, { align: 'center' });
    doc.text(`Employee: ${user.name}`, 105, 38, { align: 'center' });

    autoTable(doc, {
      startY: 45,
      head: [['Item', 'Amount (EGP)']],
      body: [
        ['Base Salary', breakdown.baseSalary.toFixed(2)],
        ['Transport Allowance', breakdown.transportAllowance.toFixed(2)],
        ['Overtime Pay', `+${breakdown.overtimePay.toFixed(2)}`],
        ['Late Deduction', `-${breakdown.lateDeduction.toFixed(2)}`],
        ['Absence Deduction', `-${breakdown.absenceDeduction.toFixed(2)}`],
        ['Unpaid Leave Deduction', `-${breakdown.unpaidLeaveDeduction.toFixed(2)}`],
        ...(breakdown.insuranceDeduction > 0 ? [['Insurance', `-${breakdown.insuranceDeduction.toFixed(2)}`]] : []),
        ...(breakdown.taxDeduction > 0 ? [['Tax', `-${breakdown.taxDeduction.toFixed(2)}`]] : []),
        ['NET SALARY', breakdown.netSalary.toFixed(2)],
      ],
      styles: { fontSize: 10, halign: 'right' },
      headStyles: { fillColor: [22, 78, 180] },
      footStyles: { fillColor: [22, 78, 180] },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });

    doc.save(`salary_${user.username}_${period.label}.pdf`);
    toast.success('تم تصدير كشف الراتب');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
            <DollarSign size={20} className="text-success" />
          </div>
          <h1 className="text-lg font-black text-foreground">تفاصيل الراتب</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* اختيار الفترة */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {periods.slice(0, 6).map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedPeriod(-i)}
              className={cn(
                'shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all',
                selectedPeriod === -i
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* الراتب الصافي */}
        {breakdown && (
          <>
            <div className="bg-gradient-to-br from-success/15 to-success/5 border border-success/25 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground font-medium mb-1">الراتب الصافي — {period.label}</p>
              <p className="text-4xl font-black text-success font-mono">{formatCurrency(breakdown.netSalary)}</p>
              
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="أيام العمل" value={`${breakdown.workingDays}`} />
                <Stat label="الحضور" value={`${breakdown.presentDays}`} color="success" />
                <Stat label="الغياب" value={`${breakdown.absentDays}`} color="destructive" />
              </div>
            </div>

            {/* تفاصيل الراتب */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h2 className="text-sm font-black text-foreground">تفصيل الراتب</h2>
              </div>
              <div className="p-4 space-y-1">
                <SalaryRow label="الراتب الأساسي" value={breakdown.baseSalary} type="neutral" />
                <SalaryRow label="بدل المواصلات" value={breakdown.transportAllowance} type="add" />
                {breakdown.overtimePay > 0 && <SalaryRow label="مكافأة الأوفرتايم" value={breakdown.overtimePay} type="add" sub={`${breakdown.overtimeHours}h`} />}
                {breakdown.lateDeduction > 0 && <SalaryRow label="خصم التأخير" value={breakdown.lateDeduction} type="deduct" sub={`${breakdown.lateDays} يوم`} />}
                {breakdown.absenceDeduction > 0 && <SalaryRow label="خصم الغياب" value={breakdown.absenceDeduction} type="deduct" sub={`${breakdown.absentDays} يوم`} />}
                {breakdown.unpaidLeaveDeduction > 0 && <SalaryRow label="خصم إجازة بدون راتب" value={breakdown.unpaidLeaveDeduction} type="deduct" />}
                {breakdown.insuranceDeduction > 0 && <SalaryRow label="اشتراك التأمين" value={breakdown.insuranceDeduction} type="deduct" />}
                {breakdown.taxDeduction > 0 && <SalaryRow label="ضريبة الدخل" value={breakdown.taxDeduction} type="deduct" />}
                <div className="border-t border-border mt-2 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-foreground">الإجمالي الصافي</span>
                    <span className="text-lg font-black text-success font-mono">{formatCurrency(breakdown.netSalary)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* إحصائيات الإجازات */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h2 className="text-sm font-black text-foreground mb-3">إحصائيات الفترة</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'إجازة سنوية', value: breakdown.annualLeaveDays, color: 'success' },
                  { label: 'إجازة مرضية', value: breakdown.sickLeaveDays, color: 'warning' },
                  { label: 'إجازة بدون راتب', value: breakdown.unpaidLeaveDays, color: 'destructive' },
                  { label: 'ساعات أوفرتايم', value: `${breakdown.overtimeHours}h`, color: 'info' },
                ].map(s => (
                  <div key={s.label} className={`bg-${s.color}/10 border border-${s.color}/20 rounded-xl p-2.5`}>
                    <p className="text-muted-foreground font-medium">{s.label}</p>
                    <p className={`text-base font-black text-${s.color} font-mono mt-0.5`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleExportPDF}
              className="w-full py-3 bg-info/10 border border-info/20 text-info rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-info/20 transition-all"
            >
              <Download size={16} />
              تصدير كشف الراتب PDF
            </button>
          </>
        )}

        {/* مقارنة الرواتب */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <BarChart2 size={14} /> مقارنة الرواتب
            </h2>
            <button
              onClick={() => setShowAddComparison(true)}
              className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {myComparisons.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد مقارنات بعد</p>
            ) : (
              myComparisons.map(comp => (
                <ComparisonCard
                  key={comp.id}
                  comp={comp}
                  onDelete={() => deleteSalaryComparison(comp.id).then(() => toast.success('تم الحذف'))}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {showAddComparison && (
        <AddComparisonModal
          userId={user?.id || ''}
          onClose={() => setShowAddComparison(false)}
          onSave={async (comp) => {
            await addSalaryComparison(comp);
            setShowAddComparison(false);
            toast.success('تمت إضافة المقارنة');
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color = 'foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-2 text-center">
      <p className={`text-base font-black text-${color} font-mono`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function SalaryRow({ label, value, type, sub }: {
  label: string; value: number; type: 'add' | 'deduct' | 'neutral'; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div>
        <span className="text-xs font-medium text-foreground">{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground ms-1.5">({sub})</span>}
      </div>
      <div className="flex items-center gap-1">
        {type === 'add' && <TrendingUp size={12} className="text-success" />}
        {type === 'deduct' && <TrendingDown size={12} className="text-destructive" />}
        <span className={cn(
          'text-xs font-black font-mono',
          type === 'add' ? 'text-success' :
          type === 'deduct' ? 'text-destructive' : 'text-foreground'
        )}>
          {type === 'add' ? '+' : type === 'deduct' ? '-' : ''}
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}

function ComparisonCard({ comp, onDelete }: { comp: SalaryComparison; onDelete: () => void }) {
  const isPositive = comp.difference >= 0;
  return (
    <div className="bg-muted/30 border border-border rounded-xl p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-foreground">{comp.monthLabel}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
            <span>متوقع: <b>{formatCurrency(comp.expectedSalary)}</b></span>
            <span>فعلي: <b>{formatCurrency(comp.receivedSalary)}</b></span>
          </div>
          <div className={cn('flex items-center gap-1 mt-1.5', isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span className="text-xs font-black">{isPositive ? '+' : ''}{formatCurrency(comp.difference)}</span>
          </div>
        </div>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-all">
          <Trash2 size={12} />
        </button>
      </div>
      {comp.notes && <p className="text-[10px] text-muted-foreground mt-1.5">{comp.notes}</p>}
    </div>
  );
}

function AddComparisonModal({ userId, onClose, onSave }: {
  userId: string;
  onClose: () => void;
  onSave: (c: SalaryComparison) => Promise<void>;
}) {
  const [form, setForm] = useState({
    monthLabel: `${MONTHS_ARABIC[new Date().getMonth()]} ${new Date().getFullYear()}`,
    expectedSalary: '',
    receivedSalary: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const exp = parseFloat(form.expectedSalary);
    const rec = parseFloat(form.receivedSalary);
    if (isNaN(exp) || isNaN(rec)) {
      toast.error('الرجاء إدخال أرقام صحيحة');
      return;
    }
    setLoading(true);
    await onSave({
      id: generateId(),
      userId,
      monthLabel: form.monthLabel,
      expectedSalary: exp,
      receivedSalary: rec,
      difference: rec - exp,
      notes: form.notes || undefined,
      date: new Date().toISOString(),
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-black text-foreground">إضافة مقارنة راتب</h2>
        <input value={form.monthLabel} onChange={e => setForm(f => ({ ...f, monthLabel: e.target.value }))}
          className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="اسم الشهر (مثال: مارس 2025)"
        />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={form.expectedSalary} onChange={e => setForm(f => ({ ...f, expectedSalary: e.target.value }))}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="الراتب المتوقع"
          />
          <input type="number" value={form.receivedSalary} onChange={e => setForm(f => ({ ...f, receivedSalary: e.target.value }))}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="الراتب الفعلي"
          />
        </div>
        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="ملاحظات (اختياري)"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90"
          >
            {loading ? '...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
