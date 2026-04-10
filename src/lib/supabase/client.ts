// ============================================================
// Supabase Client — Attendance & Salary Tracker v6.2
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback public config keeps cloud mode enabled when deploy env vars are missing.
const FALLBACK_SUPABASE_URL = 'https://osaalxaptfshgdlefilx.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zYWFseGFwdGZzaGdkbGVmaWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODA1OTYsImV4cCI6MjA5MTA1NjU5Nn0.OOXJptgYoY9Od5Os0GJLFv5uzCcR0aU4gtn0KWgMnkc';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

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
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: { 'x-app-name': 'attendance-salary-tracker' },
      },
    });
  }
  return _supabase;
})();

export default supabase;
