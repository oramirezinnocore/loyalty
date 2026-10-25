import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const membership = await prisma.membership.findUnique({
      where: { publicToken: token },
      include: {
        customer: true,
        loyaltyProgram: {
          include: {
            business: true,
            rewardDefinitions: {
              where: { isActive: true }
            }
          }
        },
        earnedRewards: {
          where: { status: 'AVAILABLE' },
          include: {
            rewardDefinition: true
          },
          orderBy: { earnedAt: 'desc' }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ membership })
  } catch (error) {
    console.error('Wallet fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    )
  }
}
