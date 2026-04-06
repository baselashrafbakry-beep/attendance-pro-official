// ============================================================
// Supabase Client — Attendance & Salary Tracker v6.2
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.length > 10 &&
    SUPABASE_ANON_KEY.length > 10 &&
    SUPABASE_URL.startsWith('https://')
  );
}

let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = (() => {
  if (!isSupabaseConfigured()) {
    // Dummy client - won't actually connect
    return createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      { auth: { persistSession: false } }
    );
  }
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { 'x-app-name': 'attendance-salary-tracker' },
      },
    });
  }
  return _supabase;
})();

export default supabase;
