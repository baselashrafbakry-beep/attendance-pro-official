import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { FileText, Check, X, ChevronDown, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LeaveRequest } from '../types';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from '../constants';
import { toast } from 'sonner';

export default function AdminLeaveRequestsPage() {
  const { user, users, leaveRequests, updateLeaveStatus, deleteLeaveRequest } = useApp();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const filtered = leaveRequests
    .filter(l => filterStatus === 'all' || l.status === filterStatus)
    .sort((a, b) => {
      // pending أولاً
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  const pendingCount = leaveRequests.filter(l => l.status === 'pending').length;
  const approvedCount = leaveRequests.filter(l => l.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(l => l.status === 'rejected').length;

  const getEmpName = (userId: string) => users.find(u => u.id === userId)?.name || userId;

  const handleApprove = async (id: string) => {
    const ok = await updateLeaveStatus(id, 'approved', user?.id || 'admin', notesMap[id]);
    if (ok) toast.success('تمت الموافقة على الطلب');
    else toast.error('حدث خطأ');
  };

  const handleReject = async (id: string) => {
    const ok = await updateLeaveStatus(id, 'rejected', user?.id || 'admin', notesMap[id]);
    if (ok) toast.success('تم رفض الطلب');
    else toast.error('حدث خطأ');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
            <FileText size={20} className="text-warning" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">طلبات الإجازة</h1>
            <p className="text-xs text-muted-foreground">{pendingCount} طلب قيد المراجعة</p>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="قيد المراجعة" value={pendingCount} color="warning" />
          <StatCard label="موافق عليها" value={approvedCount} color="success" />
          <StatCard label="مرفوضة" value={rejectedCount} color="destructive" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* فلترة */}
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
              )}>
              {s === 'all' ? 'الكل' : LEAVE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد طلبات</div>
        ) : (
          filtered.map(leave => (
            <LeaveCard
              key={leave.id}
              leave={leave}
              empName={getEmpName(leave.userId)}
              expanded={expandedId === leave.id}
              notes={notesMap[leave.id] || ''}
              onToggle={() => setExpandedId(expandedId === leave.id ? null : leave.id)}
              onNotesChange={n => setNotesMap(m => ({ ...m, [leave.id]: n }))}
              onApprove={() => handleApprove(leave.id)}
              onReject={() => handleReject(leave.id)}
              onDelete={() => {
                if (confirm('حذف هذا الطلب؟')) {
                  deleteLeaveRequest(leave.id).then(() => toast.success('تم الحذف'));
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`bg-${color}/10 border border-${color}/20 rounded-xl p-2.5 text-center`}>
      <p className={`text-2xl font-black text-${color} font-mono`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function LeaveCard({ leave, empName, expanded, notes, onToggle, onNotesChange, onApprove, onReject, onDelete }: {
  leave: LeaveRequest;
  empName: string;
  expanded: boolean;
  notes: string;
  onToggle: () => void;
  onNotesChange: (n: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const statusColors = { pending: 'warning', approved: 'success', rejected: 'destructive' };
  const color = statusColors[leave.status];
  const days = Math.ceil(
    (new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <div className={`bg-card border border-${color}/20 rounded-2xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={onToggle}>
        <div className={`w-9 h-9 rounded-xl bg-${color}/15 flex items-center justify-center font-black text-${color} text-sm shrink-0`}>
          {empName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-foreground">{empName}</p>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-${color}/15 text-${color}`}>
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {LEAVE_TYPE_LABELS[leave.leaveType]} · {leave.startDate} → {leave.endDate} · {days} يوم
          </p>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3 space-y-3">
          <div className="bg-muted/30 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">سبب الإجازة:</p>
            <p className="text-sm text-foreground">{leave.reason}</p>
          </div>

          {leave.notes && (
            <div className={`bg-${color}/10 rounded-xl p-3`}>
              <p className="text-[10px] text-muted-foreground font-medium mb-1">ملاحظة المسؤول:</p>
              <p className="text-sm text-foreground">{leave.notes}</p>
            </div>
          )}

          {leave.status === 'pending' && (
            <>
              <textarea
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="أضف ملاحظة (اختياري)..."
                rows={2}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onApprove}
                  className="py-3 bg-success/15 border border-success/25 text-success rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-success/25 transition-all"
                >
                  <Check size={16} /> موافقة
                </button>
                <button
                  onClick={onReject}
                  className="py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all"
                >
                  <X size={16} /> رفض
                </button>
              </div>
            </>
          )}

          <button
            onClick={onDelete}
            className="w-full py-2 bg-muted/50 text-muted-foreground rounded-xl text-xs font-bold hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            حذف الطلب
          </button>
        </div>
      )}
    </div>
  );
}
