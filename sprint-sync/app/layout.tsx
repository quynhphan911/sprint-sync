import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
// Validate required environment variables at startup — fails fast if any are missing
import '@/lib/env'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SprintSync — Agile Sprint Management for Esoft',
  description:
    'Real-time Sprint Reviews and Retrospectives for Esoft teams. Track increments, gather feedback, run blameless retros, and manage action items.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
