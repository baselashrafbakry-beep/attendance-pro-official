import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { FileText, Plus, X, Clock, CheckCircle, XCircle, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LeaveRequest, LeaveType } from '../types';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from '../constants';
import { generateId } from '../utils/salary';
import { toast } from 'sonner';

// حساب عدد أيام الإجازة المستخدمة حسب النوع (بدون UTC offset)
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function countUsedLeaveDays(leaves: LeaveRequest[], userId: string, type: LeaveType): number {
  return leaves
    .filter(l => l.userId === userId && l.leaveType === type && l.status === 'approved')
    .reduce((sum, l) => {
      const days = Math.round(
        (parseLocalDate(l.endDate).getTime() - parseLocalDate(l.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      return sum + days;
    }, 0);
}

export default function LeaveRequestsPage() {
  const { user, leaveRequests, createLeaveRequest, deleteLeaveRequest } = useApp();
  const [showForm, setShowForm] = useState(false);

  const myLeaves = leaveRequests
    .filter(l => l.userId === user?.id)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const pending = myLeaves.filter(l => l.status === 'pending').length;
  const approved = myLeaves.filter(l => l.status === 'approved').length;
  const rejected = myLeaves.filter(l => l.status === 'rejected').length;

  // حساب رصيد الإجازات
  const usedAnnual = countUsedLeaveDays(leaveRequests, user?.id || '', 'annual_leave');
  const usedSick = countUsedLeaveDays(leaveRequests, user?.id || '', 'sick_leave');
  const annualLimit = user?.annualLeaveLimit ?? 21;
  const sickLimit = user?.sickLeaveLimit ?? 15;
  const remainingAnnual = Math.max(0, annualLimit - usedAnnual);
  const remainingSick = Math.max(0, sickLimit - usedSick);

  const handleDelete = async (id: string) => {
    const leave = leaveRequests.find(l => l.id === id);
    if (leave?.status !== 'pending') {
      toast.error('لا يمكن حذف طلب تمت معالجته');
      return;
    }
    if (!confirm('هل تريد إلغاء هذا الطلب؟')) return;
    await deleteLeaveRequest(id);
    toast.success('تم إلغاء الطلب');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-warning" />
            </div>
            <h1 className="text-lg font-black text-foreground">طلبات الإجازة</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* إحصائيات الطلبات */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatCard label="قيد المراجعة" value={pending} color="warning" icon={Clock} />
          <StatCard label="موافق عليها" value={approved} color="success" icon={CheckCircle} />
          <StatCard label="مرفوضة" value={rejected} color="destructive" icon={XCircle} />
        </div>

        {/* رصيد الإجازات */}
        <div className="grid grid-cols-2 gap-2">
          <LeaveBalance
            label="الإجازة السنوية"
            used={usedAnnual}
            total={annualLimit}
            remaining={remainingAnnual}
            color="success"
          />
          <LeaveBalance
            label="الإجازة المرضية"
            used={usedSick}
            total={sickLimit}
            remaining={remainingSick}
            color="info"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {myLeaves.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <FileText size={48} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات إجازة</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
            >
              تقديم طلب إجازة
            </button>
          </div>
        ) : (
          myLeaves.map(leave => (
            <LeaveCard key={leave.id} leave={leave} onDelete={() => handleDelete(leave.id)} />
          ))
        )}
      </div>

      {showForm && (
        <LeaveRequestForm
          userId={user?.id || ''}
          remainingAnnual={remainingAnnual}
          remainingSick={remainingSick}
          onClose={() => setShowForm(false)}
          onSave={async (req) => {
            const ok = await createLeaveRequest(req);
            if (ok) {
              setShowForm(false);
              toast.success('تم تقديم طلب الإجازة بنجاح');
            } else {
              toast.error('حدث خطأ أثناء تقديم الطلب');
            }
          }}
        />
      )}
    </div>
  );
}

// ─── بطاقة إحصاء ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ElementType;
}) {
  return (
    <div className={`bg-${color}/10 border border-${color}/20 rounded-xl p-2.5 text-center`}>
      <Icon size={16} className={`text-${color} mx-auto mb-1`} />
      <p className={`text-xl font-black text-${color} font-mono`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

// ─── بطاقة رصيد الإجازة ──────────────────────────────────────────────────────

function LeaveBalance({ label, used, total, remaining, color }: {
  label: string; used: number; total: number; remaining: number; color: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isFull = remaining === 0;

  return (
    <div className={`bg-card border rounded-xl p-3 ${isFull ? 'border-destructive/30' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
        {isFull && <AlertCircle size={12} className="text-destructive" />}
      </div>
      {/* شريط التقدم */}
      <div className="w-full bg-muted rounded-full h-1.5 mb-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isFull ? 'bg-destructive' : `bg-${color}`
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-lg font-black font-mono', isFull ? 'text-destructive' : `text-${color}`)}>
          {remaining}
        </span>
        <span className="text-[10px] text-muted-foreground">متبقي من {total}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{used} يوم مستخدم</p>
    </div>
  );
}

// ─── بطاقة طلب الإجازة ───────────────────────────────────────────────────────

function LeaveCard({ leave, onDelete }: { leave: LeaveRequest; onDelete: () => void }) {
  const statusColors = { pending: 'warning', approved: 'success', rejected: 'destructive' };
  const color = statusColors[leave.status];
  
  // حساب عدد الأيام بدون UTC offset — نفسّر التاريخ كـ local date
  const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const days = Math.round(
    (parseDate(leave.endDate).getTime() - parseDate(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <div className={`bg-card border border-${color}/25 rounded-2xl p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black bg-${color}/15 text-${color} border border-${color}/20`}>
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
              {LEAVE_TYPE_LABELS[leave.leaveType]}
            </span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-black bg-muted/30 text-foreground`}>
              {days} {days === 1 ? 'يوم' : 'أيام'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1.5">
            <span>{leave.startDate}</span>
            <span>←</span>
            <span>{leave.endDate}</span>
          </div>

          <p className="text-xs text-foreground font-medium">{leave.reason}</p>

          {leave.notes && (
            <div className={`mt-2 p-2 bg-${color}/10 rounded-xl`}>
              <p className="text-[10px] text-muted-foreground">ملاحظة المسؤول: <span className="text-foreground font-medium">{leave.notes}</span></p>
            </div>
          )}

          {leave.approvalDate && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {leave.status === 'approved' ? '✅ تمت الموافقة' : '❌ تم الرفض'} في {new Date(leave.approvalDate).toLocaleDateString('ar-EG')}
            </p>
          )}
        </div>

        {leave.status === 'pending' && (
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-all ms-2 shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── نموذج الطلب ─────────────────────────────────────────────────────────────

function LeaveRequestForm({ userId, remainingAnnual, remainingSick, onClose, onSave }: {
  userId: string;
  remainingAnnual: number;
  remainingSick: number;
  onClose: () => void;
  onSave: (r: LeaveRequest) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leaveType: 'annual_leave' as LeaveType,
    startDate: today,
    endDate: today,
    reason: '',
  });
  const [loading, setLoading] = useState(false);

  const requestedDays = Math.round(
    (parseLocalDate(form.endDate).getTime() - parseLocalDate(form.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const handleSave = async () => {
    if (!form.reason.trim()) {
      toast.error('الرجاء كتابة سبب الإجازة');
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }
    // التحقق من الرصيد
    if (form.leaveType === 'annual_leave' && requestedDays > remainingAnnual) {
      toast.error(`الرصيد المتبقي (${remainingAnnual} يوم) أقل من المطلوب (${requestedDays} يوم)`);
      return;
    }
    if (form.leaveType === 'sick_leave' && requestedDays > remainingSick) {
      toast.error(`رصيد الإجازة المرضية المتبقي (${remainingSick} يوم) أقل من المطلوب (${requestedDays} يوم)`);
      return;
    }
    setLoading(true);
    await onSave({
      id: generateId(),
      userId,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      leaveType: form.leaveType,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">طلب إجازة جديد</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">نوع الإجازة</label>
          <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as LeaveType }))}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* عرض الرصيد المتبقي */}
        {(form.leaveType === 'annual_leave' || form.leaveType === 'sick_leave') && (
          <div className={cn(
            'rounded-xl px-3 py-2.5 text-xs',
            form.leaveType === 'annual_leave'
              ? (remainingAnnual > 0 ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20')
              : (remainingSick > 0 ? 'bg-info/10 border border-info/20' : 'bg-destructive/10 border border-destructive/20')
          )}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">
                الرصيد المتبقي ({form.leaveType === 'annual_leave' ? 'سنوية' : 'مرضية'})
              </span>
              <span className={cn(
                'font-black font-mono',
                form.leaveType === 'annual_leave'
                  ? (remainingAnnual > 0 ? 'text-success' : 'text-destructive')
                  : (remainingSick > 0 ? 'text-info' : 'text-destructive')
              )}>
                {form.leaveType === 'annual_leave' ? remainingAnnual : remainingSick} يوم
              </span>
            </div>
            {requestedDays > 0 && (
              <p className="text-muted-foreground mt-1">
                الطلب: <span className="font-bold text-foreground">{requestedDays} يوم</span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">من تاريخ</label>
            <input type="date" value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              min={today}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">إلى تاريخ</label>
            <input type="date" value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              min={form.startDate}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">سبب الإجازة</label>
          <textarea
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            rows={3}
            placeholder="اكتب سبب الإجازة هنا..."
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60">
            {loading ? 'جاري الإرسال...' : 'تقديم الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}
