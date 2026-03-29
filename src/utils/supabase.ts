/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables - using development mock auth');
}

export let supabase: any;
export let isAuthBypassEnabled = !supabaseUrl || !supabaseAnonKey;

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
      getSession: async () => { 
        if (isAuthBypassEnabled) {
          // Return a mock session for development
          return {
            data: {
              session: {
                user: {
                  id: 'dev-user-' + localStorage.getItem('devUserId') || 'dev-user-001',
                  email: localStorage.getItem('devUserEmail') || 'dev@local.test'
                }
              }
            },
            error: null
          };
        }
        throw new Error('Supabase not configured');
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      signInWithPassword: async (credentials: any) => {
        if (isAuthBypassEnabled) {
          localStorage.setItem('devUserId', 'dev-user-001');
          localStorage.setItem('devUserEmail', credentials.email);
          return {
            data: {
              session: {
                user: {
                  id: 'dev-user-001',
                  email: credentials.email
                }
              },
              user: { id: 'dev-user-001', email: credentials.email }
            },
            error: null
          };
        }
        throw new Error('Supabase not configured');
      },
      signUp: async (credentials: any) => {
        if (isAuthBypassEnabled) {
          localStorage.setItem('devUserId', 'dev-user-' + Date.now());
          localStorage.setItem('devUserEmail', credentials.email);
          return {
            data: {
              session: {
                user: {
                  id: 'dev-user-' + Date.now(),
                  email: credentials.email
                }
              },
              user: { id: 'dev-user-' + Date.now(), email: credentials.email }
            },
            error: null
          };
        }
        throw new Error('Supabase not configured');
      },
      signOut: async () => { 
        localStorage.removeItem('devUserId');
        localStorage.removeItem('devUserEmail');
        return { error: null };
      }
    },
    from: () => { throw new Error('Supabase not configured'); }
  };
};

// Initialize on load
recreateSupabaseClient();
