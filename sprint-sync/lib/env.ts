/**
 * Environment variable validation.
 *
 * Reads all required env vars at module load time and throws a descriptive
 * error naming the missing variable if any are absent. This ensures the
 * application fails fast at startup rather than at the point of first use.
 *
 * Validates: Requirements 1.11, 6.4
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please copy .env.local.example to .env.local and fill in the value for ${key}.`
    )
  }
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  DIRECT_URL: requireEnv('DIRECT_URL'),
} as const
