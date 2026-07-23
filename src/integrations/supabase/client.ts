import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '../../config/env';
import type { Database } from './database.types';

export const supabase = createClient<Database, 'Gestion_Fichajes'>(
  publicEnv.supabaseUrl,
  publicEnv.supabaseAnonKey,
  {
    db: {
      schema: publicEnv.supabaseSchema,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cf_admin_auth',
    },
  },
);
