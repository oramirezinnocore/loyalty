import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import RedeemButton from './redeem-button'

export const instant = false

export default async function RewardsPage() {
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

  const [availableRewards, redeemedRewards] = await Promise.all([
    prisma.earnedReward.findMany({
      where: {
        status: 'AVAILABLE',
        membership: {
          customer: {
            businessId: business.id
          }
        }
      },
      include: {
        membership: {
          include: {
            customer: true
          }
        },
        rewardDefinition: true
      },
      orderBy: { earnedAt: 'desc' }
    }),
    prisma.earnedReward.findMany({
      where: {
        status: 'REDEEMED',
        membership: {
          customer: {
            businessId: business.id
          }
        }
      },
      include: {
        membership: {
          include: {
            customer: true
          }
        },
        rewardDefinition: true,
        redemption: true
      },
      orderBy: { redeemedAt: 'desc' },
      take: 20
    })
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold">Gestión de recompensas</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Available Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Recompensas disponibles ({availableRewards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {availableRewards.length > 0 ? (
              <div className="space-y-2">
                {availableRewards.map(reward => (
                  <div
                    key={reward.id}
                    className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">
                        {reward.membership.customer.firstName} {reward.membership.customer.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-600">{reward.rewardDefinition.name}</p>
                      <p className="text-xs text-gray-500">
                        Ganado: {formatDateTime(reward.earnedAt)}
                      </p>
                    </div>
                    <RedeemButton rewardId={reward.id} businessId={business.id} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay recompensas disponibles
              </p>
            )}
          </CardContent>
        </Card>

        {/* Redeemed Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Recompensas canjeadas</CardTitle>
          </CardHeader>
          <CardContent>
            {redeemedRewards.length > 0 ? (
              <div className="space-y-2">
                {redeemedRewards.map(reward => (
                  <div
                    key={reward.id}
                    className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">
                        {reward.membership.customer.firstName} {reward.membership.customer.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-600">{reward.rewardDefinition.name}</p>
                      <p className="text-xs text-gray-500">
                        Canjeado: {reward.redeemedAt ? formatDateTime(reward.redeemedAt) : 'N/A'}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                      Canjeado
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay recompensas canjeadas todavía
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
