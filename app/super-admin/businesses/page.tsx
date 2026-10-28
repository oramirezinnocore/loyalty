import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { SuperAdminHeader } from '@/components/super-admin-header'
import { BusinessesTable } from './businesses-table'

export const instant = false

interface SearchParams {
  search?: string
  status?: string
  billing?: string
}

export default async function BusinessesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>
}) {
  let session
  try {
    session = await requireSuperAdmin()
  } catch {
    redirect('/auth/signin')
  }

  const user = session.user as any
  const params = await searchParams
  const search = params.search || ''
  const statusFilter = params.status || ''
  const billingFilter = params.billing || ''

  // Build where clause
  const where: any = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } }
    ]
  }

  if (statusFilter && (statusFilter === 'ACTIVE' || statusFilter === 'SUSPENDED')) {
    where.status = statusFilter
  }

  if (billingFilter) {
    where.subscription = {
      status: billingFilter.toUpperCase()
    }
  }

  const businesses = await prisma.business.findMany({
    where,
    include: {
      subscription: true,
      _count: {
        select: {
          customers: true,
          loyaltyPrograms: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminHeader user={{ name: user.name, email: user.email }} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/super-admin" className="text-purple-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Businesses ({businesses.length})</CardTitle>
            <Link
              href="/super-admin/businesses/new"
              className="bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700 text-sm"
            >
              + Create Business
            </Link>
          </CardHeader>
          <CardContent>
            <BusinessesTable
              businesses={businesses}
              initialSearch={search}
              initialStatus={statusFilter}
              initialBilling={billingFilter}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
