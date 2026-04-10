import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { AttendanceRecord, DayType } from '../types';
import { DAY_TYPE_LABELS, MONTHS_ARABIC } from '../constants';
import { generateId, calcMinutes, formatLocalDate } from '../utils/salary';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// صفحة الإدخال الجماعي للحضور (للموظف)
export default function BulkPage() {
  const { user, settings, officialHolidays, bulkUpsertAttendance } = useApp();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rows, setRows] = useState<Array<{
    date: string; dayType: DayType; checkIn: string; checkOut: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateDays = () => {
    const [year, mon] = month.split('-').map(Number);
    const start = settings.monthStartDay;
    
    const dates: string[] = [];
    // من يوم البداية في الشهر الماضي إلى يوم البداية-1 هذا الشهر
    const d = new Date(year, mon - 2, start); // الشهر الماضي
    const endD = new Date(year, mon - 1, start - 1);
    while (d <= endD) {
      dates.push(formatLocalDate(d));
      d.setDate(d.getDate() + 1);
    }

    const newRows = dates.map(date => {
      const dow = new Date(date).getDay();
      const isOff = dow === settings.weeklyOffDay ||
        (settings.weeklyOffDay2 >= 0 && dow === settings.weeklyOffDay2);
      const isHoliday = officialHolidays.some(h => h.date === date);
      
      let dayType: DayType = 'present';
      if (isOff) dayType = 'holiday';
      else if (isHoliday) dayType = 'official_holiday';

      return {
        date,
        dayType,
        checkIn: isOff || isHoliday ? '' : settings.workStartTime,
        checkOut: isOff || isHoliday ? '' : settings.workEndTime,
      };
    });

    setRows(newRows);
    setGenerated(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    
    const records: AttendanceRecord[] = rows.map(r => {
      const checkIn = r.checkIn || undefined;
      const checkOut = r.checkOut || undefined;
      const shouldCalc = checkIn && ['present', 'late'].includes(r.dayType);
      const { lateMinutes, overtimeMinutes } = shouldCalc
        ? calcMinutes(checkIn, checkOut, settings)
        : { lateMinutes: 0, overtimeMinutes: 0 };
      const normalizedDayType: DayType =
        r.dayType === 'present' || r.dayType === 'late'
          ? (lateMinutes > 0 ? 'late' : 'present')
          : r.dayType;

      return {
        id: generateId(),
        userId: user.id,
        date: r.date,
        dayType: normalizedDayType,
        checkIn,
        checkOut,
        lateMinutes,
        overtimeMinutes,
        isManualEntry: true,
      };
    });

    const ok = await bulkUpsertAttendance(records);
    setLoading(false);
    if (ok) toast.success(`تم حفظ ${records.length} سجل بنجاح`);
    else toast.error('حدث خطأ في الحفظ');
  };

  const dayTypes: DayType[] = ['present', 'late', 'absent', 'sick_leave', 'annual_leave', 'unpaid_leave', 'official_holiday', 'holiday'];

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">الإدخال الجماعي</h1>
            <p className="text-xs text-muted-foreground">إدخال سجلات شهر كامل دفعة واحدة</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">اختر الشهر</label>
            <input type="month" value={month} onChange={e => { setMonth(e.target.value); setGenerated(false); }}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button onClick={generateDays}
            className="w-full py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-sm hover:bg-primary/20 transition-all">
            توليد أيام الشهر
          </button>
        </div>

        {generated && rows.length > 0 && (
          <>
            <div className="bg-info/10 border border-info/20 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-info mt-0.5 shrink-0" />
              <p className="text-xs text-info font-medium">
                تم توليد {rows.length} يوم. راجع وعدّل البيانات ثم اضغط "حفظ الكل".
              </p>
            </div>

            <div className="space-y-2">
              {rows.map((row, idx) => {
                const d = new Date(`${row.date}T12:00:00`);
                const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()];
                const isOff = row.dayType === 'holiday' || row.dayType === 'official_holiday';

                return (
                  <div key={row.date} className={cn(
                    'bg-card border rounded-xl p-3 space-y-2',
                    isOff ? 'border-muted opacity-60' : 'border-border'
                  )}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">{dayName} {row.date}</p>
                      <select
                        value={row.dayType}
                        onChange={e => {
                          const newRows = [...rows];
                          newRows[idx] = { ...newRows[idx], dayType: e.target.value as DayType };
                          setRows(newRows);
                        }}
                        className="text-[10px] font-bold bg-muted/50 border border-border rounded-lg px-2 py-1 focus:outline-none"
                      >
                        {dayTypes.map(t => <option key={t} value={t}>{DAY_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {!isOff && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground">دخول</label>
                          <input type="time" value={row.checkIn}
                            onChange={e => { const r = [...rows]; r[idx].checkIn = e.target.value; setRows(r); }}
                            className="w-full text-[11px] bg-muted/50 border border-border rounded-lg px-2 py-1 focus:outline-none font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground">خروج</label>
                          <input type="time" value={row.checkOut}
                            onChange={e => { const r = [...rows]; r[idx].checkOut = e.target.value; setRows(r); }}
                            className="w-full text-[11px] bg-muted/50 border border-border rounded-lg px-2 py-1 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={handleSave} disabled={loading}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 shadow-lg shadow-primary/20">
              {loading ? <><Loader2 size={18} className="animate-spin" /> جاري الحفظ...</> : <><Check size={18} /> حفظ {rows.length} سجل</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
