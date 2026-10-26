import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { EditProgramForm } from './edit-program-form'

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
  const businessId = businesses[0].id

  // Fetch program with tenant isolation
  const program = await prisma.loyaltyProgram.findFirst({
    where: {
      id,
      businessId // Tenant isolation: only fetch if owned by this business
    },
    include: {
      rewardDefinitions: {
        where: { isActive: true }
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin/program" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al programa
          </Link>
          <h1 className="text-2xl font-bold">Editar programa</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <EditProgramForm
          program={{
            id: program.id,
            name: program.name,
            description: program.description || '',
            publicDescription: program.publicDescription || '',
            pointsRequired: program.pointsRequired,
            rewardName: reward?.name || '',
            rewardDescription: reward?.description || ''
          }}
        />
      </div>
    </div>
  )
}
