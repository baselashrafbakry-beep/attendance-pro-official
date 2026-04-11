// ============================================================
// Database Layer — كل عمليات قاعدة البيانات هنا
// v6.2 — Supabase + Fallback to localStorage
// ============================================================
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './client';
import type {
  User, AttendanceRecord, AppSettings, LeaveRequest,
  OfficialHoliday, SalaryComparison
} from '../../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../../constants';
import { sha256 } from '../../utils/security';

// ─── Helpers ─────────────────────────────────────────────────
const ls = {
  load: <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch { return fallback; }
  },
  save: (key: string, val: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore storage errors */ }
  },
};

const NETWORK_TIMEOUT_MS = 10000;
const TIMEOUT_ERROR = 'انتهت مهلة الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى.';

async function withTimeout<T>(promise: Promise<T>, timeoutMs = NETWORK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(TIMEOUT_ERROR)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// تحويل من snake_case (Supabase) إلى camelCase (App)
function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    loginEmail: (row.login_email as string) ?? undefined,
    authUserId: (row.auth_user_id as string) ?? undefined,
    name: row.name as string,
    role: row.role as 'admin' | 'employee',
    department: row.department as string | undefined,
    baseSalary: Number(row.base_salary ?? 0),
    transportAllowance: Number(row.transport_allowance ?? 0),
    annualLeaveLimit: (row.annual_leave_limit as number) ?? 21,
    sickLeaveLimit: (row.sick_leave_limit as number) ?? 15,
    workStartTime: (row.work_start_time as string) ?? '09:00',
    workEndTime: (row.work_end_time as string) ?? '17:00',
    weeklyOffDay: (row.weekly_off_day as number) ?? 5,
    weeklyOffDay2: (row.weekly_off_day2 as number) ?? -1,
    joinedDate: row.joined_date as string | undefined,
  };
}

function toAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date as string,
    checkIn: (row.check_in as string) ?? undefined,
    checkOut: (row.check_out as string) ?? undefined,
    checkInLocation: row.check_in_location as { lat: number; lng: number } | undefined,
    checkOutLocation: row.check_out_location as { lat: number; lng: number } | undefined,
    dayType: row.day_type as AttendanceRecord['dayType'],
    lateMinutes: Number(row.late_minutes ?? 0),
    overtimeMinutes: Number(row.overtime_minutes ?? 0),
    note: (row.note as string) ?? undefined,
    isManualEntry: (row.is_manual_entry as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toLeave(row: Record<string, unknown>): LeaveRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    startDate: typeof row.start_date === 'string' ? row.start_date.slice(0, 10) : row.start_date as string,
    endDate: typeof row.end_date === 'string' ? row.end_date.slice(0, 10) : row.end_date as string,
    reason: row.reason as string,
    leaveType: row.leave_type as LeaveRequest['leaveType'],
    status: row.status as LeaveRequest['status'],
    approvedBy: (row.approved_by as string) ?? undefined,
    approvalDate: (row.approval_date as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toHoliday(row: Record<string, unknown>): OfficialHoliday {
  return {
    id: row.id as string,
    name: row.name as string,
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date as string,
    isPaid: (row.is_paid as boolean) ?? true,
  };
}

function toComparison(row: Record<string, unknown>): SalaryComparison {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    monthLabel: row.month_label as string,
    expectedSalary: Number(row.expected_salary),
    receivedSalary: Number(row.received_salary),
    difference: Number(row.difference ?? (Number(row.received_salary) - Number(row.expected_salary))),
    date: row.created_at as string,
    notes: (row.notes as string) ?? undefined,
  };
}

function toSettings(row: Record<string, unknown>): AppSettings {
  return {
    userName: (row.user_name as string) ?? '',
    baseSalary: Number(row.base_salary ?? 0),
    transportAllowance: Number(row.transport_allowance ?? 0),
    monthStartDay: (row.month_start_day as number) ?? 27,
    workStartTime: (row.work_start_time as string) ?? '09:00',
    workEndTime: (row.work_end_time as string) ?? '17:00',
    weeklyOffDay: (row.weekly_off_day as number) ?? 5,
    weeklyOffDay2: (row.weekly_off_day2 as number) ?? -1,
    lateDeductionMultiplier: Number(row.late_deduction_multiplier ?? 2),
    absenceDeductionMultiplier: Number(row.absence_deduction_multiplier ?? 2),
    overtimeMultiplier: Number(row.overtime_multiplier ?? 1.5),
    lateGracePeriod: (row.late_grace_period as number) ?? 10,
    overtimeMinThreshold: (row.overtime_min_threshold as number) ?? 15,
    roundMinutesTo: (row.round_minutes_to as number) ?? 1,
    insuranceEnabled: (row.insurance_enabled as boolean) ?? false,
    insuranceRate: Number(row.insurance_rate ?? 0),
    taxEnabled: (row.tax_enabled as boolean) ?? false,
    taxRate: Number(row.tax_rate ?? 0),
    requireGPS: (row.require_gps as boolean) ?? true,
    checkTimeCheating: (row.check_time_cheating as boolean) ?? true,
  };
}

// ─── Helper للتحويل بين AppSettings و Supabase row ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function settingsToRow(userId: string, settings: AppSettings): Record<string, any> {
  return {
    user_id: userId,
    user_name: settings.userName,
    base_salary: settings.baseSalary,
    transport_allowance: settings.transportAllowance,
    month_start_day: settings.monthStartDay,
    work_start_time: settings.workStartTime,
    work_end_time: settings.workEndTime,
    weekly_off_day: settings.weeklyOffDay,
    weekly_off_day2: settings.weeklyOffDay2 ?? -1,
    late_deduction_multiplier: settings.lateDeductionMultiplier,
    absence_deduction_multiplier: settings.absenceDeductionMultiplier,
    overtime_multiplier: settings.overtimeMultiplier,
    late_grace_period: settings.lateGracePeriod,
    overtime_min_threshold: settings.overtimeMinThreshold,
    round_minutes_to: settings.roundMinutesTo,
    insurance_enabled: settings.insuranceEnabled,
    insurance_rate: settings.insuranceRate,
    tax_enabled: settings.taxEnabled,
    tax_rate: settings.taxRate,
    require_gps: settings.requireGPS,
    check_time_cheating: settings.checkTimeCheating,
  };
}

// ============================================================
// DB API
// ============================================================
export const db = {
  async getCurrentUserFromSession(): Promise<User | null> {
    if (!isSupabaseConfigured()) return null;
    const { data: authData } = await withTimeout(supabase.auth.getUser());
    const uid = authData.user?.id;
    if (!uid) return null;
    const { data, error } = await withTimeout(
      supabase.from('app_users').select('*').eq('auth_user_id', uid).single()
    );
    if (error || !data) return null;
    return toUser(data);
  },

  async logoutSession(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
  },

  async loginWithUsername(username: string, password: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return db.authenticateUser(username, password);
    }
    const { data: loginMeta, error: loginMetaError } = await withTimeout(
      supabase.rpc('get_login_email', { p_username: username })
    );
    if (loginMetaError || !loginMeta) return null;
    const row = Array.isArray(loginMeta) ? loginMeta[0] : loginMeta;
    const loginEmail = String((row as Record<string, unknown>)?.login_email ?? '');
    if (!loginEmail) return null;

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email: loginEmail, password })
    );
    if (error) return null;
    return db.getCurrentUserFromSession();
  },

  async authenticateUser(username: string, password: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      const user = await db.getUserByUsername(username);
      if (!user) return null;
      const ok = await db.verifyPassword(user.id, password);
      return ok ? user : null;
    }
    const passwordHash = await sha256(password);
    const { data, error } = await withTimeout(supabase.rpc('login_user', {
      p_username: username,
      p_password_hash: passwordHash,
    }));
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return toUser(row as Record<string, unknown>);
  },

  // ─── USERS ──────────────────────────────────────────────
  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return ls.load<User[]>(STORAGE_KEYS.USERS, []);
    }
    const { data, error } = await withTimeout(supabase
      .from('app_users')
      .select('*')
      .order('name'));
    if (error) { console.error('[db.getUsers]', error); return ls.load<User[]>(STORAGE_KEYS.USERS, []); }
    const users = (data ?? []).map(toUser);
    ls.save(STORAGE_KEYS.USERS, users);
    return users;
  },

  async getUserById(id: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      const users = ls.load<User[]>(STORAGE_KEYS.USERS, []);
      return users.find(u => u.id === id) ?? null;
    }
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return toUser(data);
  },

  async getUserByUsername(username: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      const users = ls.load<User[]>(STORAGE_KEYS.USERS, []);
      return users.find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
    }
    const { data, error } = await withTimeout(supabase
      .from('app_users')
      .select('*')
      .ilike('username', username)
      .single());
    if (error || !data) return null;
    return toUser(data);
  },

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const passwordHash = await sha256(password);
    if (!isSupabaseConfigured()) {
      // In offline mode, verify hashed password from localStorage
      const passwords = ls.load<Record<string, string>>('ast_passwords', {});
      const stored = passwords[userId] || '';
      if (stored === passwordHash) return true;
      if (stored === password) {
        passwords[userId] = passwordHash;
        ls.save('ast_passwords', passwords);
        return true;
      }
      return false;
    }
    const { data, error } = await withTimeout(supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .single());
    if (error || !data) return false;
    const row = data as Record<string, unknown>;
    const storedHash = String(row.password_hash ?? '');
    if (storedHash === passwordHash) return true;
    const legacyPlain = String(row.password_text ?? '');
    if (legacyPlain && legacyPlain === password) {
      await db.changePassword(userId, password);
      return true;
    }
    return false;
  },

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const passwordHash = await sha256(newPassword);
    if (!isSupabaseConfigured()) {
      const passwords = ls.load<Record<string, string>>('ast_passwords', {});
      passwords[userId] = passwordHash;
      ls.save('ast_passwords', passwords);
      return true;
    }
    // Update password_hash in app_users
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);
    if (error) { console.error('[db.changePassword]', error); return false; }

    // Also update in Supabase Auth via Edge Function
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const { data: appUser } = await supabase
          .from('app_users')
          .select('username')
          .eq('id', userId)
          .single();
        if (appUser) {
          const fnUrl = `${SUPABASE_URL}/functions/v1/create-auth-user`;
          await withTimeout(
            fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                username: appUser.username,
                password: newPassword,
                appUserId: userId,
              }),
            }).then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[db.changePassword] Edge function error:', err);
              }
            }),
            15000
          );
        }
      }
    } catch (fnErr) {
      console.error('[db.changePassword] Failed to update auth password:', fnErr);
      // Non-fatal: password was updated in app_users
    }
    return true;
  },

  async addUser(user: Omit<User, 'id'> & { password?: string }, id: string): Promise<User | null> {
    const passwordHash = user.password ? await sha256(user.password) : '';
    if (!isSupabaseConfigured()) {
      const users = ls.load<User[]>(STORAGE_KEYS.USERS, []);
      const newUser: User = { ...user, id };
      ls.save(STORAGE_KEYS.USERS, [...users, newUser]);
      if (user.password) {
        const passwords = ls.load<Record<string, string>>('ast_passwords', {});
        passwords[id] = passwordHash;
        ls.save('ast_passwords', passwords);
      }
      return newUser;
    }
    const loginEmail = `${user.username.toLowerCase()}@attendance.local`;
    // Step 1: Insert app_users record first
    const { data, error } = await supabase.from('app_users').insert({
      id,
      username: user.username,
      login_email: loginEmail,
      password_hash: passwordHash,
      name: user.name,
      role: user.role,
      department: user.department,
      base_salary: user.baseSalary ?? 0,
      transport_allowance: user.transportAllowance ?? 0,
      annual_leave_limit: user.annualLeaveLimit ?? 21,
      sick_leave_limit: user.sickLeaveLimit ?? 15,
      work_start_time: user.workStartTime ?? '09:00',
      work_end_time: user.workEndTime ?? '17:00',
      weekly_off_day: user.weeklyOffDay ?? 5,
      weekly_off_day2: user.weeklyOffDay2 ?? -1,
    }).select().single();
    if (error) { console.error('[db.addUser]', error); return null; }
    
    // Step 2: Create Supabase Auth user via Edge Function so the employee can login
    if (user.password) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (token) {
          const fnUrl = `${SUPABASE_URL}/functions/v1/create-auth-user`;
          await withTimeout(
            fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                username: user.username,
                password: user.password,
                appUserId: id,
              }),
            }).then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[db.addUser] Edge function error:', err);
              }
            }),
            15000
          );
        }
      } catch (fnErr) {
        // Non-fatal: user was created in app_users, auth creation failed
        // The admin can reset the password to fix auth access
        console.error('[db.addUser] Failed to create auth user:', fnErr);
      }
    }
    return toUser(data);
  },

  async updateUser(id: string, updates: Partial<User & { password?: string }>): Promise<boolean> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.baseSalary !== undefined) dbUpdates.base_salary = updates.baseSalary;
    if (updates.transportAllowance !== undefined) dbUpdates.transport_allowance = updates.transportAllowance;
    if (updates.annualLeaveLimit !== undefined) dbUpdates.annual_leave_limit = updates.annualLeaveLimit;
    if (updates.sickLeaveLimit !== undefined) dbUpdates.sick_leave_limit = updates.sickLeaveLimit;
    if (updates.workStartTime !== undefined) dbUpdates.work_start_time = updates.workStartTime;
    if (updates.workEndTime !== undefined) dbUpdates.work_end_time = updates.workEndTime;
    if (updates.weeklyOffDay !== undefined) dbUpdates.weekly_off_day = updates.weeklyOffDay;
    if (updates.weeklyOffDay2 !== undefined) dbUpdates.weekly_off_day2 = updates.weeklyOffDay2;
    if (updates.password !== undefined) dbUpdates.password_hash = await sha256(updates.password);

    if (!isSupabaseConfigured()) {
      const users = ls.load<User[]>(STORAGE_KEYS.USERS, []);
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      users[idx] = { ...users[idx], ...updates };
      ls.save(STORAGE_KEYS.USERS, users);
      if (updates.password) {
        const passwords = ls.load<Record<string, string>>('ast_passwords', {});
        passwords[id] = await sha256(updates.password);
        ls.save('ast_passwords', passwords);
      }
      return true;
    }
    const { error } = await supabase.from('app_users').update(dbUpdates).eq('id', id);
    if (error) { console.error('[db.updateUser]', error); return false; }

    // If password was changed, update auth user via Edge Function
    if (updates.password) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (token) {
          // Get the user's username to build the login email
          const { data: appUser } = await supabase
            .from('app_users')
            .select('username')
            .eq('id', id)
            .single();
          if (appUser) {
            const fnUrl = `${SUPABASE_URL}/functions/v1/create-auth-user`;
            await withTimeout(
              fetch(fnUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                  username: appUser.username,
                  password: updates.password,
                  appUserId: id,
                }),
              }).then(async (res) => {
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  console.error('[db.updateUser] Edge function error:', err);
                }
              }),
              15000
            );
          }
        }
      } catch (fnErr) {
        console.error('[db.updateUser] Failed to update auth password:', fnErr);
      }
    }
    return true;
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      const users = ls.load<User[]>(STORAGE_KEYS.USERS, []).filter(u => u.id !== id);
      ls.save(STORAGE_KEYS.USERS, users);
      return true;
    }
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) { console.error('[db.deleteUser]', error); return false; }
    return true;
  },

  // ─── SETTINGS ─────────────────────────────────────────────
  async getSettings(userId: string): Promise<AppSettings> {
    const fallback = ls.load<AppSettings>(`${STORAGE_KEYS.SETTINGS}_${userId}`, { ...DEFAULT_SETTINGS });
    if (!isSupabaseConfigured()) return { ...DEFAULT_SETTINGS, ...fallback };

    const { data, error } = await withTimeout(supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single());
    if (error || !data) return { ...DEFAULT_SETTINGS, ...fallback };
    const s = toSettings(data);
    ls.save(`${STORAGE_KEYS.SETTINGS}_${userId}`, s);
    return s;
  },

  async saveSettings(userId: string, settings: AppSettings): Promise<boolean> {
    ls.save(`${STORAGE_KEYS.SETTINGS}_${userId}`, settings);
    if (!isSupabaseConfigured()) return true;

    const payload = settingsToRow(userId, settings);
    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) { console.error('[db.saveSettings]', error); return false; }
    return true;
  },

  // ─── ATTENDANCE ───────────────────────────────────────────
  async getAttendance(userId?: string): Promise<AttendanceRecord[]> {
    const cached = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    if (!isSupabaseConfigured()) {
      return userId ? cached.filter(r => r.userId === userId) : cached;
    }

    let query = supabase.from('attendance_records').select('*').order('date', { ascending: false });
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await withTimeout(query);
    if (error) {
      console.error('[db.getAttendance]', error);
      return userId ? cached.filter(r => r.userId === userId) : cached;
    }
    const records = (data ?? []).map(toAttendance);
    ls.save(STORAGE_KEYS.ATTENDANCE, records);
    return records;
  },

  async getAttendanceForDate(userId: string, date: string): Promise<AttendanceRecord | null> {
    if (!isSupabaseConfigured()) {
      const cached = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      return cached.find(r => r.userId === userId && r.date === date) ?? null;
    }
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    if (error || !data) return null;
    return toAttendance(data);
  },

  async upsertAttendance(record: AttendanceRecord): Promise<AttendanceRecord | null> {
    const all = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const byUserDate = new Map<string, AttendanceRecord>();
    all.forEach((r) => byUserDate.set(`${r.userId}__${r.date}`, r));
    byUserDate.set(`${record.userId}__${record.date}`, record);
    ls.save(STORAGE_KEYS.ATTENDANCE, Array.from(byUserDate.values()));

    if (!isSupabaseConfigured()) return record;

    const payload = {
      id: record.id,
      user_id: record.userId,
      date: record.date,
      check_in: record.checkIn || null,
      check_out: record.checkOut || null,
      check_in_location: record.checkInLocation || null,
      check_out_location: record.checkOutLocation || null,
      day_type: record.dayType,
      late_minutes: record.lateMinutes,
      overtime_minutes: record.overtimeMinutes,
      note: record.note || null,
      is_manual_entry: record.isManualEntry ?? false,
    };

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) { 
      console.error('[db.upsertAttendance] Database Error:', error); 
      // If it's a conflict or other error, we still want the local update to persist
      // but we should return null to indicate DB sync failure if needed.
      // For now, let's return the local record so the UI stays responsive.
      return record; 
    }
    const syncedRecord = toAttendance(data);
    
    // Update local storage with the synced record (it might have a DB-generated ID or timestamps)
    const finalAll = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const finalIdx = finalAll.findIndex(r => r.userId === syncedRecord.userId && r.date === syncedRecord.date);
    if (finalIdx >= 0) finalAll[finalIdx] = syncedRecord; else finalAll.push(syncedRecord);
    ls.save(STORAGE_KEYS.ATTENDANCE, finalAll);

    return syncedRecord;
  },

  async deleteAttendance(id: string): Promise<boolean> {
    const all = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []).filter(r => r.id !== id);
    ls.save(STORAGE_KEYS.ATTENDANCE, all);

    if (!isSupabaseConfigured()) return true;
    const { error } = await supabase.from('attendance_records').delete().eq('id', id);
    if (error) { console.error('[db.deleteAttendance]', error); return false; }
    return true;
  },

  async bulkUpsertAttendance(records: AttendanceRecord[]): Promise<boolean> {
    const all = ls.load<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    records.forEach(rec => {
      const idx = all.findIndex(r => r.userId === rec.userId && r.date === rec.date);
      if (idx >= 0) all[idx] = rec; else all.push(rec);
    });
    ls.save(STORAGE_KEYS.ATTENDANCE, all);

    if (!isSupabaseConfigured()) return true;

    const payload = records.map(r => ({
      id: r.id,
      user_id: r.userId,
      date: r.date,
      check_in: r.checkIn || null,
      check_out: r.checkOut || null,
      check_in_location: r.checkInLocation || null,
      check_out_location: r.checkOutLocation || null,
      day_type: r.dayType,
      late_minutes: r.lateMinutes,
      overtime_minutes: r.overtimeMinutes,
      note: r.note || null,
      is_manual_entry: r.isManualEntry ?? false,
    }));

    const { error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'user_id,date' });
    if (error) { console.error('[db.bulkUpsert]', error); return false; }
    return true;
  },

  // ─── LEAVE REQUESTS ───────────────────────────────────────
  async getLeaveRequests(userId?: string): Promise<LeaveRequest[]> {
    const cached = ls.load<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    if (!isSupabaseConfigured()) {
      return userId ? cached.filter(l => l.userId === userId) : cached;
    }

    let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await withTimeout(query);
    if (error) {
      console.error('[db.getLeaveRequests]', error);
      return userId ? cached.filter(l => l.userId === userId) : cached;
    }
    const leaves = (data ?? []).map(toLeave);
    ls.save(STORAGE_KEYS.LEAVE_REQUESTS, leaves);
    return leaves;
  },

  async createLeaveRequest(req: LeaveRequest): Promise<LeaveRequest | null> {
    const all = ls.load<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    ls.save(STORAGE_KEYS.LEAVE_REQUESTS, [...all, req]);

    if (!isSupabaseConfigured()) return req;

    const { data, error } = await supabase.from('leave_requests').insert({
      id: req.id,
      user_id: req.userId,
      start_date: req.startDate,
      end_date: req.endDate,
      reason: req.reason,
      leave_type: req.leaveType,
      status: req.status,
    }).select().single();
    if (error) { console.error('[db.createLeaveRequest]', error); return req; }
    return toLeave(data);
  },

  async updateLeaveRequestStatus(
    id: string,
    status: LeaveRequest['status'],
    adminId: string,
    notes?: string
  ): Promise<boolean> {
    const all = ls.load<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        status,
        notes,
        approvedBy: adminId,
        approvalDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      ls.save(STORAGE_KEYS.LEAVE_REQUESTS, all);
    }

    if (!isSupabaseConfigured()) return true;
    const { data, error } = await withTimeout(supabase.rpc('admin_set_leave_status', {
      p_leave_id: id,
      p_status: status,
      p_admin_id: adminId,
      p_notes: notes || null,
    }));
    if (error) { console.error('[db.updateLeaveRequestStatus.rpc]', error); return false; }
    if (data !== true) {
      console.error('[db.updateLeaveRequestStatus.rpc] unexpected result', data);
      return false;
    }
    return true;
  },

  async deleteLeaveRequest(id: string): Promise<boolean> {
    const all = ls.load<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []).filter(r => r.id !== id);
    ls.save(STORAGE_KEYS.LEAVE_REQUESTS, all);
    if (!isSupabaseConfigured()) return true;
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) { console.error('[db.deleteLeaveRequest]', error); return false; }
    return true;
  },

  // ─── OFFICIAL HOLIDAYS ────────────────────────────────────
  async getOfficialHolidays(): Promise<OfficialHoliday[]> {
    const cached = ls.load<OfficialHoliday[]>(STORAGE_KEYS.COMPARISONS + '_holidays', []);
    if (!isSupabaseConfigured()) return cached;

    const { data, error } = await supabase
      .from('official_holidays')
      .select('*')
      .order('date');
    if (error) { console.error('[db.getOfficialHolidays]', error); return cached; }
    const holidays = (data ?? []).map(toHoliday);
    ls.save(STORAGE_KEYS.COMPARISONS + '_holidays', holidays);
    return holidays;
  },

  async addOfficialHoliday(h: OfficialHoliday): Promise<OfficialHoliday | null> {
    const all = ls.load<OfficialHoliday[]>(STORAGE_KEYS.COMPARISONS + '_holidays', []);
    ls.save(STORAGE_KEYS.COMPARISONS + '_holidays', [...all, h]);
    if (!isSupabaseConfigured()) return h;

    const { data, error } = await supabase.from('official_holidays').insert({
      id: h.id,
      name: h.name,
      date: h.date,
      is_paid: h.isPaid,
    }).select().single();
    if (error) { console.error('[db.addOfficialHoliday]', error); return h; }
    return toHoliday(data);
  },

  async deleteOfficialHoliday(id: string): Promise<boolean> {
    const all = ls.load<OfficialHoliday[]>(STORAGE_KEYS.COMPARISONS + '_holidays', []).filter(h => h.id !== id);
    ls.save(STORAGE_KEYS.COMPARISONS + '_holidays', all);
    if (!isSupabaseConfigured()) return true;
    const { error } = await supabase.from('official_holidays').delete().eq('id', id);
    if (error) { console.error('[db.deleteOfficialHoliday]', error); return false; }
    return true;
  },

  // ─── SALARY COMPARISONS ───────────────────────────────────
  async getSalaryComparisons(userId?: string): Promise<SalaryComparison[]> {
    const cached = ls.load<SalaryComparison[]>(STORAGE_KEYS.COMPARISONS, []);
    if (!isSupabaseConfigured()) {
      return userId ? cached.filter(c => c.userId === userId) : cached;
    }

    let query = supabase.from('salary_comparisons').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await withTimeout(query);
    if (error) { console.error('[db.getSalaryComparisons]', error); return cached; }
    const comps = (data ?? []).map(toComparison);
    ls.save(STORAGE_KEYS.COMPARISONS, comps);
    return comps;
  },

  async addSalaryComparison(c: SalaryComparison): Promise<boolean> {
    const all = ls.load<SalaryComparison[]>(STORAGE_KEYS.COMPARISONS, []);
    ls.save(STORAGE_KEYS.COMPARISONS, [...all, c]);
    if (!isSupabaseConfigured()) return true;

    const { error } = await supabase.from('salary_comparisons').insert({
      id: c.id,
      user_id: c.userId,
      month_label: c.monthLabel,
      expected_salary: c.expectedSalary,
      received_salary: c.receivedSalary,
      notes: c.notes || null,
    });
    if (error) { console.error('[db.addSalaryComparison]', error); return false; }
    return true;
  },

  async deleteSalaryComparison(id: string): Promise<boolean> {
    const all = ls.load<SalaryComparison[]>(STORAGE_KEYS.COMPARISONS, []).filter(c => c.id !== id);
    ls.save(STORAGE_KEYS.COMPARISONS, all);
    if (!isSupabaseConfigured()) return true;
    const { error } = await supabase.from('salary_comparisons').delete().eq('id', id);
    if (error) { console.error('[db.deleteSalaryComparison]', error); return false; }
    return true;
  },

  // ─── LOGIN ATTEMPTS ───────────────────────────────────────
  async logLoginAttempt(username: string, success: boolean, ip?: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    await withTimeout(supabase.from('login_attempts').insert({
      username,
      success,
      ip_address: ip ?? null,
    }));
  },

  async canAttemptLogin(username: string, maxAttempts: number, lockoutMs: number): Promise<boolean> {
    if (!isSupabaseConfigured()) return true;
    const since = new Date(Date.now() - lockoutMs).toISOString();
    const { data, error } = await withTimeout(supabase
      .from('login_attempts')
      .select('attempted_at')
      .eq('username', username)
      .eq('success', false)
      .gte('attempted_at', since)
      .order('attempted_at', { ascending: false })
      .limit(maxAttempts));
    if (error) return true;
    return (data ?? []).length < maxAttempts;
  },

  // ─── FULL EXPORT ─────────────────────────────────────────
  async exportAllData(): Promise<object> {
    const [users, attendance, leaves, holidays, comparisons] = await Promise.all([
      db.getUsers(),
      db.getAttendance(),
      db.getLeaveRequests(),
      db.getOfficialHolidays(),
      db.getSalaryComparisons(),
    ]);
    return {
      app: 'Attendance & Salary Tracker',
      version: 'v6.2.1',
      exportedAt: new Date().toISOString(),
      users,
      attendance,
      leaveRequests: leaves,
      officialHolidays: holidays,
      salaryComparisons: comparisons,
    };
  },
};

export default db;
