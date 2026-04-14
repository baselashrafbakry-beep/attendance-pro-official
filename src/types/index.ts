// ============================================================
// Types — Attendance & Salary Tracker v6.2
// ============================================================

export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  loginEmail?: string;
  authUserId?: string;
  name: string;
  role: UserRole;
  department?: string;
  baseSalary: number;
  transportAllowance: number;
  annualLeaveLimit: number;
  sickLeaveLimit: number;
  workStartTime: string; // "HH:MM"
  workEndTime: string;   // "HH:MM"
  weeklyOffDay: number;  // 0=Sun .. 6=Sat
  weeklyOffDay2?: number; // -1 = none
  joinedDate?: string;   // ISO date
  // ميزة النطاق الجغرافي — للمدير فقط
  workLocationLat?: number;   // خط العرض لموقع العمل
  workLocationLng?: number;   // خط الطول لموقع العمل
  workLocationRadius?: number; // النطاق المسموح به بالمتر (افتراضي 100)
  workLocationName?: string;  // اسم وصفي للموقع
}

export type DayType =
  | 'present'
  | 'absent'
  | 'late'
  | 'holiday'
  | 'official_holiday'
  | 'sick_leave'
  | 'annual_leave'
  | 'unpaid_leave';

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;          // "YYYY-MM-DD"
  checkIn?: string;      // "HH:MM"
  checkOut?: string;     // "HH:MM"
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  dayType: DayType;
  lateMinutes: number;
  overtimeMinutes: number;
  note?: string;
  isManualEntry: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  userName: string;
  baseSalary: number;
  transportAllowance: number;
  monthStartDay: number;        // 1-28
  workStartTime: string;        // "HH:MM"
  workEndTime: string;          // "HH:MM"
  weeklyOffDay: number;         // 0-6
  weeklyOffDay2: number;        // -1 = none
  lateDeductionMultiplier: number;
  absenceDeductionMultiplier: number;
  overtimeMultiplier: number;
  lateGracePeriod: number;      // minutes
  overtimeMinThreshold: number; // minutes
  roundMinutesTo: number;       // 1, 5, 10, 15, 30, 60
  insuranceEnabled: boolean;
  insuranceRate: number;        // %
  taxEnabled: boolean;
  taxRate: number;              // %
  requireGPS: boolean;          // enforce location for attendance
  checkTimeCheating: boolean;   // verify device time against server
}

export type LeaveType = 'sick_leave' | 'annual_leave' | 'unpaid_leave' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  reason: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficialHoliday {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  isPaid: boolean;
}

export interface SalaryComparison {
  id: string;
  userId: string;
  monthLabel: string;
  expectedSalary: number;
  receivedSalary: number;
  difference: number;
  date?: string;
  notes?: string;
}

export interface SalaryBreakdown {
  baseSalary: number;
  transportAllowance: number;
  overtimePay: number;
  lateDeduction: number;
  absenceDeduction: number;
  unpaidLeaveDeduction: number;
  insuranceDeduction: number;
  taxDeduction: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  overtimeHours: number;
  sickLeaveDays: number;
  annualLeaveDays: number;
  unpaidLeaveDays: number;
}
