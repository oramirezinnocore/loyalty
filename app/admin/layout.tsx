import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAuth } from '@/lib/authorization'

// Allow blocking route for authentication
export const instant = false

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Force dynamic rendering by accessing headers
  // This prevents build-time evaluation when session doesn't exist
  await headers()

  // Server-side authentication check
  try {
    await requireAuth()
  } catch (error) {
    // No session - redirect to login
    redirect('/auth/signin')
  }

  return <>{children}</>
}
