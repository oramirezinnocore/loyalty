import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { AdminHeader } from '@/components/admin-header'

export const instant = false

async function getBusinessStats(businessId: string) {
  // Direct database access instead of HTTP fetch
  // Server Component already has auth context, no need for internal API call
  try {
    const [
      customerCount,
      transactionCount,
      availableRewardsCount,
      redeemedRewardsCount,
      recentTransactions
    ] = await Promise.all([
      prisma.customer.count({ where: { businessId } }),
      prisma.transaction.count({
        where: {
          membership: {
            customer: {
              businessId
            }
          }
        }
      }),
      prisma.earnedReward.count({
        where: {
          status: 'AVAILABLE',
          membership: {
            customer: {
              businessId
            }
          }
        }
      }),
      prisma.earnedReward.count({
        where: {
          status: 'REDEEMED',
          membership: {
            customer: {
              businessId
            }
          }
        }
      }),
      prisma.transaction.findMany({
        where: {
          membership: {
            customer: {
              businessId
            }
          }
        },
        include: {
          membership: {
            include: {
              customer: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    return {
      stats: {
        customers: customerCount,
        transactions: transactionCount,
        availableRewards: availableRewardsCount,
        redeemedRewards: redeemedRewardsCount
      },
      recentTransactions
    }
  } catch (error) {
    console.error('Stats fetch error:', error)
    return null
  }
}

export default async function AdminDashboard() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user as any
  const businesses = await getUserBusinesses(user.id, user.role)

  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Sin negocios asignados</h1>
          <p>No tienes acceso a ningún negocio.</p>
        </div>
      </div>
    )
  }

  const business = businesses[0]
  const stats = await getBusinessStats(business.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        businessName={business.name}
        title="Panel de administración"
        showNavigation={true}
        user={{
          name: user.name,
          email: user.email
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-blue-600">
                {stats?.stats.customers || 0}
              </div>
              <p className="text-sm text-gray-600 mt-1">Clientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-green-600">
                {stats?.stats.transactions || 0}
              </div>
              <p className="text-sm text-gray-600 mt-1">Transacciones</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-orange-600">
                {stats?.stats.availableRewards || 0}
              </div>
              <p className="text-sm text-gray-600 mt-1">Recompensas disponibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-purple-600">
                {stats?.stats.redeemedRewards || 0}
              </div>
              <p className="text-sm text-gray-600 mt-1">Recompensas canjeadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transacciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              <div className="space-y-2">
                {stats.recentTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {tx.membership.customer.firstName} {tx.membership.customer.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-600">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">+{tx.points} pts</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay transacciones todavía
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Link href="/admin/customers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="font-semibold">Ver clientes</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/rewards">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-2">🎁</div>
                <p className="font-semibold">Gestionar recompensas</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-2">⚙️</div>
                <p className="font-semibold">Configuración</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
