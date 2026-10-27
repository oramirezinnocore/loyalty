import { Metadata } from 'next'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { redirect } from 'next/navigation'
import { ProgramBuilder } from '../components/program-builder'

export const metadata: Metadata = {
  title: 'Crear Programa | IntusPath Loyalty'
}

export default async function NewProgramPage() {
  // Auth check
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const user = session.user as any
  const businesses = await getUserBusinesses(user.id, user.role)

  if (businesses.length === 0) {
    redirect('/admin')
  }

  const business = businesses[0]

  return (
    <ProgramBuilder
      mode="create"
      businessName={business.name}
      businessLogoUrl={business.logoUrl}
    />
  )
}
