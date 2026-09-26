import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import pino from 'pino';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false },
      });
      logger.info({ url }, 'Connected to Supabase client');
      return supabaseInstance;
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Supabase client');
      return null;
    }
  }

  return null;
}
