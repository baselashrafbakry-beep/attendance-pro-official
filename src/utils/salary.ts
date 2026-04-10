// ============================================================
// حسابات الراتب — Salary Calculator v6.2
// ============================================================
import type { AttendanceRecord, AppSettings, SalaryBreakdown } from '../types';
import { MONTHS_ARABIC } from '../constants';

/**
 * يحسب عدد دقائق التأخر أو الأوفرتايم لسجل حضور
 */
export function calcMinutes(
  checkIn: string,
  checkOut: string | undefined,
  settings: AppSettings
): { lateMinutes: number; overtimeMinutes: number } {
  const [startH, startM] = settings.workStartTime.split(':').map(Number);
  const [endH, endM] = settings.workEndTime.split(':').map(Number);
  const [inH, inM] = checkIn.split(':').map(Number);

  const workStartMin = startH * 60 + startM;
  const workEndMin = endH * 60 + endM;
  const checkInMin = inH * 60 + inM;

  // التأخر
  let lateMinutes = 0;
  const lateDiff = checkInMin - workStartMin;
  if (lateDiff > settings.lateGracePeriod) {
    lateMinutes = settings.roundMinutesTo > 1
      ? Math.ceil(lateDiff / settings.roundMinutesTo) * settings.roundMinutesTo
      : lateDiff;
  }

  // الأوفرتايم
  let overtimeMinutes = 0;
  if (checkOut) {
    const [outH, outM] = checkOut.split(':').map(Number);
    const checkOutMin = outH * 60 + outM;
    const overtimeDiff = checkOutMin - workEndMin;
    if (overtimeDiff >= settings.overtimeMinThreshold) {
      overtimeMinutes = settings.roundMinutesTo > 1
        ? Math.floor(overtimeDiff / settings.roundMinutesTo) * settings.roundMinutesTo
        : overtimeDiff;
    }
  }

  return { lateMinutes, overtimeMinutes };
}

/**
 * يحسب نطاق الشهر بناءً على يوم بدء الشهر
 */
export function getMonthRange(year: number, month: number, monthStartDay: number): {
  start: Date;
  end: Date;
  label: string;
} {
  // الشهر 0-based في JS
  const start = new Date(year, month - 1, monthStartDay);
  const end = new Date(year, month, monthStartDay - 1);

  // label مثل "مارس 2025"
  const label = `${MONTHS_ARABIC[end.getMonth()]} ${end.getFullYear()}`;

  return { start, end, label };
}

/**
 * يحصل على شهر الراتب الحالي
 */
export function getCurrentPayrollPeriod(monthStartDay: number): {
  start: Date;
  end: Date;
  label: string;
} {
  const today = new Date();
  const d = today.getDate();
  const m = today.getMonth() + 1; // 1-based
  const y = today.getFullYear();

  if (d >= monthStartDay) {
    // الشهر الحالي: من monthStartDay هذا الشهر إلى monthStartDay-1 الشهر القادم
    return getMonthRange(y, m, monthStartDay);
  } else {
    // لسه في الشهر السابق
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    return getMonthRange(prevYear, prevMonth, monthStartDay);
  }
}

/**
 * يحسب عدد أيام العمل الفعلية في فترة
 */
export function countWorkingDays(
  start: Date,
  end: Date,
  weeklyOffDay: number,
  weeklyOffDay2: number,
  officialHolidayDates: string[]
): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const dateStr = cur.toISOString().slice(0, 10);
    const isOff = dow === weeklyOffDay || (weeklyOffDay2 >= 0 && dow === weeklyOffDay2);
    const isHoliday = officialHolidayDates.includes(dateStr);
    if (!isOff && !isHoliday) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * الحساب الرئيسي للراتب
 */
export function calculateSalary(
  records: AttendanceRecord[],
  settings: AppSettings,
  periodStart: Date,
  periodEnd: Date,
  officialHolidayDates: string[]
): SalaryBreakdown {
  // تصفية السجلات للفترة
  const periodRecords = records.filter(r => {
    const d = new Date(r.date);
    return d >= periodStart && d <= periodEnd;
  });

  // عدد أيام العمل الفعلية (بدون العطلات)
  const workingDays = countWorkingDays(
    periodStart,
    periodEnd,
    settings.weeklyOffDay,
    settings.weeklyOffDay2 ?? -1,
    officialHolidayDates
  );

  if (workingDays === 0) {
    return {
      baseSalary: 0,
      transportAllowance: 0,
      overtimePay: 0,
      lateDeduction: 0,
      absenceDeduction: 0,
      unpaidLeaveDeduction: 0,
      insuranceDeduction: 0,
      taxDeduction: 0,
      netSalary: 0,
      workingDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      overtimeHours: 0,
      sickLeaveDays: 0,
      annualLeaveDays: 0,
      unpaidLeaveDays: 0,
    };
  }

  // يومية العمل
  const dailyRate = settings.baseSalary / workingDays;
  // معدل الدقيقة
  const minuteRate = dailyRate / (getWorkDurationMinutes(settings.workStartTime, settings.workEndTime));

  // إحصائيات
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let totalLateMinutes = 0;
  let totalOvertimeMinutes = 0;
  let sickLeaveDays = 0;
  let annualLeaveDays = 0;
  let unpaidLeaveDays = 0;

  periodRecords.forEach(r => {
    switch (r.dayType) {
      case 'present':
        presentDays++;
        break;
      case 'late':
        presentDays++;
        lateDays++;
        totalLateMinutes += r.lateMinutes;
        break;
      case 'absent':
        absentDays++;
        break;
      case 'sick_leave':
        sickLeaveDays++;
        presentDays++; // مدفوع
        break;
      case 'annual_leave':
        annualLeaveDays++;
        presentDays++; // مدفوع
        break;
      case 'unpaid_leave':
        unpaidLeaveDays++;
        break;
      case 'official_holiday':
        presentDays++; // مدفوع
        break;
      // holiday, holiday — لا تحتسب
    }
    totalOvertimeMinutes += r.overtimeMinutes ?? 0;
  });

  // خصومات
  const absenceDeduction = absentDays * dailyRate * settings.absenceDeductionMultiplier;
  const lateDeduction = totalLateMinutes * minuteRate * settings.lateDeductionMultiplier;
  const unpaidLeaveDeduction = unpaidLeaveDays * dailyRate;

  // أوفرتايم
  const overtimeMinuteRate = minuteRate * settings.overtimeMultiplier;
  const overtimePay = totalOvertimeMinutes * overtimeMinuteRate;

  // الراتب الإجمالي قبل الخصومات الإلزامية
  const grossSalary = settings.baseSalary + settings.transportAllowance + overtimePay
    - absenceDeduction - lateDeduction - unpaidLeaveDeduction;

  // تأمين وضريبة
  const insuranceDeduction = settings.insuranceEnabled
    ? Math.max(0, (settings.baseSalary * settings.insuranceRate) / 100)
    : 0;
  const taxDeduction = settings.taxEnabled
    ? Math.max(0, (grossSalary * settings.taxRate) / 100)
    : 0;

  const netSalary = Math.max(0, grossSalary - insuranceDeduction - taxDeduction);

  return {
    baseSalary: settings.baseSalary,
    transportAllowance: settings.transportAllowance,
    overtimePay: roundTo2(overtimePay),
    lateDeduction: roundTo2(lateDeduction),
    absenceDeduction: roundTo2(absenceDeduction),
    unpaidLeaveDeduction: roundTo2(unpaidLeaveDeduction),
    insuranceDeduction: roundTo2(insuranceDeduction),
    taxDeduction: roundTo2(taxDeduction),
    netSalary: roundTo2(netSalary),
    workingDays,
    presentDays,
    absentDays,
    lateDays,
    overtimeHours: roundTo2(totalOvertimeMinutes / 60),
    sickLeaveDays,
    annualLeaveDays,
    unpaidLeaveDays,
  };
}

function getWorkDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * تنسيق العملة
 */
export function formatCurrency(amount: number, currency = 'ج.م'): string {
  return `${amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * تنسيق التاريخ بالعربي
 */
export function formatDateAr(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * توليد ID فريد
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * تاريخ اليوم بصيغة YYYY-MM-DD
 */
export function todayStr(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  // Egypt is UTC+2 (or +3 during DST)
  // For simplicity and to avoid DST issues, we can use Intl.DateTimeFormat
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Africa/Cairo', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(d);
}

/**
 * وقت الآن بصيغة HH:MM
 */
export function nowTimeStr(): string {
  return new Intl.DateTimeFormat('en-GB', { 
    timeZone: 'Africa/Cairo', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  }).format(new Date());
}
