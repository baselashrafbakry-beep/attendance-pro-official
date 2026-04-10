-- ============================================================
-- Attendance & Salary Tracker v6.2 — Final Production Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.app_users (
  id                   TEXT PRIMARY KEY,
  username             TEXT UNIQUE NOT NULL,
  login_email          TEXT UNIQUE,
  auth_user_id         UUID UNIQUE,
  password_hash        TEXT NOT NULL,
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('admin','employee')),
  department           TEXT,
  base_salary          NUMERIC(12,2) DEFAULT 0 CHECK (base_salary >= 0),
  transport_allowance  NUMERIC(12,2) DEFAULT 0 CHECK (transport_allowance >= 0),
  annual_leave_limit   INTEGER DEFAULT 21 CHECK (annual_leave_limit >= 0),
  sick_leave_limit     INTEGER DEFAULT 15 CHECK (sick_leave_limit >= 0),
  work_start_time      TEXT DEFAULT '09:00',
  work_end_time        TEXT DEFAULT '17:00',
  weekly_off_day       INTEGER DEFAULT 5 CHECK (weekly_off_day BETWEEN 0 AND 6),
  weekly_off_day2      INTEGER DEFAULT -1 CHECK (weekly_off_day2 BETWEEN -1 AND 6),
  joined_date          DATE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS login_email TEXT UNIQUE;
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'password_text'
  ) THEN
    EXECUTE $sql$
      UPDATE public.app_users
      SET password_hash = encode(digest(password_text, 'sha256'), 'hex')
      WHERE (password_hash IS NULL OR password_hash = '')
        AND password_text IS NOT NULL
        AND password_text <> ''
    $sql$;
  END IF;
END $$;

UPDATE public.app_users
SET login_email = username || '@attendance.local'
WHERE login_email IS NULL OR login_email = '';

UPDATE public.app_users app
SET auth_user_id = au.id
FROM auth.users au
WHERE app.auth_user_id IS NULL
  AND app.login_email IS NOT NULL
  AND lower(au.email) = lower(app.login_email);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  user_name                   TEXT,
  base_salary                 NUMERIC(12,2) DEFAULT 0,
  transport_allowance         NUMERIC(12,2) DEFAULT 0,
  month_start_day             INTEGER DEFAULT 27 CHECK (month_start_day BETWEEN 1 AND 28),
  work_start_time             TEXT DEFAULT '09:00',
  work_end_time               TEXT DEFAULT '17:00',
  weekly_off_day              INTEGER DEFAULT 5,
  weekly_off_day2             INTEGER DEFAULT -1,
  late_deduction_multiplier   NUMERIC(4,2) DEFAULT 2,
  absence_deduction_multiplier NUMERIC(4,2) DEFAULT 2,
  overtime_multiplier         NUMERIC(4,2) DEFAULT 1.5,
  late_grace_period           INTEGER DEFAULT 10,
  overtime_min_threshold      INTEGER DEFAULT 15,
  round_minutes_to            INTEGER DEFAULT 1,
  insurance_enabled           BOOLEAN DEFAULT FALSE,
  insurance_rate              NUMERIC(5,2) DEFAULT 0,
  tax_enabled                 BOOLEAN DEFAULT FALSE,
  tax_rate                    NUMERIC(5,2) DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  check_in          TIME,
  check_out         TIME,
  day_type          TEXT NOT NULL CHECK (day_type IN (
    'present','absent','late','holiday','official_holiday',
    'sick_leave','annual_leave','unpaid_leave'
  )),
  late_minutes      INTEGER DEFAULT 0 CHECK (late_minutes >= 0),
  overtime_minutes  INTEGER DEFAULT 0 CHECK (overtime_minutes >= 0),
  check_in_location JSONB,
  check_out_location JSONB,
  note              TEXT,
  is_manual_entry   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT NOT NULL,
  leave_type    TEXT NOT NULL CHECK (leave_type IN ('sick_leave','annual_leave','unpaid_leave','other')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by   TEXT REFERENCES public.app_users(id),
  approval_date TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.official_holidays (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  date       DATE NOT NULL UNIQUE,
  is_paid    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_comparisons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  month_label      TEXT NOT NULL,
  expected_salary  NUMERIC(12,2) NOT NULL,
  received_salary  NUMERIC(12,2) NOT NULL,
  difference       NUMERIC(12,2) GENERATED ALWAYS AS (received_salary - expected_salary) STORED,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username     TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address   TEXT,
  success      BOOLEAN NOT NULL DEFAULT FALSE
);

-- Login RPC for anon-safe authentication (without exposing full table reads)
CREATE OR REPLACE FUNCTION public.login_user(p_username TEXT, p_password_hash TEXT)
RETURNS SETOF public.app_users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.app_users
  WHERE lower(username) = lower(p_username)
    AND password_hash = p_password_hash
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_login_email(p_username TEXT)
RETURNS TABLE(login_email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.login_email
  FROM public.app_users au
  WHERE lower(au.username) = lower(p_username)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.login_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;

-- Helper functions for strict per-user/admin RLS
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id
  FROM public.app_users au
  WHERE au.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.role = 'admin'
  );
$$;

-- 1.1 updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_app_users_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.base_salary IS DISTINCT FROM OLD.base_salary
     OR NEW.transport_allowance IS DISTINCT FROM OLD.transport_allowance
     OR NEW.annual_leave_limit IS DISTINCT FROM OLD.annual_leave_limit
     OR NEW.sick_leave_limit IS DISTINCT FROM OLD.sick_leave_limit
     OR NEW.login_email IS DISTINCT FROM OLD.login_email
  THEN
    RAISE EXCEPTION 'غير مسموح بتعديل هذا الحقل';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_employee_attendance_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_today DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  v_today := (now() AT TIME ZONE 'Africa/Cairo')::date;
  IF NEW.user_id <> public.current_app_user_id() THEN
    RAISE EXCEPTION 'لا يمكن تعديل حضور مستخدم آخر';
  END IF;
  IF NEW.date <> v_today THEN
    RAISE EXCEPTION 'يمكن للموظف تعديل سجل اليوم فقط';
  END IF;
  IF NEW.is_manual_entry THEN
    RAISE EXCEPTION 'الإدخال اليدوي متاح للمدير فقط';
  END IF;
  IF NEW.day_type NOT IN ('present','late') THEN
    RAISE EXCEPTION 'نوع اليوم غير مسموح للموظف';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_leave_status(
  p_leave_id TEXT,
  p_status TEXT,
  p_admin_id TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave public.leave_requests%ROWTYPE;
  v_day DATE;
  v_marker TEXT;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'غير مصرح بهذه العملية';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;

  SELECT * INTO v_leave
  FROM public.leave_requests
  WHERE id::text = p_leave_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_marker := '[LEAVE_SYNC:' || p_leave_id || ']';

  UPDATE public.leave_requests
  SET status = p_status,
      notes = p_notes,
      approved_by = p_admin_id,
      approval_date = now()
  WHERE id::text = p_leave_id;

  -- Remove previously materialized attendance rows for this leave.
  DELETE FROM public.attendance_records
  WHERE user_id = v_leave.user_id
    AND note = v_marker;

  IF p_status = 'approved' THEN
    v_day := v_leave.start_date;
    WHILE v_day <= v_leave.end_date LOOP
      INSERT INTO public.attendance_records (
        user_id, date, day_type, late_minutes, overtime_minutes, is_manual_entry, note
      ) VALUES (
        v_leave.user_id,
        v_day,
        v_leave.leave_type,
        0,
        0,
        TRUE,
        v_marker
      )
      ON CONFLICT (user_id, date) DO UPDATE
      SET day_type = EXCLUDED.day_type,
          check_in = NULL,
          check_out = NULL,
          late_minutes = 0,
          overtime_minutes = 0,
          is_manual_entry = TRUE,
          note = EXCLUDED.note,
          updated_at = now();

      v_day := v_day + 1;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_set_leave_status(UUID, TEXT, TEXT, TEXT);

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON public.app_users;
CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_users_self_update_guard ON public.app_users;
CREATE TRIGGER trg_app_users_self_update_guard
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_app_users_self_update();

DROP TRIGGER IF EXISTS trg_employee_attendance_guard ON public.attendance_records;
CREATE TRIGGER trg_employee_attendance_guard
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_attendance_guard();

-- 2. SECURITY (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- حذف السياسات المفتوحة
DROP POLICY IF EXISTS "open_access_all" ON public.app_users;
DROP POLICY IF EXISTS "open_access_settings" ON public.user_settings;
DROP POLICY IF EXISTS "open_access_attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "open_access_leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "open_access_holidays" ON public.official_holidays;
DROP POLICY IF EXISTS "open_access_salary" ON public.salary_comparisons;
DROP POLICY IF EXISTS "authenticated_read_users" ON public.app_users;
DROP POLICY IF EXISTS "authenticated_manage_users" ON public.app_users;
DROP POLICY IF EXISTS "authenticated_attendance_access" ON public.attendance_records;
DROP POLICY IF EXISTS "authenticated_leaves_access" ON public.leave_requests;
DROP POLICY IF EXISTS "authenticated_settings_access" ON public.user_settings;
DROP POLICY IF EXISTS "authenticated_holidays_read" ON public.official_holidays;
DROP POLICY IF EXISTS "authenticated_salary_access" ON public.salary_comparisons;
DROP POLICY IF EXISTS "anon_log_login_attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "anon_read_login_attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "users_self_or_admin_select" ON public.app_users;
DROP POLICY IF EXISTS "users_self_or_admin_update" ON public.app_users;
DROP POLICY IF EXISTS "users_admin_insert" ON public.app_users;
DROP POLICY IF EXISTS "users_admin_delete" ON public.app_users;
DROP POLICY IF EXISTS "attendance_self_or_admin" ON public.attendance_records;
DROP POLICY IF EXISTS "leaves_self_or_admin" ON public.leave_requests;
DROP POLICY IF EXISTS "settings_self_or_admin" ON public.user_settings;
DROP POLICY IF EXISTS "holidays_authenticated_read" ON public.official_holidays;
DROP POLICY IF EXISTS "holidays_admin_write" ON public.official_holidays;
DROP POLICY IF EXISTS "salary_self_or_admin" ON public.salary_comparisons;
DROP POLICY IF EXISTS "login_attempts_insert_any" ON public.login_attempts;
DROP POLICY IF EXISTS "login_attempts_select_admin_only" ON public.login_attempts;

-- سياسات RLS (تمنع أي وصول عام مجهول)
CREATE POLICY "users_self_or_admin_select" ON public.app_users
FOR SELECT USING (auth_user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "users_self_or_admin_update" ON public.app_users
FOR UPDATE USING (auth_user_id = auth.uid() OR public.is_admin_user())
WITH CHECK (auth_user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "users_admin_insert" ON public.app_users
FOR INSERT WITH CHECK (public.is_admin_user());

CREATE POLICY "users_admin_delete" ON public.app_users
FOR DELETE USING (public.is_admin_user());

CREATE POLICY "attendance_self_or_admin" ON public.attendance_records
FOR SELECT USING (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "attendance_insert_self_or_admin" ON public.attendance_records
FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "attendance_update_self_or_admin" ON public.attendance_records
FOR UPDATE USING (user_id = public.current_app_user_id() OR public.is_admin_user())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "attendance_delete_admin" ON public.attendance_records
FOR DELETE USING (public.is_admin_user());

CREATE POLICY "leaves_select_self_or_admin" ON public.leave_requests
FOR SELECT USING (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "leaves_insert_self_or_admin" ON public.leave_requests
FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "leaves_update_admin" ON public.leave_requests
FOR UPDATE USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "leaves_delete_admin_or_pending_owner" ON public.leave_requests
FOR DELETE USING (
  public.is_admin_user()
  OR (user_id = public.current_app_user_id() AND status = 'pending')
);

CREATE POLICY "settings_self_or_admin" ON public.user_settings
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin_user())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "holidays_authenticated_read" ON public.official_holidays
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "holidays_admin_write" ON public.official_holidays
FOR ALL USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "salary_self_or_admin" ON public.salary_comparisons
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin_user())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

CREATE POLICY "login_attempts_insert_any" ON public.login_attempts
FOR INSERT WITH CHECK (true);

CREATE POLICY "login_attempts_select_admin_only" ON public.login_attempts
FOR SELECT USING (public.is_admin_user());

REVOKE ALL ON FUNCTION public.admin_set_leave_status(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_leave_status(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Realtime replication for instant cross-device updates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'salary_comparisons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_comparisons;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'official_holidays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.official_holidays;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END $$;

-- 3. SEED
INSERT INTO public.app_users (id, username, login_email, password_hash, name, role, department)
VALUES (
  'admin',
  'admin',
  'admin@attendance.local',
  encode(digest('admin123', 'sha256'), 'hex'),
  'مدير النظام',
  'admin',
  'الإدارة'
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO public.app_users (id, username, login_email, password_hash, name, role, department)
VALUES (
  'basel',
  'basel2026',
  'basel2026@attendance.local',
  encode(digest('basel123', 'sha256'), 'hex'),
  'باسل أشرف',
  'employee',
  'Stock Controller'
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
