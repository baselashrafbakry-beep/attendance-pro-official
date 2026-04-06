import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { FileText, Plus, X, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LeaveRequest, LeaveType } from '../types';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from '../constants';
import { generateId } from '../utils/salary';
import { toast } from 'sonner';

export default function LeaveRequestsPage() {
  const { user, leaveRequests, createLeaveRequest, deleteLeaveRequest } = useApp();
  const [showForm, setShowForm] = useState(false);

  const myLeaves = leaveRequests
    .filter(l => l.userId === user?.id)
    .sort((a, b) => b.createdAt?.localeCompare(a.createdAt || '') || 0);

  const pending = myLeaves.filter(l => l.status === 'pending').length;
  const approved = myLeaves.filter(l => l.status === 'approved').length;
  const rejected = myLeaves.filter(l => l.status === 'rejected').length;

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

        <div className="grid grid-cols-3 gap-2">
          <StatCard label="قيد المراجعة" value={pending} color="warning" icon={Clock} />
          <StatCard label="موافق عليها" value={approved} color="success" icon={CheckCircle} />
          <StatCard label="مرفوضة" value={rejected} color="destructive" icon={XCircle} />
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

function LeaveCard({ leave, onDelete }: { leave: LeaveRequest; onDelete: () => void }) {
  const statusColors = { pending: 'warning', approved: 'success', rejected: 'destructive' };
  const color = statusColors[leave.status];
  
  const days = Math.ceil(
    (new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <div className={`bg-card border border-${color}/25 rounded-2xl p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black bg-${color}/15 text-${color} border border-${color}/20`}>
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
              {LEAVE_TYPE_LABELS[leave.leaveType]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1.5">
            <span>{leave.startDate}</span>
            <span>←</span>
            <span>{leave.endDate}</span>
            <span className="font-bold text-foreground">({days} يوم)</span>
          </div>

          <p className="text-xs text-foreground font-medium">{leave.reason}</p>
          
          {leave.notes && (
            <div className={`mt-2 p-2 bg-${color}/10 rounded-xl`}>
              <p className="text-[10px] text-muted-foreground">ملاحظة المسؤول: <span className="text-foreground">{leave.notes}</span></p>
            </div>
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

function LeaveRequestForm({ userId, onClose, onSave }: {
  userId: string;
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

  const handleSave = async () => {
    if (!form.reason.trim()) {
      toast.error('الرجاء كتابة سبب الإجازة');
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
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
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">من تاريخ</label>
            <input type="date" value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              min={today}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">إلى تاريخ</label>
            <input type="date" value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              min={form.startDate}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
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
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? 'جاري الإرسال...' : 'تقديم الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}
