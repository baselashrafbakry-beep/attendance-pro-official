import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { Settings, Save, Eye, EyeOff, Calendar, DollarSign, Clock, Shield, Plus, Trash2, Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Download, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import type { AppSettings, OfficialHoliday } from '../types';
import { DAYS_ARABIC, APK_DOWNLOAD_URL } from '../constants';
import { generateId } from '../utils/salary';
import { db } from '../lib/supabase/db';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const { user, settings, saveSettings, officialHolidays, addHoliday, deleteHoliday, isSyncing, syncError, lastSync, syncFromCloud, logout } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);
  const [tab, setTab] = useState<'general' | 'salary' | 'holidays' | 'security'>('general');

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveSettings(form);
    setSaving(false);
    if (ok) toast.success('تم حفظ الإعدادات');
    else toast.error('حدث خطأ في الحفظ');
  };

  const tabs = [
    { id: 'general', label: 'عام', icon: Settings },
    { id: 'salary', label: 'الراتب', icon: DollarSign },
    { id: 'holidays', label: 'الإجازات', icon: Calendar },
    { id: 'security', label: 'الأمان', icon: Shield },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
            <Settings size={20} className="text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">الإعدادات</h1>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* تبويبات */}
      <div className="flex gap-1 p-3 bg-card border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* حالة المزامنة السحابية */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              isSyncing ? "bg-primary/10 animate-pulse" : (syncError ? "bg-destructive/10" : "bg-success/10")
            )}>
              {isSyncing ? <RefreshCw size={20} className="text-primary animate-spin" /> : 
               (syncError ? <CloudOff size={20} className="text-destructive" /> : <Cloud size={20} className="text-success" />)}
            </div>
            <div>
              <p className="text-sm font-black text-foreground">المزامنة السحابية</p>
              <p className="text-[10px] text-muted-foreground">
                {isSyncing ? "جاري المزامنة..." : 
                 (syncError ? "فشل الاتصال بالسحابة" : (lastSync ? `آخر مزامنة: ${new Date(lastSync).toLocaleTimeString('ar-EG')}` : "متصل بالسحابة"))}
              </p>
            </div>
          </div>
          <button 
            onClick={() => syncFromCloud()} 
            disabled={isSyncing}
            className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center hover:bg-muted/80 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={16} className={cn("text-muted-foreground", isSyncing && "animate-spin")} />
          </button>
        </div>

        {/* العام */}
        {tab === 'general' && (
          <div className="space-y-4">
            <SectionCard title="أوقات الدوام">
              <div className="grid grid-cols-2 gap-3">
                <Field label="بداية الدوام">
                  <input type="time" value={form.workStartTime} onChange={e => set('workStartTime', e.target.value)} className={cls} />
                </Field>
                <Field label="نهاية الدوام">
                  <input type="time" value={form.workEndTime} onChange={e => set('workEndTime', e.target.value)} className={cls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="يوم إجازة 1">
                  <select value={form.weeklyOffDay} onChange={e => set('weeklyOffDay', parseInt(e.target.value))} className={cls}>
                    {DAYS_ARABIC.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </Field>
                <Field label="يوم إجازة 2">
                  <select value={form.weeklyOffDay2} onChange={e => set('weeklyOffDay2', parseInt(e.target.value))} className={cls}>
                    <option value={-1}>لا يوجد</option>
                    {DAYS_ARABIC.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="إعدادات الشهر">
              <Field label="يوم بداية شهر الراتب (1-28)">
                <input type="number" min={1} max={28} value={form.monthStartDay}
                  onChange={e => set('monthStartDay', parseInt(e.target.value) || 27)} className={cls} />
              </Field>
              <p className="text-xs text-muted-foreground">الشهر يبدأ في اليوم {form.monthStartDay} من كل شهر</p>
            </SectionCard>
          </div>
        )}

        {/* الراتب */}
        {tab === 'salary' && (
          <div className="space-y-4">
            {user?.role === 'employee' && (
              <SectionCard title="الراتب والمزايا">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الراتب الأساسي (ج.م)">
                    <input type="number" min={0} value={form.baseSalary}
                      onChange={e => set('baseSalary', parseFloat(e.target.value) || 0)} className={cls} />
                  </Field>
                  <Field label="بدل المواصلات (ج.م)">
                    <input type="number" min={0} value={form.transportAllowance}
                      onChange={e => set('transportAllowance', parseFloat(e.target.value) || 0)} className={cls} />
                  </Field>
                </div>
              </SectionCard>
            )}

            <SectionCard title="معاملات الخصم والأوفرتايم">
              <div className="grid grid-cols-2 gap-3">
                <Field label="مضاعف خصم التأخير">
                  <input type="number" min={1} step={0.1} value={form.lateDeductionMultiplier}
                    onChange={e => set('lateDeductionMultiplier', parseFloat(e.target.value) || 1)} className={cls} />
                </Field>
                <Field label="مضاعف خصم الغياب">
                  <input type="number" min={1} step={0.1} value={form.absenceDeductionMultiplier}
                    onChange={e => set('absenceDeductionMultiplier', parseFloat(e.target.value) || 1)} className={cls} />
                </Field>
                <Field label="مضاعف الأوفرتايم">
                  <input type="number" min={1} step={0.1} value={form.overtimeMultiplier}
                    onChange={e => set('overtimeMultiplier', parseFloat(e.target.value) || 1)} className={cls} />
                </Field>
                <Field label="فترة السماح بالتأخر (دقيقة)">
                  <input type="number" min={0} value={form.lateGracePeriod}
                    onChange={e => set('lateGracePeriod', parseInt(e.target.value) || 0)} className={cls} />
                </Field>
                <Field label="حد الأوفرتايم الأدنى (دقيقة)">
                  <input type="number" min={0} value={form.overtimeMinThreshold}
                    onChange={e => set('overtimeMinThreshold', parseInt(e.target.value) || 0)} className={cls} />
                </Field>
                <Field label="تقريب الدقائق إلى">
                  <select value={form.roundMinutesTo} onChange={e => set('roundMinutesTo', parseInt(e.target.value))} className={cls}>
                    {[1, 5, 10, 15, 30, 60].map(v => <option key={v} value={v}>{v} دقيقة</option>)}
                  </select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="التأمين والضريبة">
              <Toggle label="اشتراك التأمينات الاجتماعية" value={form.insuranceEnabled} onChange={v => set('insuranceEnabled', v)} />
              {form.insuranceEnabled && (
                <Field label="نسبة التأمين (%)">
                  <input type="number" min={0} max={100} step={0.1} value={form.insuranceRate}
                    onChange={e => set('insuranceRate', parseFloat(e.target.value) || 0)} className={cls} />
                </Field>
              )}
              <Toggle label="ضريبة الدخل" value={form.taxEnabled} onChange={v => set('taxEnabled', v)} />
              {form.taxEnabled && (
                <Field label="نسبة الضريبة (%)">
                  <input type="number" min={0} max={100} step={0.1} value={form.taxRate}
                    onChange={e => set('taxRate', parseFloat(e.target.value) || 0)} className={cls} />
                </Field>
              )}
            </SectionCard>
          </div>
        )}

        {/* الإجازات الرسمية (مدير فقط) */}
        {tab === 'holidays' && user?.role === 'admin' && (
          <HolidaysTab holidays={officialHolidays} onAdd={addHoliday} onDelete={deleteHoliday} />
        )}
        {tab === 'holidays' && user?.role !== 'admin' && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Calendar size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">إدارة الإجازات الرسمية متاحة للمدير فقط</p>
          </div>
        )}

        {/* الأمان */}
        {tab === 'security' && (
          <div className="space-y-4">
            <SectionCard title="أمان النظام">
              <Toggle label="فرض تحديد الموقع (GPS)" value={form.requireGPS} onChange={v => set('requireGPS', v)} />
              <p className="text-[10px] text-muted-foreground mt-1">يمنع الموظف من تسجيل الحضور إذا لم يتم تحديد موقعه.</p>
              
              <div className="mt-4 pt-4 border-t border-border">
                <Toggle label="كشف التلاعب بالوقت" value={form.checkTimeCheating} onChange={v => set('checkTimeCheating', v)} />
                <p className="text-[10px] text-muted-foreground mt-1">يتحقق من وقت الهاتف الموظف للتأكد من عدم التلاعب بالساعة.</p>
              </div>
            </SectionCard>

            <SectionCard title="تغيير كلمة المرور">
              {showPassForm ? (
                <ChangePasswordForm userId={user?.id || ''} onClose={() => setShowPassForm(false)} />
              ) : (
                <button onClick={() => setShowPassForm(true)}
                  className="w-full py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                  <Shield size={16} /> تغيير كلمة المرور
                </button>
              )}
            </SectionCard>
            <SectionCard title="معلومات الحساب">
              <div className="space-y-2 text-sm">
                <Row label="الدور" value={user?.role === 'admin' ? 'مدير النظام' : 'موظف'} />
                <Row label="اسم المستخدم" value={user?.username || ''} />
                <Row label="القسم" value={user?.department || '—'} />
              </div>
            </SectionCard>
            <Link to="/about" className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all">
              <span className="text-sm font-bold text-foreground">عن التطبيق</span>
              <span className="text-muted-foreground text-sm">←</span>
            </Link>
            <a href={APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" 
               className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-2xl p-4 hover:bg-primary/10 transition-all">
              <div className="flex items-center gap-3">
                <Download size={18} className="text-primary" />
                <span className="text-sm font-bold text-foreground">تحميل تطبيق الأندرويد</span>
              </div>
              <span className="text-primary text-xs font-black">APK</span>
            </a>

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full py-4 mt-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all"
            >
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </div>
        )}

        {/* زر الحفظ */}
        {tab !== 'holidays' && tab !== 'security' && (
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-primary/20 transition-all">
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        )}
      </div>
    </div>
  );
}

function HolidaysTab({ holidays, onAdd, onDelete }: {
  holidays: OfficialHoliday[];
  onAdd: (h: OfficialHoliday) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ name: '', date: '', isPaid: true });
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.date) { toast.error('اسم الإجازة والتاريخ مطلوبان'); return; }
    setLoading(true);
    const ok = await onAdd({ id: generateId(), name: form.name, date: form.date, isPaid: form.isPaid });
    setLoading(false);
    if (ok) { toast.success('تمت الإضافة'); setForm({ name: '', date: '', isPaid: true }); }
    else toast.error('حدث خطأ');
  };

  return (
    <div className="space-y-4">
      <SectionCard title="إضافة إجازة رسمية">
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم الإجازة">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={cls} placeholder="مثال: عيد الفطر" />
          </Field>
          <Field label="التاريخ">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={cls} />
          </Field>
        </div>
        <Toggle label="إجازة مدفوعة" value={form.isPaid} onChange={v => setForm(f => ({ ...f, isPaid: v }))} />
        <button onClick={handleAdd} disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90">
          <Plus size={16} />{loading ? '...' : 'إضافة'}
        </button>
      </SectionCard>

      <div className="space-y-2">
        {holidays.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">لا توجد إجازات رسمية</p>
        ) : (
          holidays
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(h => (
              <div key={h.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3.5">
                <div>
                  <p className="text-sm font-bold text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{h.date} · {h.isPaid ? 'مدفوع' : 'غير مدفوع'}</p>
                </div>
                <button onClick={() => onDelete(h.id).then(ok => ok && toast.success('تم الحذف'))}
                  className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function ChangePasswordForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!current || !newPass || !confirm) { toast.error('جميع الحقول مطلوبة'); return; }
    if (newPass !== confirm) { toast.error('كلمتا المرور غير متطابقتان'); return; }
    if (newPass.length < 4) { toast.error('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); return; }
    setLoading(true);
    const valid = await db.verifyPassword(userId, current);
    if (!valid) { toast.error('كلمة المرور الحالية غير صحيحة'); setLoading(false); return; }
    const ok = await db.changePassword(userId, newPass);
    setLoading(false);
    if (ok) { toast.success('تم تغيير كلمة المرور'); onClose(); }
    else toast.error('حدث خطأ');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">كلمة المرور الحالية</label>
        <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
          className={cn(cls, 'pe-10')} dir="ltr" />
        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute left-3 bottom-3 text-muted-foreground">
          {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div className="relative">
        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">كلمة المرور الجديدة</label>
        <input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
          className={cn(cls, 'pe-10')} dir="ltr" />
        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 bottom-3 text-muted-foreground">
          {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">تأكيد كلمة المرور</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={cls} dir="ltr" />
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-bold text-sm">إلغاء</button>
        <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm">
          {loading ? '...' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}

const cls = 'w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-bold text-muted-foreground mb-1.5 block">{label}</label>{children}</div>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-xs font-black text-foreground uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-12 h-6 rounded-full transition-all',
          value ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', value ? 'right-1' : 'left-1')} />
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}
