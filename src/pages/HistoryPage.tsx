import { useState, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { Calendar, Search, Filter, Trash2, Edit3, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { DAY_TYPE_LABELS, MONTHS_ARABIC } from '../constants';
import type { AttendanceRecord, DayType } from '../types';
import { toast } from 'sonner';
import { generateId } from '../utils/salary';

const DAY_TYPE_COLORS: Record<string, string> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  holiday: 'muted',
  official_holiday: 'info',
  sick_leave: 'warning',
  annual_leave: 'success',
  unpaid_leave: 'destructive',
};

export default function HistoryPage() {
  const { user, attendance, upsertAttendance, deleteAttendance } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DayType | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);

  const myAttendance = useMemo(() =>
    attendance
      .filter(r => r.userId === user?.id)
      .filter(r => filterType === 'all' || r.dayType === filterType)
      .filter(r => !filterMonth || r.date.startsWith(filterMonth))
      .filter(r => !search || r.date.includes(search) || (r.note || '').includes(search))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, user?.id, filterType, filterMonth, search]
  );

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const present = myAttendance.filter(r => r.dayType === 'present').length;
    const late = myAttendance.filter(r => r.dayType === 'late').length;
    const absent = myAttendance.filter(r => r.dayType === 'absent').length;
    const leaves = myAttendance.filter(r => ['sick_leave', 'annual_leave', 'unpaid_leave'].includes(r.dayType)).length;
    return { present, late, absent, leaves };
  }, [myAttendance]);

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    await deleteAttendance(id);
    toast.success('تم حذف السجل');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-info" />
          </div>
          <h1 className="text-lg font-black text-foreground">سجل الحضور</h1>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'حاضر', value: stats.present, color: 'success' },
            { label: 'متأخر', value: stats.late, color: 'warning' },
            { label: 'غائب', value: stats.absent, color: 'destructive' },
            { label: 'إجازات', value: stats.leaves, color: 'info' },
          ].map(s => (
            <div key={s.label} className={`bg-${s.color}/10 border border-${s.color}/20 rounded-xl p-2 text-center`}>
              <p className={`text-lg font-black text-${s.color} font-mono`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* البحث والفلترة */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالتاريخ أو الملاحظة..."
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs font-medium pe-8 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* فلترة النوع */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(['all', 'present', 'late', 'absent', 'sick_leave', 'annual_leave', 'official_holiday'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap',
                filterType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30'
              )}
            >
              {type === 'all' ? 'الكل' : DAY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* القائمة */}
        {myAttendance.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Calendar size={40} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا توجد سجلات</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myAttendance.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onEdit={() => setEditRecord(record)}
                onDelete={() => handleDelete(record.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <EditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={async (updated) => {
            await upsertAttendance(updated);
            setEditRecord(null);
            toast.success('تم تحديث السجل');
          }}
        />
      )}
    </div>
  );
}

function RecordCard({ record, onEdit, onDelete }: {
  record: AttendanceRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = DAY_TYPE_COLORS[record.dayType] || 'muted';
  const d = new Date(record.date);
  const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()];
  const dateFormatted = `${d.getDate()} ${MONTHS_ARABIC[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div className={`bg-card border border-${color}/20 rounded-2xl p-3.5 flex items-center gap-3`}>
      <div className={`w-2 h-full min-h-[40px] bg-${color} rounded-full shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-foreground">{dayName}، {dateFormatted}</p>
            <span className={`text-[10px] font-bold text-${color} bg-${color}/10 px-2 py-0.5 rounded-full mt-0.5 inline-block`}>
              {DAY_TYPE_LABELS[record.dayType]}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all">
              <Edit3 size={12} />
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
          {record.checkIn && <span>دخول: <b className="text-foreground">{record.checkIn}</b></span>}
          {record.checkOut && <span>خروج: <b className="text-foreground">{record.checkOut}</b></span>}
          {record.lateMinutes > 0 && <span className="text-warning">تأخير: {record.lateMinutes}د</span>}
          {record.overtimeMinutes > 0 && <span className="text-success">OT: {record.overtimeMinutes}د</span>}
        </div>
        {record.note && <p className="text-[10px] text-muted-foreground mt-1">{record.note}</p>}
        {record.isManualEntry && <span className="text-[9px] text-muted-foreground/50">إدخال يدوي</span>}
      </div>
    </div>
  );
}

function EditModal({ record, onClose, onSave }: {
  record: AttendanceRecord;
  onClose: () => void;
  onSave: (r: AttendanceRecord) => Promise<void>;
}) {
  const [form, setForm] = useState({ ...record });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave({ ...form, isManualEntry: true });
    setLoading(false);
  };

  const dayTypes: DayType[] = ['present', 'late', 'absent', 'sick_leave', 'annual_leave', 'unpaid_leave', 'official_holiday', 'holiday'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-0" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">تعديل السجل</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">التاريخ</label>
          <input type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">نوع اليوم</label>
          <select value={form.dayType}
            onChange={e => setForm(f => ({ ...f, dayType: e.target.value as DayType }))}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {dayTypes.map(t => <option key={t} value={t}>{DAY_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">وقت الدخول</label>
            <input type="time" value={form.checkIn || ''}
              onChange={e => setForm(f => ({ ...f, checkIn: e.target.value || undefined }))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">وقت الخروج</label>
            <input type="time" value={form.checkOut || ''}
              onChange={e => setForm(f => ({ ...f, checkOut: e.target.value || undefined }))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">دقائق التأخير</label>
            <input type="number" min="0" value={form.lateMinutes}
              onChange={e => setForm(f => ({ ...f, lateMinutes: parseInt(e.target.value) || 0 }))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">دقائق الأوفرتايم</label>
            <input type="number" min="0" value={form.overtimeMinutes}
              onChange={e => setForm(f => ({ ...f, overtimeMinutes: parseInt(e.target.value) || 0 }))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">ملاحظة</label>
          <textarea value={form.note || ''}
            onChange={e => setForm(f => ({ ...f, note: e.target.value || undefined }))}
            rows={2}
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          حفظ التعديلات
        </button>
      </div>
    </div>
  );
}

// حل مشكلة import
const Loader2 = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
