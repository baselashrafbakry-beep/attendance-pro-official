// ============================================================
// Seed Data للاختبار في وضع Offline
// يُشغَّل مرة واحدة فقط عند أول تشغيل
// ============================================================
import type { User } from '../types';
import { STORAGE_KEYS } from '../constants';

const SEED_KEY = 'ast_seeded_v631';

export function seedOfflineData() {
  if (localStorage.getItem(SEED_KEY)) return; // Already seeded

  const defaultUsers: User[] = [
    {
      id: 'admin',
      username: 'admin',
      name: 'مدير النظام',
      role: 'admin',
      department: 'الإدارة',
      baseSalary: 0,
      transportAllowance: 0,
      annualLeaveLimit: 21,
      sickLeaveLimit: 15,
      workStartTime: '09:00',
      workEndTime: '17:00',
      weeklyOffDay: 5,
      weeklyOffDay2: 6,
    },
    {
      id: 'basel',
      username: 'basel2026',
      name: 'باسل أشرف',
      role: 'employee',
      department: 'Stock Controller',
      baseSalary: 5000,
      transportAllowance: 500,
      annualLeaveLimit: 21,
      sickLeaveLimit: 15,
      workStartTime: '09:00',
      workEndTime: '17:00',
      weeklyOffDay: 5,
      weeklyOffDay2: 6,
    },
  ];

  // Seed users
  const existingUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!existingUsers || JSON.parse(existingUsers).length === 0) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
  }

  // Seed hashed passwords (sha256)
  const passwords = {
    admin: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    basel: 'c9d5e321a841f479afaef61463153eebef0d645d8787af0b25e267fdc4d58f38',
  };
  localStorage.setItem('ast_passwords', JSON.stringify(passwords));

  // Mark as seeded
  localStorage.setItem(SEED_KEY, '1');
}
