// ============================================================
// App Store — Zustand State Management
// ============================================================
import { create } from 'zustand';
import type { User, AttendanceRecord, AppSettings, LeaveRequest, OfficialHoliday, SalaryComparison } from '../types';
import { db } from '../lib/supabase/db';
import { DEFAULT_SETTINGS, LOCKOUT_DURATION_MS, MAX_LOGIN_ATTEMPTS, STORAGE_KEYS } from '../constants';
import { isSupabaseConfigured, supabase } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRealtimeSync(syncFromCloud: () => Promise<void>): void {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncFromCloud().catch(() => {
      // ignore realtime-triggered sync errors; sync bar already surfaces issues
    });
  }, 350);
}

interface AppState {
  // Auth
  user: User | null;
  isInitialized: boolean;
  
  // Sync
  isSyncing: boolean;
  syncError: string | null;
  lastSync: Date | null;
  
  // Data
  users: User[];
  attendance: AttendanceRecord[];
  settings: AppSettings;
  leaveRequests: LeaveRequest[];
  officialHolidays: OfficialHoliday[];
  salaryComparisons: SalaryComparison[];
  
  // Actions
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  syncFromCloud: () => Promise<void>;
  startRealtime: () => void;
  stopRealtime: () => void;
  
  // Users
  loadUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'id'> & { password: string }) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<User & { password?: string }>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  
  // Settings
  loadSettings: (userId: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  
  // Attendance
  loadAttendance: (userId?: string) => Promise<void>;
  upsertAttendance: (record: AttendanceRecord) => Promise<AttendanceRecord | null>;
  deleteAttendance: (id: string) => Promise<boolean>;
  bulkUpsertAttendance: (records: AttendanceRecord[]) => Promise<boolean>;
  
  // Leave Requests
  loadLeaveRequests: (userId?: string) => Promise<void>;
  createLeaveRequest: (req: LeaveRequest) => Promise<boolean>;
  updateLeaveStatus: (id: string, status: 'approved' | 'rejected', adminId: string, notes?: string) => Promise<boolean>;
  deleteLeaveRequest: (id: string) => Promise<boolean>;
  
  // Holidays
  loadHolidays: () => Promise<void>;
  addHoliday: (holiday: OfficialHoliday) => Promise<boolean>;
  deleteHoliday: (id: string) => Promise<boolean>;
  
  // Salary Comparisons
  loadSalaryComparisons: (userId?: string) => Promise<void>;
  addSalaryComparison: (comp: SalaryComparison) => Promise<boolean>;
  deleteSalaryComparison: (id: string) => Promise<boolean>;
}

const ls = {
  get: <T>(key: string): T | null => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  set: (key: string, val: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore storage errors */ }
  },
  remove: (key: string) => { try { localStorage.removeItem(key); } catch { /* ignore storage errors */ } },
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isInitialized: false,
  isSyncing: false,
  syncError: null,
  lastSync: null,
  users: [],
  attendance: [],
  settings: { ...DEFAULT_SETTINGS },
  leaveRequests: [],
  officialHolidays: [],
  salaryComparisons: [],

  initialize: async () => {
    try {
      const sessionUser = await db.getCurrentUserFromSession();
      if (sessionUser) {
        ls.set(STORAGE_KEYS.CURRENT_USER, sessionUser);
        set({ user: sessionUser });
        get().startRealtime();
        get().syncFromCloud();
        return;
      }
      const savedUser = ls.get<User>(STORAGE_KEYS.CURRENT_USER);
      if (savedUser) {
        set({ user: savedUser });
        get().startRealtime();
        get().syncFromCloud();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تهيئة التطبيق';
      set({ syncError: msg });
    } finally {
      set({ isInitialized: true });
    }
  },

  login: async (username: string, password: string) => {
    set({ isSyncing: true, syncError: null });
    try {
      const allowed = await db.canAttemptLogin(username, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      if (!allowed) {
        set({ isSyncing: false });
        return { success: false, error: 'تم قفل الحساب مؤقتًا. حاول لاحقًا.' };
      }
      const user = await db.loginWithUsername(username, password);
      if (!user) {
        await db.logLoginAttempt(username, false);
        set({ isSyncing: false });
        return { success: false, error: 'بيانات الدخول غير صحيحة' };
      }

      await db.logLoginAttempt(username, true);
      ls.set(STORAGE_KEYS.CURRENT_USER, user);
      set({ user, isSyncing: false });
      get().startRealtime();
      
      // تحميل البيانات
      const { syncFromCloud } = get();
      syncFromCloud();
      
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ في الاتصال';
      set({ isSyncing: false, syncError: msg });
      return { success: false, error: msg };
    }
  },

  logout: () => {
    get().stopRealtime();
    db.logoutSession().catch(() => {
      // best effort signout
    });
    ls.remove(STORAGE_KEYS.CURRENT_USER);
    // مسح جميع البيانات المرتبطة بالمستخدم من الذاكرة
    set({
      user: null,
      users: [],
      attendance: [],
      settings: { ...DEFAULT_SETTINGS },
      leaveRequests: [],
      officialHolidays: [],
      salaryComparisons: [],
      syncError: null,
      lastSync: null,
    });
  },

  syncFromCloud: async () => {
    const { user } = get();
    set({ isSyncing: true, syncError: null });
    try {
      const sessionUser = await db.getCurrentUserFromSession();
      if (sessionUser && (!user || user.id !== sessionUser.id || user.role !== sessionUser.role || user.name !== sessionUser.name)) {
        ls.set(STORAGE_KEYS.CURRENT_USER, sessionUser);
        set({ user: sessionUser });
      }

      const promises: Promise<void>[] = [
        get().loadHolidays(),
      ];
      
      if (user) {
        promises.push(get().loadSettings(user.id));
        if (user.role === 'admin') {
          promises.push(get().loadUsers());
          promises.push(get().loadAttendance());
          promises.push(get().loadLeaveRequests());
          promises.push(get().loadSalaryComparisons());
        } else {
          promises.push(get().loadAttendance(user.id));
          promises.push(get().loadLeaveRequests(user.id));
          promises.push(get().loadSalaryComparisons(user.id));
        }
      }
      
      const results = await Promise.allSettled(promises);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length > 0) {
        const details = failed.map(f => {
          if (f.reason instanceof Error) return f.reason.message;
          return String(f.reason);
        }).slice(0, 2).join(' | ');
        set({ isSyncing: false, syncError: `فشل جزئي في المزامنة (${failed.length}). ${details}` });
        return;
      }
      set({ isSyncing: false, lastSync: new Date(), syncError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ في المزامنة';
      set({ isSyncing: false, syncError: msg });
    }
  },

  startRealtime: () => {
    if (!isSupabaseConfigured()) return;
    if (realtimeChannel) return;

    const onDataChanged = () => {
      scheduleRealtimeSync(get().syncFromCloud);
    };

    realtimeChannel = supabase
      .channel('attendance-pro-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, onDataChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, onDataChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_comparisons' }, onDataChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'official_holidays' }, onDataChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, onDataChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, onDataChanged)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onDataChanged();
        }
      });
  },

  stopRealtime: () => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
    }
    if (!realtimeChannel) return;
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  },

  // ── Users ──
  loadUsers: async () => {
    const users = await db.getUsers();
    set({ users });
  },

  addUser: async (userWithPassword) => {
    const { password, ...rest } = userWithPassword;
    const id = `user_${Date.now()}`;
    // db.addUser قد يرمي استثناء في حالة unique constraint — نُعيد الرمي لإظهار رسالة للمستخدم
    const result = await db.addUser({ ...rest, password }, id);
    if (!result) return false;
    const users = await db.getUsers();
    set({ users });
    return true;
  },

  updateUser: async (id, updates) => {
    const ok = await db.updateUser(id, updates);
    if (!ok) return false;
    // تحديث المستخدم الحالي إذا كان هو نفسه
    const { user } = get();
    if (user?.id === id) {
      const updated = { ...user, ...updates };
      set({ user: updated });
      ls.set(STORAGE_KEYS.CURRENT_USER, updated);
    }
    const users = await db.getUsers();
    set({ users });
    return true;
  },

  deleteUser: async (id) => {
    const ok = await db.deleteUser(id);
    if (!ok) return false;
    set(state => ({ users: state.users.filter(u => u.id !== id) }));
    return true;
  },

  // ── Settings ──
  loadSettings: async (userId) => {
    const settings = await db.getSettings(userId);
    set({ settings });
  },

  saveSettings: async (settings) => {
    const { user } = get();
    if (!user) return false;
    const ok = await db.saveSettings(user.id, settings);
    if (ok) set({ settings });
    return ok;
  },

  // ── Attendance ──
  loadAttendance: async (userId) => {
    const attendance = await db.getAttendance(userId);
    set({ attendance });
  },

  upsertAttendance: async (record) => {
    const result = await db.upsertAttendance(record);
    if (result) {
      set(state => {
        const idx = state.attendance.findIndex(r => r.userId === record.userId && r.date === record.date);
        const newAttendance = [...state.attendance];
        if (idx >= 0) newAttendance[idx] = result;
        else newAttendance.unshift(result);
        return { attendance: newAttendance };
      });
    }
    return result;
  },

  deleteAttendance: async (id) => {
    const ok = await db.deleteAttendance(id);
    if (ok) set(state => ({ attendance: state.attendance.filter(r => r.id !== id) }));
    return ok;
  },

  bulkUpsertAttendance: async (records) => {
    const ok = await db.bulkUpsertAttendance(records);
    if (ok) {
      set(state => {
        const all = [...state.attendance];
        records.forEach(rec => {
          const idx = all.findIndex(r => r.userId === rec.userId && r.date === rec.date);
          if (idx >= 0) all[idx] = rec; else all.push(rec);
        });
        return { attendance: all };
      });
    }
    return ok;
  },

  // ── Leave Requests ──
  loadLeaveRequests: async (userId) => {
    const leaveRequests = await db.getLeaveRequests(userId);
    set({ leaveRequests });
  },

  createLeaveRequest: async (req) => {
    const result = await db.createLeaveRequest(req);
    if (result) set(state => ({ leaveRequests: [result, ...state.leaveRequests] }));
    return !!result;
  },

  updateLeaveStatus: async (id, status, adminId, notes) => {
    const ok = await db.updateLeaveRequestStatus(id, status, adminId, notes);
    if (ok) {
      const { user } = get();
      if (user?.role === 'admin') {
        await get().loadLeaveRequests();
        await get().loadAttendance();
      } else {
        await get().loadLeaveRequests(user?.id);
        await get().loadAttendance(user?.id);
      }
    }
    return ok;
  },

  deleteLeaveRequest: async (id) => {
    const ok = await db.deleteLeaveRequest(id);
    if (ok) set(state => ({ leaveRequests: state.leaveRequests.filter(r => r.id !== id) }));
    return ok;
  },

  // ── Holidays ──
  loadHolidays: async () => {
    const officialHolidays = await db.getOfficialHolidays();
    set({ officialHolidays });
  },

  addHoliday: async (holiday) => {
    const result = await db.addOfficialHoliday(holiday);
    if (result) set(state => ({ officialHolidays: [...state.officialHolidays, result] }));
    return !!result;
  },

  deleteHoliday: async (id) => {
    const ok = await db.deleteOfficialHoliday(id);
    if (ok) set(state => ({ officialHolidays: state.officialHolidays.filter(h => h.id !== id) }));
    return ok;
  },

  // ── Salary Comparisons ──
  loadSalaryComparisons: async (userId) => {
    const salaryComparisons = await db.getSalaryComparisons(userId);
    set({ salaryComparisons });
  },

  addSalaryComparison: async (comp) => {
    const ok = await db.addSalaryComparison(comp);
    if (ok) set(state => ({ salaryComparisons: [comp, ...state.salaryComparisons] }));
    return ok;
  },

  deleteSalaryComparison: async (id) => {
    const ok = await db.deleteSalaryComparison(id);
    if (ok) set(state => ({ salaryComparisons: state.salaryComparisons.filter(c => c.id !== id) }));
    return ok;
  },
}));
