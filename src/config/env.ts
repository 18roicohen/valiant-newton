import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
  // Supabase Database Connection
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  
  // LLM / Self-Healing Configuration
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'gemini', 'litellm', 'mock']).default('mock'),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_MAX_TOKENS: z.coerce.number().default(2048),
  LLM_TEMPERATURE: z.coerce.number().default(0.1),

  // Billing & Webhook Secrets
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  
  // API Defaults
  ADMIN_API_KEY: z.string().default('daas_admin_secret_key_2026'),
  DEFAULT_MONTHLY_QUOTA: z.coerce.number().default(1000),
  DEFAULT_RATE_LIMIT_RPM: z.coerce.number().default(60),

  // Alert Notifications
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  NTFY_TOPIC: z.string().default('dynep_alerts'),
  NTFY_URL: z.string().default('https://ntfy.sh'),
  ENABLE_CRON_SCHEDULER: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = loadEnv();
