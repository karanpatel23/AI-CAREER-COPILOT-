/**
 * Supabase Admin Client
 *
 * Initializes a Supabase client using the service role key for server-side operations.
 * Environment variables are validated at import time so misconfiguration fails clearly.
 */

import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export const supabaseAdmin = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
