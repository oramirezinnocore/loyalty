import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authorization'

/**
 * Root page with intelligent routing based on authentication
 *
 * - Unauthenticated → /auth/signin
 * - SUPER_ADMIN → /super-admin
 * - BUSINESS_ADMIN → /admin
 */
export const instant = false

export default async function RootPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userRole = (session.user as any).role

  if (userRole === 'SUPER_ADMIN') {
    redirect('/super-admin')
  }

  if (userRole === 'BUSINESS_ADMIN') {
    redirect('/admin')
  }

  // Fallback for unknown roles
  redirect('/auth/signin')
}
