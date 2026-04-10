-- ============================================================
-- Attendance & Salary Tracker v6.2 — Final Production Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.app_users (
  id                   TEXT PRIMARY KEY,
  username             TEXT UNIQUE NOT NULL,
  password_text        TEXT, 
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

-- سياسات RLS النهائية
CREATE POLICY "public_read_users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "admin_all_users" ON public.app_users FOR ALL USING (true);

CREATE POLICY "attendance_access" ON public.attendance_records FOR ALL USING (true);
CREATE POLICY "leaves_access" ON public.leave_requests FOR ALL USING (true);
CREATE POLICY "settings_access" ON public.user_settings FOR ALL USING (true);
CREATE POLICY "holidays_read" ON public.official_holidays FOR SELECT USING (true);
CREATE POLICY "salary_access" ON public.salary_comparisons FOR ALL USING (true);

-- 3. SEED
INSERT INTO public.app_users (id, username, password_text, name, role, department)
VALUES ('admin', 'admin', 'admin123', 'مدير النظام', 'admin', 'الإدارة')
ON CONFLICT (id) DO UPDATE SET password_text = EXCLUDED.password_text;

INSERT INTO public.app_users (id, username, password_text, name, role, department)
VALUES ('basel', 'basel2026', 'basel123', 'باسل أشرف', 'employee', 'Stock Controller')
ON CONFLICT (id) DO UPDATE SET password_text = EXCLUDED.password_text;
