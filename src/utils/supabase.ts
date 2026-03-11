/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

export let supabase: any;

export const recreateSupabaseClient = () => {
  let client: any = null;
  try {
    if (supabaseUrl && supabaseAnonKey) {
      client = createClient(supabaseUrl, supabaseAnonKey);
    }
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
  }

  supabase = client || {
    auth: {
      getSession: async () => { throw new Error('Supabase not configured'); },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      signInWithPassword: async () => { throw new Error('Supabase not configured'); },
      signUp: async () => { throw new Error('Supabase not configured'); },
      signOut: async () => { throw new Error('Supabase not configured'); }
    },
    from: () => { throw new Error('Supabase not configured'); }
  };
};

// Initialize on load
recreateSupabaseClient();
