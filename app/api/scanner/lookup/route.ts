import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireBusinessAccess } from '@/lib/authorization'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication (session exists)
    const session = await requireAuth()
    const user = session.user as any

    const body = await request.json()
    const { token, businessId } = body

    if (!token || !businessId) {
      return NextResponse.json(
        { error: 'Missing token or businessId' },
        { status: 400 }
      )
    }

    // 2. Verify user has access to this specific business
    await requireBusinessAccess(businessId)

    // Lookup membership
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
          }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verify membership belongs to this business
    if (membership.customer.businessId !== businessId) {
      return NextResponse.json(
        { error: 'Customer does not belong to this business' },
        { status: 403 }
      )
    }

    return NextResponse.json({ membership })
  } catch (error: any) {
    console.error('Scanner lookup error:', error)
    return NextResponse.json(
      { error: error.message || 'Lookup failed' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
