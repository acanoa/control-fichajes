import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
}

if (!supabaseUrl.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(supabaseUrl)) {
  throw new Error('Supabase debe utilizar HTTPS fuera del entorno local.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'Gestion_Fichajes'
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cf_admin_auth'
  }
});
