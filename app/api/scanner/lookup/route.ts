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

    // Lookup customer by publicToken (stable identifier across programs)
    // Try Customer.publicToken first (new stable QR), then fall back to Membership.publicToken (legacy)
    let customer = await prisma.customer.findUnique({
      where: { publicToken: token },
      include: {
        business: true,
        memberships: {
          include: {
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
        }
      }
    })

    // Fallback: Legacy lookup by Membership.publicToken (for backwards compatibility)
    if (!customer) {
      const legacyMembership = await prisma.membership.findUnique({
        where: { publicToken: token },
        include: {
          customer: {
            include: {
              business: true,
              memberships: {
                include: {
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
              }
            }
          }
        }
      })

      if (legacyMembership) {
        customer = legacyMembership.customer
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verify customer belongs to this business
    if (customer.businessId !== businessId) {
      return NextResponse.json(
        { error: 'Customer does not belong to this business' },
        { status: 403 }
      )
    }

    // Get active program membership (or most recent if no active)
    const activeMembership = customer.memberships.find(
      m => m.loyaltyProgram.status === 'ACTIVE'
    ) || customer.memberships[0]

    if (!activeMembership) {
      return NextResponse.json(
        { error: 'Customer has no active membership' },
        { status: 404 }
      )
    }

    // Return membership with same structure as before for compatibility
    const membership = activeMembership

    return NextResponse.json({ membership })
  } catch (error: any) {
    console.error('Scanner lookup error:', error)
    return NextResponse.json(
      { error: error.message || 'Lookup failed' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
