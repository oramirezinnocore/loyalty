import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess } from '@/lib/authorization'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params

    // Verify user has access to this business
    await requireBusinessAccess(businessId)

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

    return NextResponse.json({
      stats: {
        customers: customerCount,
        transactions: transactionCount,
        availableRewards: availableRewardsCount,
        redeemedRewards: redeemedRewardsCount
      },
      recentTransactions
    })
  } catch (error: any) {
    console.error('Stats fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: error.message?.includes('Unauthorized') ? 403 : 500 }
    )
  }
}
