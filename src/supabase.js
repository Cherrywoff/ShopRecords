// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================

import { createClient } from '@supabase/supabase-js';

// Environment variables are prefixed with VITE_ in Vite projects.
// We fallback gracefully to null to allow local offline demo mode if env is not configured yet.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Normalize Supabase URL to prevent double rest/v1 paths if misconfigured on hosting panel
let cleanSupabaseUrl = supabaseUrl.trim();
if (cleanSupabaseUrl.endsWith('/')) {
  cleanSupabaseUrl = cleanSupabaseUrl.slice(0, -1);
}
if (cleanSupabaseUrl.endsWith('/rest/v1')) {
  cleanSupabaseUrl = cleanSupabaseUrl.slice(0, -8);
}
if (cleanSupabaseUrl.endsWith('/')) {
  cleanSupabaseUrl = cleanSupabaseUrl.slice(0, -1);
}

export const isSupabaseConfigured = !!(cleanSupabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(cleanSupabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : {
      // Mock client shell to prevent crashes when not configured
      auth: {
        signUp: async () => ({ data: { user: null }, error: new Error('Supabase not configured. Running in offline demo mode.') }),
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase not configured. Running in offline demo mode.') }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null })
      })
    };

if (!isSupabaseConfigured) {
  console.warn(
    'ShopRecords Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. The app will run in local-only offline mode.'
  );
}
