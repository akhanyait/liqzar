import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in your environment.'
    : null;

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'public-anon-key-placeholder',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
