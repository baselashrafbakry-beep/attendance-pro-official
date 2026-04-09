import { useState, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { Clock, Search, Download, Plus, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AttendanceRecord, DayType, User } from '../types';
import { DAY_TYPE_LABELS } from '../constants';
import { generateId } from '../utils/salary';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function AdminAttendancePage() {
  const { users, attendance, upsertAttendance, deleteAttendance } = useApp();
  const [filterUser, setFilterUser] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState<DayType | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');

  const employees = users.filter(u => u.role === 'employee');

  const filtered = useMemo(() => {
    return attendance
      .filter(r => filterUser === 'all' || r.userId === filterUser)
      .filter(r => !filterDate || r.date === filterDate)
      .filter(r => !filterMonth || r.date.startsWith(filterMonth))
      .filter(r => filterType === 'all' || r.dayType === filterType)
      .filter(r => {
        if (!search) return true;
        const emp = users.find(u => u.id === r.userId);
        return (emp?.name || '').includes(search) || r.date.includes(search);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, filterUser, filterDate, filterMonth, filterType, search, users]);

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || userId;

  // إحصائيات
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = attendance.filter(r => r.date === todayStr);
  const presentToday = todayRecords.filter(r => ['present', 'late'].includes(r.dayType)).length;
  const absentToday = todayRecords.filter(r => r.dayType === 'absent').length;

  const handleExportExcel = () => {
    const rows = filtered.map(r => ({
      'الموظف': getUserName(r.userId),
      'التاريخ': r.date,
      'النوع': DAY_TYPE_LABELS[r.dayType] || r.dayType,
      'الدخول': r.checkIn || '',
      'الخروج': r.checkOut || '',
      'تأخير (دقيقة)': r.lateMinutes,
      'أوفرتايم (دقيقة)': r.overtimeMinutes,
      'ملاحظة': r.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
    XLSX.writeFile(wb, `attendance_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير ملف Excel');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-info" />
            </div>
            <h1 className="text-lg font-black text-foreground">سجل الحضور</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="w-9 h-9 bg-success/10 border border-success/20 text-success rounded-xl flex items-center justify-center hover:bg-success/20 transition-all">
              <Download size={16} />
            </button>
            <button onClick={() => setShowAddForm(true)} className="w-9 h-9 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center hover:bg-primary/20 transition-all">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* إحصائيات اليوم */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/10 border border-success/20 rounded-xl p-2.5 text-center">
            <p className="text-xl font-black text-success font-mono">{presentToday}</p>
            <p className="text-[9px] text-muted-foreground">حاضر اليوم</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 text-center">
            <p className="text-xl font-black text-destructive font-mono">{absentToday}</p>
            <p className="text-[9px] text-muted-foreground">غائب اليوم</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-2.5 text-center">
            <p className="text-xl font-black text-foreground font-mono">{filtered.length}</p>
            <p className="text-[9px] text-muted-foreground">إجمالي السجلات</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* الفلاتر */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الموظف..."
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-xs pe-8 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex gap-2">
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">كل الموظفين</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(['all', 'present', 'late', 'absent', 'sick_leave', 'annual_leave', 'official_holiday', 'holiday'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap',
                filterType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
              )}>
              {t === 'all' ? 'الكل' : DAY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* القائمة */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد سجلات</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(record => (
              <AdminRecordCard
                key={record.id}
                record={record}
                empName={getUserName(record.userId)}
                onDelete={() => {
                  if (confirm('حذف هذا السجل؟')) {
                    deleteAttendance(record.id).then(() => toast.success('تم الحذف'));
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showAddForm && (
        <AddRecordModal
          employees={employees}
          onClose={() => setShowAddForm(false)}
          onSave={async (rec) => {
            await upsertAttendance(rec);
            setShowAddForm(false);
            toast.success('تم إضافة السجل');
          }}
        />
      )}
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  present: 'success', late: 'warning', absent: 'destructive',
  holiday: 'muted', official_holiday: 'info', sick_leave: 'warning',
  annual_leave: 'success', unpaid_leave: 'destructive',
};

function AdminRecordCard({ record, empName, onDelete }: {
  record: AttendanceRecord; empName: string; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = TYPE_COLORS[record.dayType] || 'muted';

  return (
    <div className={`bg-card border border-${color}/20 rounded-2xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-2 min-h-[36px] bg-${color} rounded-full shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-foreground truncate">{empName}</p>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{record.date}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold text-${color}`}>{DAY_TYPE_LABELS[record.dayType]}</span>
            {record.checkIn && <span className="text-[10px] text-muted-foreground font-mono">{record.checkIn} → {record.checkOut || '?'}</span>}
          </div>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {record.lateMinutes > 0 && <div className="bg-warning/10 rounded-xl p-2"><span className="text-muted-foreground">تأخير: </span><span className="text-warning font-black">{record.lateMinutes} د</span></div>}
            {record.overtimeMinutes > 0 && <div className="bg-success/10 rounded-xl p-2"><span className="text-muted-foreground">أوفرتايم: </span><span className="text-success font-black">{record.overtimeMinutes} د</span></div>}
          </div>
          {record.note && <p className="text-[10px] text-muted-foreground">{record.note}</p>}
          <button onClick={onDelete} className="w-full py-2 bg-destructive/10 text-destructive rounded-xl text-xs font-bold hover:bg-destructive/20 transition-all">
            حذف السجل
          </button>
        </div>
      )}
    </div>
  );
}

function AddRecordModal({ employees, onClose, onSave }: {
  employees: User[];
  onClose: () => void;
  onSave: (r: AttendanceRecord) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    userId: employees[0]?.id || '',
    date: today,
    dayType: 'present' as DayType,
    checkIn: '',
    checkOut: '',
    lateMinutes: 0,
    overtimeMinutes: 0,
    note: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.userId) { toast.error('اختر موظفاً'); return; }
    setLoading(true);
    await onSave({
      id: generateId(),
      userId: form.userId,
      date: form.date,
      dayType: form.dayType,
      checkIn: form.checkIn || undefined,
      checkOut: form.checkOut || undefined,
      lateMinutes: form.lateMinutes,
      overtimeMinutes: form.overtimeMinutes,
      note: form.note || undefined,
      isManualEntry: true,
    });
    setLoading(false);
  };

  const dayTypes: DayType[] = ['present', 'late', 'absent', 'sick_leave', 'annual_leave', 'unpaid_leave', 'official_holiday', 'holiday'];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end justify-center animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-[2.5rem] w-full max-w-lg flex flex-col max-h-[92dvh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header - Sticky */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card/80 backdrop-blur-md">
          <h2 className="text-base font-black text-foreground">إضافة سجل حضور</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-all">
            <X size={20} className="text-foreground" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">الموظف</label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className={cls}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">التاريخ</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={cls} />
              </div>
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">نوع اليوم</label>
                <select value={form.dayType} onChange={e => setForm(f => ({ ...f, dayType: e.target.value as DayType }))} className={cls}>
                  {dayTypes.map(t => <option key={t} value={t}>{DAY_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">وقت الدخول</label>
                <input type="time" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} className={cls} />
              </div>
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">وقت الخروج</label>
                <input type="time" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} className={cls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">تأخير (دقيقة)</label>
                <input type="number" min="0" value={form.lateMinutes} onChange={e => setForm(f => ({ ...f, lateMinutes: parseInt(e.target.value) || 0 }))} className={cls} />
              </div>
              <div>
                <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">أوفرتايم (دقيقة)</label>
                <input type="number" min="0" value={form.overtimeMinutes} onChange={e => setForm(f => ({ ...f, overtimeMinutes: parseInt(e.target.value) || 0 }))} className={cls} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">ملاحظة</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={cls} placeholder="اختياري" />
            </div>
          </div>
        </div>

        {/* Footer - Sticky Buttons */}
        <div className="px-6 py-5 border-t border-border bg-card/95 backdrop-blur-md flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-muted text-foreground rounded-2xl font-bold text-sm active:scale-95 transition-all">إلغاء</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:bg-primary/90 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-primary/20">
            {loading ? 'جاري الحفظ...' : 'إضافة السجل'}
          </button>
        </div>
      </div>
    </div>
  );
}

const cls = 'w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground';
