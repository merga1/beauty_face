import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Beauty Face] Supabase env vars are not set. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Persist session in localStorage so users stay logged in across page refreshes
    persistSession: true,
    // Auto-refresh the access token before it expires
    autoRefreshToken: true,
    // Detect and restore session from URL hash after OAuth / magic-link redirects
    detectSessionInUrl: true,
  },
});
