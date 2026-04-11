// Shared database connection for Vercel serverless functions
import { neon } from '@neondatabase/serverless';

export function getDb() {
  // Vercel + Neon integration sets multiple env vars — try them in order
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';

  if (!connectionString) {
    throw new Error('No database connection string found. Check Vercel environment variables.');
  }

  return neon(connectionString);
}
