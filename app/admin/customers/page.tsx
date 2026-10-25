import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

export const instant = false

export default async function CustomersPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user as any
  const businesses = await getUserBusinesses(user.id, user.role)

  if (businesses.length === 0) {
    redirect('/admin')
  }

  const business = businesses[0]

  const customers = await prisma.customer.findMany({
    where: { businessId: business.id },
    include: {
      memberships: {
        include: {
          _count: {
            select: {
              transactions: true,
              earnedRewards: {
                where: { status: 'AVAILABLE' }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Lista de clientes ({customers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {customers.length > 0 ? (
              <div className="space-y-2">
                {customers.map(customer => {
                  const membership = customer.memberships[0]
                  const transactionCount = membership?._count.transactions || 0
                  const availableRewards = membership?._count.earnedRewards || 0

                  return (
                    <div
                      key={customer.id}
                      className="flex justify-between items-center p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          {customer.firstName} {customer.lastName || ''}
                        </p>
                        <p className="text-sm text-gray-600">{customer.phone}</p>
                        {customer.email && (
                          <p className="text-sm text-gray-600">{customer.email}</p>
                        )}
                      </div>

                      {membership && (
                        <div className="flex gap-6 text-center">
                          <div>
                            <p className="text-2xl font-bold text-blue-600">
                              {membership.currentPoints}
                            </p>
                            <p className="text-xs text-gray-600">Progreso</p>
                          </div>

                          <div>
                            <p className="text-2xl font-bold text-green-600">
                              {availableRewards}
                            </p>
                            <p className="text-xs text-gray-600">Recompensas</p>
                          </div>

                          <div>
                            <p className="text-2xl font-bold text-purple-600">
                              {transactionCount}
                            </p>
                            <p className="text-xs text-gray-600">Transacciones</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay clientes todavía
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
