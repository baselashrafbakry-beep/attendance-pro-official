import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { Eye, EyeOff, LogIn, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_NAME, APP_VERSION, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS } from '../constants';
import { toast } from 'sonner';

const LS_KEY_ATTEMPTS = 'ast_login_attempts';
const LS_KEY_LOCKOUT = 'ast_lockout_until';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    // استعادة حالة القفل
    const savedAttempts = parseInt(localStorage.getItem(LS_KEY_ATTEMPTS) || '0', 10);
    const savedLockout = parseInt(localStorage.getItem(LS_KEY_LOCKOUT) || '0', 10);
    setAttempts(savedAttempts);
    if (savedLockout > Date.now()) {
      setLockedUntil(savedLockout);
    }
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        localStorage.removeItem(LS_KEY_ATTEMPTS);
        localStorage.removeItem(LS_KEY_LOCKOUT);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && lockedUntil > Date.now()) {
      setError(`الحساب مقفل. أعد المحاولة بعد ${timeLeft} ثانية.`);
      return;
    }
    if (!username.trim() || !password.trim()) {
      setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      localStorage.removeItem(LS_KEY_ATTEMPTS);
      localStorage.removeItem(LS_KEY_LOCKOUT);
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/', { replace: true });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem(LS_KEY_ATTEMPTS, String(newAttempts));

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockout = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(lockout);
        localStorage.setItem(LS_KEY_LOCKOUT, String(lockout));
        setError(`تم قفل الحساب بسبب المحاولات المتعددة. أعد المحاولة بعد 15 دقيقة.`);
      } else {
        setError(result.error || 'بيانات الدخول غير صحيحة');
      }
    }
  };

  const isLocked = lockedUntil !== null && lockedUntil > Date.now();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      {/* خلفية ديكورية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* الشعار */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/10">
            <Shield size={36} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">{APP_NAME}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{APP_VERSION}</p>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl shadow-black/10">
          <h2 className="text-lg font-bold text-foreground mb-5">تسجيل الدخول</h2>

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={cn(
                  'w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all',
                  'placeholder:text-muted-foreground/50'
                )}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                disabled={loading || isLocked}
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={cn(
                    'w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all',
                    'placeholder:text-muted-foreground/50 pe-12'
                  )}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  disabled={loading || isLocked}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {attempts > 0 && !isLocked && (
              <p className="text-xs text-warning font-medium">
                تحذير: {attempts}/{MAX_LOGIN_ATTEMPTS} محاولات. سيتم قفل الحساب عند الوصول للحد.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className={cn(
                'w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2',
                'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]',
                'shadow-lg shadow-primary/20',
                (loading || isLocked) && 'opacity-60 cursor-not-allowed'
              )}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> جاري التحقق...</>
              ) : (
                <><LogIn size={16} /> دخول</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          نظام إدارة الحضور والرواتب — مؤمّن ومشفّر
        </p>
      </div>
    </div>
  );
}
