import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { Clock, CheckCircle, LogIn, LogOut, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { todayStr, nowTimeStr, generateId, calcMinutes } from '../utils/salary';
import type { AttendanceRecord, DayType } from '../types';
import { DAY_TYPE_LABELS } from '../constants';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function AttendancePage() {
  const { user, attendance, settings, upsertAttendance, officialHolidays } = useApp();
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(nowTimeStr());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(nowTimeStr()), 1000);
    return () => clearInterval(interval);
  }, []);

  const today = todayStr();
  const todayRecord = attendance.find(r => r.userId === user?.id && r.date === today);
  const todayDow = new Date().getDay();
  
  const isWeeklyOff = todayDow === settings.weeklyOffDay ||
    (settings.weeklyOffDay2 >= 0 && todayDow === settings.weeklyOffDay2);
  const isOfficialHoliday = officialHolidays.some(h => h.date === today);

  const canCheckIn = !todayRecord?.checkIn && !isWeeklyOff && !isOfficialHoliday;
  const canCheckOut = !!todayRecord?.checkIn && !todayRecord?.checkOut;

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const time = nowTimeStr();
      const { lateMinutes } = calcMinutes(time, undefined, settings);
      const dayType: DayType = lateMinutes > 0 ? 'late' : 'present';

      let checkInLocation;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true,
            timeout: 10000 
          })
        );
        checkInLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) {
        console.warn('Geolocation failed:', e);
        if (settings.requireGPS) {
          toast.error('يجب السماح بالوصول للموقع الجغرافي لتسجيل الحضور');
          return;
        }
      }

      if (settings.checkTimeCheating) {
        try {
          const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
          const data = await res.json();
          const serverTime = new Date(data.utc_datetime);
          const localTime = new Date();
          const diffMs = Math.abs(serverTime.getTime() - localTime.getTime());
          if (diffMs > 5 * 60 * 1000) { // 5 mins
            toast.error('تم اكتشاف تلاعب في وقت الجهاز. يرجى ضبط الساعة للوقت الصحيح.');
            return;
          }
        } catch (e) {
          console.warn('Time check failed, skipping safety check');
        }
      }

      const record: AttendanceRecord = {
        id: todayRecord?.id || generateId(),
        userId: user.id,
        date: today,
        checkIn: time,
        checkOut: todayRecord?.checkOut,
        checkInLocation,
        dayType,
        lateMinutes,
        overtimeMinutes: 0,
        isManualEntry: false,
      };

      await upsertAttendance(record);
      toast.success(`تم تسجيل الدخول الساعة ${time}${lateMinutes > 0 ? ` (تأخير ${lateMinutes} دقيقة)` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !todayRecord?.checkIn) return;
    setLoading(true);
    try {
      const time = nowTimeStr();
      const { overtimeMinutes } = calcMinutes(todayRecord.checkIn, time, settings);

      let checkOutLocation;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true,
            timeout: 10000 
          })
        );
        checkOutLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) {
        console.warn('Geolocation failed:', e);
        if (settings.requireGPS) {
          toast.error('يجب السماح بالوصول للموقع الجغرافي لتسجيل الانصراف');
          return;
        }
      }

      const record: AttendanceRecord = {
        ...todayRecord,
        checkOut: time,
        checkOutLocation,
        overtimeMinutes,
      };

      await upsertAttendance(record);
      toast.success(`تم تسجيل الخروج الساعة ${time}${overtimeMinutes > 0 ? ` (أوفرتايم ${overtimeMinutes} دقيقة)` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Clock size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">تسجيل الحضور</h1>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* ساعة الوقت الحالي */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
          <p className="text-xs text-muted-foreground font-medium mb-2">الوقت الحالي</p>
          <p className="text-5xl font-black text-primary font-mono tracking-wider">{currentTime}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span>بداية الدوام: <span className="font-bold text-foreground font-mono">{settings.workStartTime}</span></span>
            <span>•</span>
            <span>نهاية الدوام: <span className="font-bold text-foreground font-mono">{settings.workEndTime}</span></span>
          </div>
        </div>

        {/* إجازة رسمية أو أسبوعية */}
        {(isWeeklyOff || isOfficialHoliday) && (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle size={24} className="text-success shrink-0" />
            <div>
              <p className="text-sm font-black text-success">
                {isOfficialHoliday ? `إجازة رسمية: ${officialHolidays.find(h => h.date === today)?.name}` : 'إجازة أسبوعية'}
              </p>
              <p className="text-xs text-muted-foreground">لا يوجد تسجيل حضور مطلوب اليوم</p>
            </div>
          </div>
        )}

        {/* حالة اليوم */}
        {todayRecord && (
          <StatusCard record={todayRecord} />
        )}

        {/* أزرار الحضور */}
        {!isWeeklyOff && !isOfficialHoliday && (
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={handleCheckIn}
              disabled={!canCheckIn || loading}
              className={cn(
                'py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-lg',
                'active:scale-[0.97]',
                canCheckIn
                  ? 'bg-success text-white shadow-success/20 hover:bg-success/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              {todayRecord?.checkIn ? `تم الدخول ${todayRecord.checkIn}` : 'تسجيل الدخول'}
            </button>

            <button
              onClick={handleCheckOut}
              disabled={!canCheckOut || loading}
              className={cn(
                'py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-lg',
                'active:scale-[0.97]',
                canCheckOut
                  ? 'bg-destructive text-white shadow-destructive/20 hover:bg-destructive/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
              {todayRecord?.checkOut ? `تم الخروج ${todayRecord.checkOut}` : 'تسجيل الخروج'}
            </button>
          </div>
        )}

        {/* تفاصيل التأخر */}
        {todayRecord?.lateMinutes && todayRecord.lateMinutes > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-warning" />
              <span className="text-sm font-black text-warning">تأخير اليوم</span>
            </div>
            <p className="text-2xl font-black text-warning font-mono">{todayRecord.lateMinutes} <span className="text-sm font-normal">دقيقة</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              وقت الدخول: {todayRecord.checkIn} — المسموح حتى: {addMinutes(settings.workStartTime, settings.lateGracePeriod)}
            </p>
          </div>
        )}

        {/* رابط للسجل */}
        <Link
          to="/history"
          className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all"
        >
          <span className="text-sm font-bold text-foreground">عرض سجل الحضور الكامل</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

function StatusCard({ record }: { record: AttendanceRecord }) {
  const typeLabel = DAY_TYPE_LABELS[record.dayType] || record.dayType;
  const colorMap: Record<string, string> = {
    present: 'success',
    late: 'warning',
    absent: 'destructive',
    holiday: 'muted',
    official_holiday: 'info',
    sick_leave: 'warning',
    annual_leave: 'success',
    unpaid_leave: 'destructive',
  };
  const color = colorMap[record.dayType] || 'muted';

  return (
    <div className={`bg-${color}/10 border border-${color}/20 rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={16} className={`text-${color}`} />
        <span className={`text-sm font-black text-${color}`}>{typeLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {record.checkIn && (
          <div className="bg-card/50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">الدخول</p>
            <p className={`text-base font-black text-${color} font-mono`}>{record.checkIn}</p>
          </div>
        )}
        {record.checkOut && (
          <div className="bg-card/50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">الخروج</p>
            <p className="text-base font-black text-foreground font-mono">{record.checkOut}</p>
          </div>
        )}
      </div>
      {record.overtimeMinutes > 0 && (
        <p className="text-xs text-info font-bold mt-2">⏱️ أوفرتايم: {record.overtimeMinutes} دقيقة</p>
      )}
      {record.note && (
        <p className="text-xs text-muted-foreground mt-2">ملاحظة: {record.note}</p>
      )}
    </div>
  );
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
