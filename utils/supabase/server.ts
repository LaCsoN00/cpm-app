import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value; // Await cookieStore
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            (await cookieStore).set({ name, value, ...options });
          } catch {
            // The `cookies().set()` method can only be called in a Server Action or Route Handler
            // This error is typically ignored if we're not setting cookies (e.g. from a Server Component)
            // console.warn('Error setting cookie from Server Component:', error);
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            (await cookieStore).set({ name, value: '', ...options });
          } catch {
            // The `cookies().set()` method can only be called in a Server Action or Route Handler
            // This error is typically ignored if we're not setting cookies (e.g. from a Server Component)
            // console.warn('Error removing cookie from Server Component:', error);
          }
        },
      },
    }
  );
}

// Client admin avec SERVICE_ROLE_KEY pour les opérations sensibles
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
