// ============================================================
// Constants — Attendance & Salary Tracker v6.5
// ============================================================
import type { AppSettings } from '../types';

export const APP_NAME = 'متتبع الحضور والراتب - برو';
export const APP_VERSION = 'v6.5.0';

export const STORAGE_KEYS = {
  USERS: 'ast_users',
  CURRENT_USER: 'ast_current_user',
  ATTENDANCE: 'ast_attendance',
  SETTINGS: 'ast_settings',
  LEAVE_REQUESTS: 'ast_leave_requests',
  COMPARISONS: 'ast_comparisons',
  THEME: 'ast_theme',
};

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  baseSalary: 0,
  transportAllowance: 0,
  monthStartDay: 27,
  workStartTime: '09:00',
  workEndTime: '17:00',
  weeklyOffDay: 5,    // Friday
  weeklyOffDay2: 6,   // Saturday
  lateDeductionMultiplier: 2,
  absenceDeductionMultiplier: 2,
  overtimeMultiplier: 1.5,
  lateGracePeriod: 10,
  overtimeMinThreshold: 15,
  roundMinutesTo: 1,
  insuranceEnabled: false,
  insuranceRate: 0,
  taxEnabled: false,
  taxRate: 0,
  requireGPS: true,
  checkTimeCheating: true,
};

export const DAY_TYPE_LABELS: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  holiday: 'إجازة أسبوعية',
  official_holiday: 'إجازة رسمية',
  sick_leave: 'إجازة مرضية',
  annual_leave: 'إجازة سنوية',
  unpaid_leave: 'إجازة بدون راتب',
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick_leave: 'إجازة مرضية',
  annual_leave: 'إجازة سنوية',
  unpaid_leave: 'إجازة بدون راتب',
  other: 'أخرى',
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليها',
  rejected: 'مرفوضة',
};

export const DAYS_ARABIC = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS_ARABIC = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const DEPARTMENT_OPTIONS = [
  'الإدارة', 'المحاسبة', 'المبيعات', 'المستودع', 'Stock Controller',
  'المشتريات', 'التسويق', 'تقنية المعلومات', 'الموارد البشرية', 'العمليات', 'أخرى',
];

// رابط التحميل المباشر لملف APK - يُحدَّث مع كل بناء GitHub Actions
export const APK_DOWNLOAD_URL = 'https://github.com/baselashrafbakry-beep/attendance-pro-official/releases/download/v6.5.0-build.39/AttendancePro-v6.5.0.apk';
export const APK_FILENAME = 'AttendancePro-v6.5.0.apk';
export const DEVELOPER_NAME = 'م باسل اشرف';
export const DEVELOPER_PHONE = '01014543845';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 دقيقة
