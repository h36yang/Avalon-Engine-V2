/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

let client: any = null;
try {
  if (supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (err) {
  console.warn('Failed to initialize Supabase client:', err);
}

// Export a proxy or the client directly. 
// If we export null, calling supabase.auth will throw.
// We can export a dummy object that throws a clear error when used, 
// or just export the client and let the try/catch in App.tsx handle the TypeError.
export const supabase = client || {
  auth: {
    getSession: async () => { throw new Error('Supabase not configured'); },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    signInWithPassword: async () => { throw new Error('Supabase not configured'); },
    signUp: async () => { throw new Error('Supabase not configured'); },
    signOut: async () => { throw new Error('Supabase not configured'); }
  },
  from: () => { throw new Error('Supabase not configured'); }
};
