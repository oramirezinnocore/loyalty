import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { prisma } from '@/lib/prisma'
import { ProgramBuilder } from '../../components/program-builder'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Editar Programa | IntusPath Loyalty'
}

export const instant = false

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProgramPage({ params }: PageProps) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user as any
  const businesses = await getUserBusinesses(user.id, user.role)

  if (businesses.length === 0) {
    redirect('/admin')
  }

  const { id } = await params
  const business = businesses[0]

  // Fetch program with tenant isolation
  const program = await prisma.loyaltyProgram.findFirst({
    where: {
      id,
      businessId: business.id // Tenant isolation: only fetch if owned by this business
    },
    include: {
      rewardDefinitions: {
        where: { isActive: true },
        take: 1
      }
    }
  })

  if (!program) {
    redirect('/admin/program')
  }

  // Block editing ARCHIVED programs
  if (program.status === 'ARCHIVED') {
    redirect('/admin/program')
  }

  const reward = program.rewardDefinitions[0]

  return (
    <ProgramBuilder
      mode="edit"
      program={{
        id: program.id,
        name: program.name,
        description: program.description,
        publicDescription: program.publicDescription,
        programType: program.programType,
        pointsRequired: program.pointsRequired,
        rewardName: reward?.name || '',
        rewardDescription: reward?.description || null,
        termsAndConditions: program.termsAndConditions,
        expirationDays: program.expirationDays,
        status: program.status
      }}
      businessName={business.name}
      businessLogoUrl={business.logoUrl}
    />
  )
}
