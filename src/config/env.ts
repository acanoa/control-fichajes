const LOCAL_SUPABASE_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function requirePublicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable pública ${name}.`);
  }
  return value;
}

function loadPublicEnv() {
  const supabaseUrl = requirePublicEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = requirePublicEnv('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl.startsWith('https://') && !LOCAL_SUPABASE_URL.test(supabaseUrl)) {
    throw new Error('VITE_SUPABASE_URL debe usar HTTPS fuera del entorno local.');
  }

  if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('No expongas service_role mediante una variable VITE_.');
  }

  return Object.freeze({
    supabaseUrl,
    supabaseAnonKey,
    supabaseSchema: 'Gestion_Fichajes' as const,
  });
}

export const publicEnv = loadPublicEnv();
