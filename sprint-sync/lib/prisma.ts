import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Uses the globalThis pattern to prevent multiple PrismaClient instances
 * during Next.js hot-reloading in development. In production, a single
 * instance is created per process.
 *
 * Guards against missing DATABASE_URL with a descriptive startup error.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Missing required environment variable: DATABASE_URL\n' +
      'Please copy .env.local.example to .env.local and fill in the DATABASE_URL value.'
  )
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
