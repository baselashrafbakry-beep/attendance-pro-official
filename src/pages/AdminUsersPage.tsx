import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { Users, Plus, Edit3, Trash2, X, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { User } from '../types';
import { DEPARTMENT_OPTIONS } from '../constants';
import { formatCurrency } from '../utils/salary';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const { users, addUser, updateUser, deleteUser } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const employees = users.filter(u => u.role === 'employee');
  const admins = users.filter(u => u.role === 'admin');

  const handleDelete = async (u: User) => {
    if (u.role === 'admin') { toast.error('لا يمكن حذف حساب مدير'); return; }
    if (!confirm(`هل تريد حذف ${u.name}؟ سيتم حذف جميع بياناته.`)) return;
    const ok = await deleteUser(u.id);
    if (ok) toast.success('تم حذف الموظف'); else toast.error('حدث خطأ');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground">إدارة الموظفين</h1>
              <p className="text-xs text-muted-foreground">{employees.length} موظف، {admins.length} مدير</p>
            </div>
          </div>
          <button
            onClick={() => { setEditUser(null); setShowForm(true); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-primary/90 transition-all"
          >
            <Plus size={14} /> إضافة
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {users.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Users size={40} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">لا توجد مستخدمون</p>
          </div>
        ) : (
          users
            .sort((a, b) => {
              if (a.role === 'admin' && b.role !== 'admin') return -1;
              if (a.role !== 'admin' && b.role === 'admin') return 1;
              return a.name.localeCompare(b.name);
            })
            .map(u => (
              <UserCard
                key={u.id}
                user={u}
                expanded={expandedId === u.id}
                onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
                onEdit={() => { setEditUser(u); setShowForm(true); }}
                onDelete={() => handleDelete(u)}
              />
            ))
        )}
      </div>

      {showForm && (
        <UserForm
          user={editUser}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={async (data) => {
            let ok = false;
            if (editUser) {
              ok = await updateUser(editUser.id, data);
              if (ok) toast.success('تم تحديث بيانات الموظف');
            } else {
              ok = await addUser(data as User & { password: string });
              if (ok) toast.success('تم إضافة الموظف بنجاح');
            }
            if (ok) { setShowForm(false); setEditUser(null); }
            else toast.error('حدث خطأ، حاول مرة أخرى');
          }}
        />
      )}
    </div>
  );
}

function UserCard({ user, expanded, onToggle, onEdit, onDelete }: {
  user: User; expanded: boolean; onToggle: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const isAdmin = user.role === 'admin';
  return (
    <div className={cn('bg-card border rounded-2xl overflow-hidden transition-all', isAdmin ? 'border-primary/30' : 'border-border')}>
      <div
        className="flex items-center gap-3 p-3.5 cursor-pointer"
        onClick={onToggle}
      >
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0', isAdmin ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground')}>
          {user.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-foreground truncate">{user.name}</p>
            {isAdmin && <span className="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-black">مدير</span>}
          </div>
          <p className="text-xs text-muted-foreground">@{user.username} · {user.department || 'بدون قسم'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
            <Edit3 size={12} />
          </button>
          {!isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
              <Trash2 size={12} />
            </button>
          )}
          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </div>
      
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3 grid grid-cols-2 gap-2 text-xs">
          <InfoRow label="الراتب الأساسي" value={formatCurrency(user.baseSalary)} />
          <InfoRow label="بدل المواصلات" value={formatCurrency(user.transportAllowance)} />
          <InfoRow label="بداية الدوام" value={user.workStartTime} />
          <InfoRow label="نهاية الدوام" value={user.workEndTime} />
          <InfoRow label="إجازة سنوية" value={`${user.annualLeaveLimit} يوم`} />
          <InfoRow label="إجازة مرضية" value={`${user.sickLeaveLimit} يوم`} />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-2">
      <p className="text-muted-foreground font-medium">{label}</p>
      <p className="font-black text-foreground font-mono">{value}</p>
    </div>
  );
}

type UserFormData = Partial<User> & { password?: string };

function UserForm({ user, onClose, onSave }: {
  user: User | null;
  onClose: () => void;
  onSave: (data: UserFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<UserFormData>({
    name: user?.name || '',
    username: user?.username || '',
    password: '',
    role: user?.role || 'employee',
    department: user?.department || '',
    baseSalary: user?.baseSalary || 0,
    transportAllowance: user?.transportAllowance || 0,
    workStartTime: user?.workStartTime || '09:00',
    workEndTime: user?.workEndTime || '17:00',
    weeklyOffDay: user?.weeklyOffDay ?? 5,
    weeklyOffDay2: user?.weeklyOffDay2 ?? 6,
    annualLeaveLimit: user?.annualLeaveLimit ?? 21,
    sickLeaveLimit: user?.sickLeaveLimit ?? 15,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof UserFormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('اسم الموظف مطلوب'); return; }
    if (!user && !form.username?.trim()) { toast.error('اسم المستخدم مطلوب'); return; }
    if (!user && !form.password?.trim()) { toast.error('كلمة المرور مطلوبة'); return; }
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">{user ? 'تعديل الموظف' : 'إضافة موظف جديد'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center"><X size={16} /></button>
        </div>

        <section className="space-y-3">
          <SectionTitle>البيانات الأساسية</SectionTitle>
          <Field label="الاسم الكامل *" required>
            <input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="الاسم الكامل" />
          </Field>
          {!user && (
            <>
              <Field label="اسم المستخدم *" required>
                <input value={form.username || ''} onChange={e => set('username', e.target.value)} className={inputCls} placeholder="username" dir="ltr" />
              </Field>
              <Field label="كلمة المرور *">
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => set('password', e.target.value)} className={cn(inputCls, 'pe-10')} placeholder="كلمة المرور" dir="ltr" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
            </>
          )}
          {user && (
            <Field label="كلمة المرور الجديدة (اتركها فارغة لعدم التغيير)">
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => set('password', e.target.value)} className={cn(inputCls, 'pe-10')} placeholder="اترك فارغاً للإبقاء" dir="ltr" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}
          <Field label="الدور">
            <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
              <option value="employee">موظف</option>
              <option value="admin">مدير</option>
            </select>
          </Field>
          <Field label="القسم">
            <select value={form.department || ''} onChange={e => set('department', e.target.value)} className={inputCls}>
              <option value="">— اختر القسم —</option>
              {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </section>

        <section className="space-y-3">
          <SectionTitle>الراتب والمزايا</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الراتب الأساسي">
              <input type="number" min="0" value={form.baseSalary || 0} onChange={e => set('baseSalary', parseFloat(e.target.value) || 0)} className={inputCls} />
            </Field>
            <Field label="بدل المواصلات">
              <input type="number" min="0" value={form.transportAllowance || 0} onChange={e => set('transportAllowance', parseFloat(e.target.value) || 0)} className={inputCls} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>أوقات العمل</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="بداية الدوام">
              <input type="time" value={form.workStartTime || '09:00'} onChange={e => set('workStartTime', e.target.value)} className={inputCls} />
            </Field>
            <Field label="نهاية الدوام">
              <input type="time" value={form.workEndTime || '17:00'} onChange={e => set('workEndTime', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="يوم إجازة 1">
              <select value={form.weeklyOffDay ?? 5} onChange={e => set('weeklyOffDay', parseInt(e.target.value))} className={inputCls}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Field>
            <Field label="يوم إجازة 2">
              <select value={form.weeklyOffDay2 ?? 6} onChange={e => set('weeklyOffDay2', parseInt(e.target.value))} className={inputCls}>
                <option value={-1}>لا يوجد</option>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>الإجازات</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الإجازة السنوية (يوم)">
              <input type="number" min="0" value={form.annualLeaveLimit ?? 21} onChange={e => set('annualLeaveLimit', parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
            <Field label="الإجازة المرضية (يوم)">
              <input type="number" min="0" value={form.sickLeaveLimit ?? 15} onChange={e => set('sickLeaveLimit', parseInt(e.target.value) || 0)} className={inputCls} />
            </Field>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-black text-sm hover:bg-primary/90 disabled:opacity-60">
            {loading ? 'جاري الحفظ...' : user ? 'حفظ التعديلات' : 'إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
        {label}{required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest border-b border-border pb-2">{children}</h3>;
}
