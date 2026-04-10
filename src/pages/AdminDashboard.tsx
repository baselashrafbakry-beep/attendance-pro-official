import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { Users, Clock, DollarSign, FileText, TrendingUp, AlertCircle, LogOut, RefreshCw, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateSalary, getCurrentPayrollPeriod, formatCurrency } from '../utils/salary';
import { db } from '../lib/supabase/db';
import type { AppSettings } from '../types';
import { DEVELOPER_NAME, DEVELOPER_PHONE } from '../constants';

export default function AdminDashboard() {
  const { user, users, attendance, leaveRequests, officialHolidays, settings, isSyncing, syncFromCloud, logout } = useApp();

  const period = getCurrentPayrollPeriod(settings.monthStartDay);
  const holidayDates = officialHolidays.map(h => h.date);
  const today = new Date().toISOString().slice(0, 10);

  const employees = useMemo(() => users.filter(u => u.role === 'employee'), [users]);
  const employeeIdsKey = useMemo(() => employees.map(e => e.id).sort().join(','), [employees]);
  const [employeeSettings, setEmployeeSettings] = useState<Record<string, AppSettings>>({});

  useEffect(() => {
    let cancelled = false;
    const loadEmployeeSettings = async () => {
      if (employees.length === 0) {
        if (!cancelled) setEmployeeSettings({});
        return;
      }
      const pairs = await Promise.all(
        employees.map(async (emp) => [emp.id, await db.getSettings(emp.id)] as const)
      );
      if (!cancelled) {
        setEmployeeSettings(Object.fromEntries(pairs));
      }
    };
    loadEmployeeSettings();
    return () => {
      cancelled = true;
    };
  }, [employeeIdsKey, employees]);

  // إحصائيات اليوم
  const todayStats = useMemo(() => {
    const total = employees.length;
    const todayRecords = attendance.filter(r => r.date === today);
    const present = todayRecords.filter(r => ['present', 'late'].includes(r.dayType)).length;
    const late = todayRecords.filter(r => r.dayType === 'late').length;
    const absent = todayRecords.filter(r => r.dayType === 'absent').length;
    const notRecorded = total - todayRecords.filter(r =>
      ['present', 'late', 'absent', 'sick_leave', 'annual_leave', 'unpaid_leave', 'official_holiday'].includes(r.dayType)
    ).length;
    return { total, present, late, absent, notRecorded };
  }, [employees, attendance, today]);

  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending').length;

  // إجمالي الرواتب للشهر
  const totalSalaries = useMemo(() => {
    return employees.reduce((sum, emp) => {
      const empAttendance = attendance.filter(r => r.userId === emp.id);
      const empStoredSettings = employeeSettings[emp.id];
      const empSettings = {
        ...settings, // fallback
        ...empStoredSettings,
        baseSalary: emp.baseSalary,
        transportAllowance: emp.transportAllowance,
        workStartTime: emp.workStartTime,
        workEndTime: emp.workEndTime,
        weeklyOffDay: emp.weeklyOffDay,
        weeklyOffDay2: emp.weeklyOffDay2 ?? -1,
      };
      const breakdown = calculateSalary(empAttendance, empSettings, period.start, period.end, holidayDates);
      return sum + breakdown.netSalary;
    }, 0);
  }, [employees, attendance, employeeSettings, settings, period.start, period.end, holidayDates]);

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 pt-12 pb-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-primary font-bold uppercase tracking-widest">لوحة التحكم</p>
            <h1 className="text-xl font-black text-foreground">{user?.name}</h1>
            <p className="text-xs text-muted-foreground">مسؤول النظام</p>
          </div>
          <div className="flex gap-2">
            <button onClick={syncFromCloud} disabled={isSyncing}
              className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
              <RefreshCw size={16} className={cn(isSyncing && 'animate-spin')} />
            </button>
            <button onClick={logout}
              className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-all">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* إحصائيات اليوم */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-foreground">إحصائيات اليوم</h2>
            <span className="text-xs text-muted-foreground font-mono">{today}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="الكل" value={todayStats.total} color="primary" />
            <StatBox label="حاضر" value={todayStats.present} color="success" />
            <StatBox label="متأخر" value={todayStats.late} color="warning" />
            <StatBox label="غائب" value={todayStats.absent} color="destructive" />
          </div>
          {todayStats.notRecorded > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl p-2.5">
              <AlertCircle size={14} className="text-warning" />
              <span className="text-xs text-warning font-bold">{todayStats.notRecorded} موظف لم يسجل حضوره بعد</span>
            </div>
          )}
        </div>

        {/* الرواتب الشهرية */}
        <div className="bg-gradient-to-br from-success/10 to-success/5 border border-success/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الرواتب — {period.label}</p>
              <p className="text-3xl font-black text-success font-mono mt-1">{formatCurrency(totalSalaries)}</p>
              <p className="text-xs text-muted-foreground mt-1">{employees.length} موظف</p>
            </div>
            <div className="w-14 h-14 bg-success/15 rounded-2xl flex items-center justify-center">
              <DollarSign size={28} className="text-success" />
            </div>
          </div>
        </div>

        {/* إشعارات */}
        {pendingLeaves > 0 && (
          <Link
            to="/admin/leaves"
            className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-2xl p-4 hover:bg-warning/15 transition-all"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-warning" />
              <div>
                <p className="text-sm font-black text-warning">{pendingLeaves} طلب إجازة قيد المراجعة</p>
                <p className="text-xs text-muted-foreground">اضغط للمراجعة والرد</p>
              </div>
            </div>
            <span className="text-warning text-sm">←</span>
          </Link>
        )}

        {/* روابط سريعة */}
        <div className="grid grid-cols-2 gap-3">
          <AdminQuickLink to="/admin/users" icon={Users} label="إدارة الموظفين" sub={`${employees.length} موظف`} color="primary" />
          <AdminQuickLink to="/admin/attendance" icon={Clock} label="سجل الحضور" sub="كل الموظفين" color="info" />
          <AdminQuickLink to="/admin/salary" icon={DollarSign} label="كشف الرواتب" sub={period.label} color="success" />
          <AdminQuickLink to="/admin/leaves" icon={FileText} label="طلبات الإجازة" sub={pendingLeaves > 0 ? `${pendingLeaves} جديد` : 'مراجعة وموافقة'} color="warning" badge={pendingLeaves} />
        </div>

        {/* حضور سريع */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <Calendar size={14} /> حضور اليوم
            </h2>
            <Link to="/admin/attendance" className="text-xs text-primary font-bold">عرض الكل</Link>
          </div>
          <div className="divide-y divide-border">
            {employees.slice(0, 5).map(emp => {
              const rec = attendance.find(r => r.userId === emp.id && r.date === today);
              return (
                <div key={emp.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-foreground">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">{emp.department}</p>
                  </div>
                  {rec ? (
                    <span className={cn(
                      'text-[10px] font-bold px-2.5 py-1 rounded-full',
                      rec.dayType === 'present' ? 'bg-success/10 text-success' :
                      rec.dayType === 'late' ? 'bg-warning/10 text-warning' :
                      rec.dayType === 'absent' ? 'bg-destructive/10 text-destructive' :
                      'bg-info/10 text-info'
                    )}>
                      {rec.dayType === 'present' ? `حاضر ${rec.checkIn || ''}` :
                       rec.dayType === 'late' ? `متأخر ${rec.checkIn || ''}` :
                       rec.dayType === 'absent' ? 'غائب' :
                       rec.checkIn ? rec.checkIn : rec.dayType}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50 bg-muted/30 px-2.5 py-1 rounded-full">لم يسجل</span>
                  )}
                </div>
              );
            })}
            {employees.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link to="/admin/attendance" className="text-xs text-primary font-bold">
                  + {employees.length - 5} موظفين آخرين
                </Link>
              </div>
            )}
          </div>
        </div>

        <Link to="/about" className="block bg-primary/5 border border-primary/15 rounded-2xl p-4 hover:bg-primary/10 transition-all">
          <p className="text-xs text-muted-foreground font-bold mb-1">عن التطبيق / المطور</p>
          <p className="text-sm font-black text-foreground">{DEVELOPER_NAME}</p>
          <p className="text-xs text-primary font-bold" dir="ltr">{DEVELOPER_PHONE}</p>
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`bg-${color}/10 border border-${color}/20 rounded-xl p-2.5 text-center`}>
      <p className={`text-2xl font-black text-${color} font-mono`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function AdminQuickLink({ to, icon: Icon, label, sub, color, badge }: {
  to: string; icon: React.ElementType; label: string; sub: string; color: string; badge?: number;
}) {
  return (
    <Link to={to} className={`relative bg-${color}/10 border border-${color}/20 rounded-2xl p-4 flex flex-col gap-2 hover:bg-${color}/15 active:scale-[0.97] transition-all`}>
      {badge && badge > 0 && (
        <div className="absolute top-2 left-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
          <span className="text-[9px] font-black text-white">{badge}</span>
        </div>
      )}
      <Icon size={22} className={`text-${color}`} />
      <div>
        <p className={`text-xs font-black text-${color}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </Link>
  );
}
