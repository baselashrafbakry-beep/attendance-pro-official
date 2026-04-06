import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { Clock, Calendar, DollarSign, FileText, TrendingUp, TrendingDown, AlertCircle, CheckCircle, LogOut, RefreshCw, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateSalary, getCurrentPayrollPeriod, formatCurrency, todayStr } from '../utils/salary';
import { DAY_TYPE_LABELS } from '../constants';

export default function Dashboard() {
  const { user, attendance, settings, leaveRequests, officialHolidays, syncFromCloud, isSyncing, logout } = useApp();
  const [_, setRefresh] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefresh(r => r + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const today = todayStr();
  const todayRecord = attendance.find(r => r.userId === user?.id && r.date === today);

  const period = getCurrentPayrollPeriod(settings.monthStartDay);
  const holidayDates = officialHolidays.map(h => h.date);

  const salaryBreakdown = useMemo(() => {
    if (!user) return null;
    const myAttendance = attendance.filter(r => r.userId === user.id);
    return calculateSalary(myAttendance, settings, period.start, period.end, holidayDates);
  }, [user, attendance, settings, period.start, period.end, holidayDates]);

  const pendingLeaves = leaveRequests.filter(l => l.userId === user?.id && l.status === 'pending').length;
  const approvedLeaves = leaveRequests.filter(l => l.userId === user?.id && l.status === 'approved').length;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 pt-12 pb-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{greeting}،</p>
            <h1 className="text-xl font-black text-foreground">{user?.name}</h1>
            <p className="text-xs text-muted-foreground">{user?.department}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncFromCloud}
              disabled={isSyncing}
              className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
            >
              <RefreshCw size={16} className={cn(isSyncing && 'animate-spin')} />
            </button>
            <button
              onClick={logout}
              className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* حالة اليوم */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-foreground">حالة اليوم</h2>
            <span className="text-xs text-muted-foreground font-mono">{today}</span>
          </div>
          
          {todayRecord ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-success" />
                <span className="text-sm font-bold text-success">{DAY_TYPE_LABELS[todayRecord.dayType]}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {todayRecord.checkIn && (
                  <div className="bg-success/10 border border-success/20 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium">تسجيل الدخول</p>
                    <p className="text-sm font-black text-success font-mono">{todayRecord.checkIn}</p>
                  </div>
                )}
                {todayRecord.checkOut && (
                  <div className="bg-info/10 border border-info/20 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium">تسجيل الخروج</p>
                    <p className="text-sm font-black text-info font-mono">{todayRecord.checkOut}</p>
                  </div>
                )}
              </div>
              {todayRecord.lateMinutes > 0 && (
                <div className="flex items-center gap-2 bg-warning/10 rounded-xl p-2.5">
                  <AlertCircle size={14} className="text-warning" />
                  <span className="text-xs text-warning font-bold">تأخير: {todayRecord.lateMinutes} دقيقة</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-3">
              <AlertCircle size={32} className="text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">لم يتم تسجيل حضور اليوم</p>
              <Link
                to="/attendance"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold"
              >
                تسجيل الحضور
              </Link>
            </div>
          )}
        </div>

        {/* ملخص الراتب */}
        {salaryBreakdown && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-foreground">راتب {period.label}</h2>
              <DollarSign size={16} className="text-primary" />
            </div>
            <div className="text-3xl font-black text-primary mb-1 font-mono">
              {formatCurrency(salaryBreakdown.netSalary)}
            </div>
            <p className="text-xs text-muted-foreground mb-3">الراتب الصافي المتوقع</p>
            
            <div className="grid grid-cols-3 gap-2">
              <StatMini label="أيام الحضور" value={`${salaryBreakdown.presentDays}`} color="success" />
              <StatMini label="أيام الغياب" value={`${salaryBreakdown.absentDays}`} color="destructive" />
              <StatMini label="ساعات أوفرتايم" value={`${salaryBreakdown.overtimeHours}h`} color="info" />
            </div>

            {salaryBreakdown.lateDeduction > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingDown size={12} className="text-destructive" /> خصم التأخير
                </span>
                <span className="text-xs font-bold text-destructive">
                  - {formatCurrency(salaryBreakdown.lateDeduction)}
                </span>
              </div>
            )}
            {salaryBreakdown.overtimePay > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingUp size={12} className="text-success" /> مكافأة أوفرتايم
                </span>
                <span className="text-xs font-bold text-success">
                  + {formatCurrency(salaryBreakdown.overtimePay)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* روابط سريعة */}
        <div className="grid grid-cols-2 gap-3">
          <QuickLink to="/attendance" icon={Clock} label="تسجيل الحضور" color="primary" />
          <QuickLink to="/salary" icon={DollarSign} label="تفاصيل الراتب" color="success" />
          <QuickLink to="/history" icon={Calendar} label="سجل الحضور" color="info" />
          <QuickLink to="/leaves" label="طلبات الإجازة" icon={FileText} color="warning" badge={pendingLeaves > 0 ? pendingLeaves : undefined} />
        </div>

        {/* إجازات */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-black text-foreground mb-3">رصيد الإجازات</h2>
          <div className="grid grid-cols-2 gap-2">
            <LeaveBalance
              label="إجازة سنوية"
              used={salaryBreakdown?.annualLeaveDays ?? 0}
              total={user?.annualLeaveLimit ?? 21}
              color="success"
            />
            <LeaveBalance
              label="إجازة مرضية"
              used={salaryBreakdown?.sickLeaveDays ?? 0}
              total={user?.sickLeaveLimit ?? 15}
              color="warning"
            />
          </div>
          {pendingLeaves > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl p-2.5">
              <AlertCircle size={14} className="text-warning" />
              <span className="text-xs text-warning font-bold">{pendingLeaves} طلب إجازة قيد المراجعة</span>
            </div>
          )}
          {approvedLeaves > 0 && (
            <div className="mt-2 flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl p-2.5">
              <CheckCircle size={14} className="text-success" />
              <span className="text-xs text-success font-bold">{approvedLeaves} إجازة موافق عليها</span>
            </div>
          )}
        </div>

        {/* معلومات المستخدم */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/50 rounded-xl p-2.5">
              <p className="text-muted-foreground font-medium">القسم</p>
              <p className="font-bold text-foreground">{user?.department || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-2.5">
              <p className="text-muted-foreground font-medium">الراتب الأساسي</p>
              <p className="font-bold text-foreground font-mono">{formatCurrency(settings.baseSalary)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`bg-${color}/10 border border-${color}/20 rounded-xl p-2 text-center`}>
      <p className={`text-sm font-black text-${color} font-mono`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-medium mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, color, badge }: {
  to: string; icon: React.ElementType; label: string; color: string; badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`relative bg-${color}/10 border border-${color}/20 rounded-2xl p-4 flex flex-col gap-2 hover:bg-${color}/15 active:scale-[0.97] transition-all`}
    >
      {badge !== undefined && (
        <div className="absolute top-2 left-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
          <span className="text-[9px] font-black text-white">{badge}</span>
        </div>
      )}
      <Icon size={22} className={`text-${color}`} />
      <span className={`text-xs font-black text-${color}`}>{label}</span>
    </Link>
  );
}

function LeaveBalance({ label, used, total, color }: {
  label: string; used: number; total: number; color: string;
}) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="bg-muted/30 border border-border rounded-xl p-3">
      <p className="text-[10px] text-muted-foreground font-bold mb-1">{label}</p>
      <p className={`text-lg font-black text-${color} font-mono`}>{remaining}<span className="text-xs text-muted-foreground font-normal">/{total}</span></p>
      <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full bg-${color}/60 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-muted-foreground mt-1">{used} مستخدم</p>
    </div>
  );
}
