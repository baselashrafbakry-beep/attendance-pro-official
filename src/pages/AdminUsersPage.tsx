import { useState, useEffect, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { Users, Plus, Edit3, Trash2, X, Eye, EyeOff, ChevronDown, AlertCircle, RefreshCw, CheckCircle, MapPin, Navigation, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import type { User } from '../types';
import { DEPARTMENT_OPTIONS } from '../constants';
import { formatCurrency } from '../utils/salary';
import { toast } from 'sonner';
import { db } from '../lib/supabase/db';

export default function AdminUsersPage() {
  const { users, addUser, updateUser, deleteUser } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fixingAuth, setFixingAuth] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const employees = users.filter(u => u.role === 'employee');
  const admins = users.filter(u => u.role === 'admin');

  const filteredUsers = search.trim()
    ? users.filter(u =>
        u.name.includes(search) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.department || '').includes(search)
      )
    : users;

  const handleDelete = async (u: User) => {
    if (u.role === 'admin') { toast.error('لا يمكن حذف حساب مدير'); return; }
    if (!confirm(`هل تريد حذف ${u.name}؟ سيتم حذف جميع بياناته.`)) return;
    const ok = await deleteUser(u.id);
    if (ok) toast.success('تم حذف الموظف');
    else toast.error('حدث خطأ أثناء الحذف');
  };

  const handleFixAuth = async (u: User, newPassword: string) => {
    setFixingAuth(u.id);
    try {
      const ok = await db._callCreateAuthUser(u.username, newPassword, u.id);
      if (ok) {
        toast.success(`✅ تم تفعيل حساب تسجيل الدخول لـ ${u.name}!`);
        await updateUser(u.id, { password: newPassword });
      } else {
        toast.error('فشل تفعيل الحساب. تحقق من الاتصال.');
      }
    } catch {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setFixingAuth(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground">إدارة الموظفين</h1>
              <p className="text-xs text-muted-foreground">
              {employees.length} موظف، {admins.length} مدير
              {search.trim() && ` · ${filteredUsers.length} نتيجة`}
            </p>
            </div>
          </div>
          <button
            onClick={() => { setEditUser(null); setShowForm(true); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={14} /> إضافة موظف
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم أو القسم..."
            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm pe-10 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="px-4 py-4 space-y-3">
        {users.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Users size={40} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">لا توجد مستخدمون</p>
          </div>
        ) : (
          filteredUsers
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
                onFixAuth={(newPass) => handleFixAuth(u, newPass)}
                isFixingAuth={fixingAuth === u.id}
                onSetLocation={() => setLocationUserId(u.id)}
              />
            ))
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <UserForm
          user={editUser}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={async (data) => {
            let ok = false;
            try {
              if (editUser) {
                ok = await updateUser(editUser.id, data);
                if (ok) toast.success('تم تحديث بيانات الموظف بنجاح');
                else toast.error('حدث خطأ في التحديث');
              } else {
                ok = await addUser(data as User & { password: string });
                if (ok) toast.success('✅ تم إضافة الموظف وإنشاء حساب تسجيل الدخول بنجاح!');
                else toast.error('فشل إضافة الموظف. تحقق من البيانات المدخلة.');
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
              toast.error(msg);
              return; // لا نغلق النموذج عند الخطأ
            }
            if (ok) {
              setShowForm(false);
              setEditUser(null);
            }
            if (ok) { setShowForm(false); setEditUser(null); }
            else toast.error('حدث خطأ، حاول مرة أخرى');
          }}
        />
      )}

      {/* Location Picker Modal */}
      {locationUserId && (
        <LocationPickerModal
          user={users.find(u => u.id === locationUserId)!}
          onClose={() => setLocationUserId(null)}
          onSave={async (lat, lng, radius, name) => {
            const ok = await updateUser(locationUserId, {
              workLocationLat: lat,
              workLocationLng: lng,
              workLocationRadius: radius,
              workLocationName: name,
            });
            if (ok) toast.success('✅ تم حفظ موقع العمل');
            else toast.error('حدث خطأ في حفظ الموقع');
            setLocationUserId(null);
          }}
        />
      )}
    </div>
  );
}

// ─── بطاقة المستخدم ────────────────────────────────────────────────────────

function UserCard({
  user, expanded, onToggle, onEdit, onDelete, onFixAuth, isFixingAuth, onSetLocation
}: {
  user: User;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFixAuth: (password: string) => void;
  isFixingAuth: boolean;
  onSetLocation: () => void;
}) {
  const isAdmin = user.role === 'admin';
  const hasAuth = !!user.authUserId;
  const hasLocation = !!user.workLocationLat && !!user.workLocationLng;
  const [showFixAuth, setShowFixAuth] = useState(false);
  const [fixPassword, setFixPassword] = useState('');

  return (
    <div className={cn(
      'bg-card border rounded-2xl overflow-hidden transition-all shadow-sm',
      isAdmin ? 'border-primary/30' : 'border-border',
      !hasAuth && 'border-amber-400/40'
    )}>
      <div className="flex items-center gap-3 p-3.5 cursor-pointer active:scale-[0.98] transition-all" onClick={onToggle}>
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0',
          isAdmin ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground'
        )}>
          {user.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-foreground truncate">{user.name}</p>
            {isAdmin && (
              <span className="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-black">مدير</span>
            )}
            {!hasAuth && (
              <span className="text-[9px] px-1.5 py-0.5 bg-amber-400/20 text-amber-600 rounded-full font-black flex items-center gap-1">
                <AlertCircle size={8} /> يحتاج إعداد
              </span>
            )}
            {hasAuth && (
              <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-600 rounded-full font-black flex items-center gap-1">
                <CheckCircle size={8} /> مفعّل
              </span>
            )}
            {hasLocation && (
              <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 text-blue-600 rounded-full font-black flex items-center gap-1">
                <MapPin size={8} /> موقع محدد
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">@{user.username} · {user.department || 'بدون قسم'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
            <Edit3 size={14} />
          </button>
          {!isAdmin && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
              <Trash2 size={14} />
            </button>
          )}
          <ChevronDown size={16} className={cn('text-muted-foreground transition-transform duration-300', expanded && 'rotate-180')} />
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* بيانات الراتب والعمل */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoRow label="الراتب الأساسي" value={formatCurrency(user.baseSalary)} />
            <InfoRow label="بدل المواصلات" value={formatCurrency(user.transportAllowance)} />
            <InfoRow label="بداية الدوام" value={user.workStartTime} />
            <InfoRow label="نهاية الدوام" value={user.workEndTime} />
            <InfoRow label="إجازة سنوية" value={`${user.annualLeaveLimit} يوم`} />
            <InfoRow label="إجازة مرضية" value={`${user.sickLeaveLimit} يوم`} />
          </div>

          {/* زر تحديد موقع العمل (للموظف فقط) */}
          {!isAdmin && (
            <div className={cn(
              'rounded-xl p-3 border',
              hasLocation ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-muted/30 border-border'
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className={hasLocation ? 'text-blue-600' : 'text-muted-foreground'} />
                  <p className="text-xs font-bold text-foreground">موقع العمل الجغرافي</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onSetLocation(); }}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-[11px] font-black hover:bg-blue-600 transition-all flex items-center gap-1"
                >
                  <Target size={11} />
                  {hasLocation ? 'تعديل الموقع' : 'تحديد الموقع'}
                </button>
              </div>
              {hasLocation ? (
                <div className="space-y-1">
                  {user.workLocationName && (
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">{user.workLocationName}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {user.workLocationLat?.toFixed(6)}, {user.workLocationLng?.toFixed(6)}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                    النطاق المسموح به: {user.workLocationRadius ?? 100} متر
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  لم يتم تحديد موقع — الموظف يمكنه تسجيل الحضور من أي مكان
                </p>
              )}
            </div>
          )}

          {/* إصلاح Auth Account */}
          {!hasAuth && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">الحساب يحتاج تفعيل تسجيل الدخول</p>
              </div>
              {!showFixAuth ? (
                <button
                  onClick={e => { e.stopPropagation(); setShowFixAuth(true); }}
                  className="w-full py-2 bg-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-amber-600 transition-all"
                >
                  <RefreshCw size={12} /> تفعيل حساب تسجيل الدخول
                </button>
              ) : (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="password"
                    value={fixPassword}
                    onChange={e => setFixPassword(e.target.value)}
                    placeholder="كلمة المرور الجديدة"
                    className="w-full bg-white dark:bg-muted/50 border border-amber-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowFixAuth(false); setFixPassword(''); }}
                      className="flex-1 py-2 bg-muted text-foreground rounded-xl text-xs font-bold">إلغاء</button>
                    <button
                      disabled={!fixPassword.trim() || isFixingAuth}
                      onClick={() => {
                        if (fixPassword.trim()) {
                          onFixAuth(fixPassword.trim());
                          setShowFixAuth(false);
                          setFixPassword('');
                        }
                      }}
                      className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-xs font-black disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isFixingAuth ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      تفعيل
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── موديل تحديد الموقع الجغرافي ──────────────────────────────────────────

function LocationPickerModal({
  user, onClose, onSave
}: {
  user: User;
  onClose: () => void;
  onSave: (lat: number, lng: number, radius: number, name: string) => Promise<void>;
}) {
  const [lat, setLat] = useState(user.workLocationLat ?? 0);
  const [lng, setLng] = useState(user.workLocationLng ?? 0);
  const [radius, setRadius] = useState(user.workLocationRadius ?? 100);
  const [name, setName] = useState(user.workLocationName ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<unknown>(null);
  const marker = useRef<unknown>(null);
  const circle = useRef<unknown>(null);

  // تحميل Leaflet ديناميكياً
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
      // إضافة CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // تحميل JS
      if (!(window as typeof window & { L?: unknown }).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      setMapLoaded(true);
    };

    loadLeaflet();
  }, []);

  // تهيئة الخريطة بعد تحميل Leaflet
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const L = (window as typeof window & { L: unknown }).L as {
      map: (el: HTMLElement, opts?: unknown) => unknown;
      tileLayer: (url: string, opts?: unknown) => { addTo: (m: unknown) => unknown };
      marker: (latlng: [number, number], opts?: unknown) => {
        addTo: (m: unknown) => { on: (evt: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => unknown };
        setLatLng: (latlng: [number, number]) => void;
        getLatLng: () => { lat: number; lng: number };
      };
      circle: (latlng: [number, number], opts?: unknown) => {
        addTo: (m: unknown) => unknown;
        setLatLng: (latlng: [number, number]) => void;
        setRadius: (r: number) => void;
      };
      latLng: (lat: number, lng: number) => unknown;
    };

    const initLat = lat || 30.0444;
    const initLng = lng || 31.2357;

    const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false }) as {
      setView: (latlng: [number, number], zoom: number) => void;
      on: (evt: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void;
    };
    (map as typeof map).setView([initLat, initLng], lat ? 16 : 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    const m = L.marker([initLat, initLng], { draggable: true }).addTo(map);
    const c = L.circle([initLat, initLng], { radius: radius, color: '#3b82f6', fillOpacity: 0.15 }).addTo(map);

    (m as typeof m).on('dragend', (e) => {
      const pos = e.latlng;
      setLat(pos.lat);
      setLng(pos.lng);
      (c as typeof c).setLatLng([pos.lat, pos.lng]);
    });

    (map as typeof map).on('click', (e) => {
      const pos = e.latlng;
      setLat(pos.lat);
      setLng(pos.lng);
      (m as typeof m).setLatLng([pos.lat, pos.lng]);
      (c as typeof c).setLatLng([pos.lat, pos.lng]);
    });

    leafletMap.current = map;
    marker.current = m;
    circle.current = c;

    return () => {
      (map as { remove: () => void }).remove();
      leafletMap.current = null;
    };
  }, [mapLoaded]);

  // تحديث دائرة النطاق عند تغيير radius
  useEffect(() => {
    if (circle.current) {
      (circle.current as { setRadius: (r: number) => void }).setRadius(radius);
    }
  }, [radius]);

  const handleGetCurrentLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setLat(newLat);
        setLng(newLng);
        if (marker.current) (marker.current as { setLatLng: (l: [number, number]) => void }).setLatLng([newLat, newLng]);
        if (circle.current) (circle.current as { setLatLng: (l: [number, number]) => void }).setLatLng([newLat, newLng]);
        if (leafletMap.current) (leafletMap.current as { setView: (l: [number, number], z: number) => void }).setView([newLat, newLng], 17);
        setLocating(false);
        toast.success('تم تحديد موقعك الحالي');
      },
      () => {
        setLocating(false);
        toast.error('تعذّر تحديد الموقع. تحقق من صلاحيات GPS');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!lat || !lng) { toast.error('يجب تحديد موقع على الخريطة أولاً'); return; }
    if (radius < 10 || radius > 5000) { toast.error('النطاق يجب أن يكون بين 10 و 5000 متر'); return; }
    setSaving(true);
    await onSave(lat, lng, radius, name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground">تحديد موقع عمل الموظف</h2>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center hover:bg-muted/80">
          <X size={18} />
        </button>
      </div>

      {/* الخريطة */}
      <div className="relative flex-1 min-h-0">
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="text-center">
              <RefreshCw size={24} className="text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: '300px' }} />
        {/* تعليمات */}
        <div className="absolute top-3 right-3 z-[1000] bg-card/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 max-w-[200px]">
          <p className="text-[11px] text-muted-foreground font-medium">
            انقر على الخريطة أو اسحب الدبوس لتحديد موقع العمل
          </p>
        </div>
      </div>

      {/* الإعدادات */}
      <div className="bg-card border-t border-border p-4 space-y-4 shrink-0">
        {/* زر الموقع الحالي */}
        <button
          onClick={handleGetCurrentLocation}
          disabled={locating}
          className="w-full py-3 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-all"
        >
          {locating ? <RefreshCw size={16} className="animate-spin" /> : <Navigation size={16} />}
          {locating ? 'جاري التحديد...' : 'استخدام موقعي الحالي'}
        </button>

        {/* اسم الموقع */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">اسم موقع العمل (اختياري)</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: المقر الرئيسي - المعادي"
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* النطاق الجغرافي */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
            نطاق تسجيل الحضور: <span className="text-primary font-black">{radius} متر</span>
          </label>
          <input
            type="range"
            min={25}
            max={1000}
            step={25}
            value={radius}
            onChange={e => setRadius(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>25م (دقيق)</span>
            <span>500م</span>
            <span>1كم (مرن)</span>
          </div>
        </div>

        {/* الإحداثيات */}
        {lat && lng ? (
          <div className="bg-muted/30 rounded-xl px-3 py-2 flex items-center gap-2">
            <MapPin size={12} className="text-blue-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground font-mono">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
        ) : (
          <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2">
            <p className="text-[11px] text-warning font-bold">⚠ لم يتم تحديد موقع بعد</p>
          </div>
        )}

        {/* أزرار */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-muted text-foreground rounded-xl font-bold text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !lat || !lng}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-600 transition-all">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            حفظ الموقع
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-2.5 border border-border/20">
      <p className="text-muted-foreground font-bold mb-0.5 text-[10px]">{label}</p>
      <p className="font-black text-foreground font-mono text-xs">{value}</p>
    </div>
  );
}

// ─── نموذج إضافة/تعديل موظف ─────────────────────────────────────────────────

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
    if (!user && !form.password?.trim()) { toast.error('كلمة المرور مطلوبة للموظف الجديد'); return; }
    if (!user && form.password && form.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end justify-center animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-[2.5rem] w-full max-w-lg flex flex-col max-h-[92dvh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card/80 backdrop-blur-md">
          <h2 className="text-base font-black text-foreground">
            {user ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
          </h2>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32" dir="rtl">
          {!user && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">ℹ️ معلومة</p>
              <p className="text-[11px] text-blue-600 dark:text-blue-500">
                بعد الإضافة، سيتمكن الموظف من تسجيل الدخول باسم المستخدم وكلمة المرور التي تحددها.
              </p>
            </div>
          )}

          <section className="space-y-4">
            <SectionTitle>البيانات الأساسية</SectionTitle>
            <Field label="الاسم الكامل *">
              <input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="الاسم الكامل" />
            </Field>
            {!user && (
              <>
                <Field label="اسم المستخدم *">
                  <input value={form.username || ''} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} className={inputCls} placeholder="مثال: ahmed2026" dir="ltr" />
                </Field>
                <Field label="كلمة المرور *">
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => set('password', e.target.value)} className={cn(inputCls, 'pe-12')} placeholder="6 أحرف على الأقل" dir="ltr" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
              </>
            )}
            {user && (
              <Field label="كلمة المرور الجديدة (فارغة = بدون تغيير)">
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => set('password', e.target.value)} className={cn(inputCls, 'pe-12')} placeholder="اتركها فارغة للإبقاء على الحالية" dir="ltr" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
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

          <section className="space-y-4">
            <SectionTitle>الراتب والمزايا</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="الراتب الأساسي (ج.م)">
                <input type="number" min="0" value={form.baseSalary || 0} onChange={e => set('baseSalary', parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="بدل المواصلات (ج.م)">
                <input type="number" min="0" value={form.transportAllowance || 0} onChange={e => set('transportAllowance', parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle>أوقات العمل</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="بداية الدوام">
                <input type="time" value={form.workStartTime || '09:00'} onChange={e => set('workStartTime', e.target.value)} className={inputCls} />
              </Field>
              <Field label="نهاية الدوام">
                <input type="time" value={form.workEndTime || '17:00'} onChange={e => set('workEndTime', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
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

          <section className="space-y-4">
            <SectionTitle>الإجازات السنوية والمرضية</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="حد الإجازة السنوية (يوم)">
                <input type="number" min="0" value={form.annualLeaveLimit ?? 21} onChange={e => set('annualLeaveLimit', parseInt(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="حد الإجازة المرضية (يوم)">
                <input type="number" min="0" value={form.sickLeaveLimit ?? 15} onChange={e => set('sickLeaveLimit', parseInt(e.target.value) || 0)} className={inputCls} />
              </Field>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border bg-card/95 backdrop-blur-md flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-muted text-foreground rounded-2xl font-bold text-sm active:scale-95 transition-all">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:bg-primary/90 disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-primary/20">
            {loading ? 'جاري الحفظ...' : user ? 'حفظ التعديلات' : 'إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-muted/50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground transition-all';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-black text-muted-foreground mb-2 block uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-primary/10 pb-2.5">{children}</h3>
  );
}
