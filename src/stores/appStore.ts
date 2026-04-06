// ============================================================
// App Store — Zustand State Management
// ============================================================
import { create } from 'zustand';
import type { User, AttendanceRecord, AppSettings, LeaveRequest, OfficialHoliday, SalaryComparison } from '../types';
import { db } from '../lib/supabase/db';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants';

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
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  remove: (key: string) => { try { localStorage.removeItem(key); } catch {} },
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
    // استعادة المستخدم من الذاكرة المحلية
    const savedUser = ls.get<User>(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      set({ user: savedUser, isInitialized: true });
      // تحميل البيانات في الخلفية
      const { syncFromCloud } = get();
      syncFromCloud();
    } else {
      set({ isInitialized: true });
    }
  },

  login: async (username: string, password: string) => {
    set({ isSyncing: true, syncError: null });
    try {
      const user = await db.getUserByUsername(username);
      if (!user) {
        await db.logLoginAttempt(username, false);
        return { success: false, error: 'اسم المستخدم غير موجود' };
      }
      
      const valid = await db.verifyPassword(user.id, password);
      if (!valid) {
        await db.logLoginAttempt(username, false);
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }

      await db.logLoginAttempt(username, true);
      ls.set(STORAGE_KEYS.CURRENT_USER, user);
      set({ user, isSyncing: false });
      
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
    ls.remove(STORAGE_KEYS.CURRENT_USER);
    set({
      user: null,
      attendance: [],
      settings: { ...DEFAULT_SETTINGS },
      leaveRequests: [],
      salaryComparisons: [],
    });
  },

  syncFromCloud: async () => {
    const { user } = get();
    set({ isSyncing: true, syncError: null });
    try {
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
      
      await Promise.allSettled(promises);
      set({ isSyncing: false, lastSync: new Date() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ في المزامنة';
      set({ isSyncing: false, syncError: msg });
    }
  },

  // ── Users ──
  loadUsers: async () => {
    const users = await db.getUsers();
    set({ users });
  },

  addUser: async (userWithPassword) => {
    const { password, ...rest } = userWithPassword;
    const id = `user_${Date.now()}`;
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
      set(state => ({
        leaveRequests: state.leaveRequests.map(r =>
          r.id === id ? { ...r, status, notes, approvedBy: adminId } : r
        ),
      }));
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
