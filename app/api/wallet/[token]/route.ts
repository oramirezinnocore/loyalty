import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLogoUrl } from '@/lib/utils/logo-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Try Customer.publicToken first (new stable QR)
    let customer = await prisma.customer.findUnique({
      where: { publicToken: token },
      include: {
        business: true,
        memberships: {
          where: { isActive: true },
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
              },
              orderBy: { earnedAt: 'desc' }
            },
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // Fallback: Legacy Membership.publicToken lookup
    if (!customer) {
      const legacyMembership = await prisma.membership.findUnique({
        where: { publicToken: token },
        include: {
          customer: {
            include: {
              business: true,
              memberships: {
                where: { isActive: true },
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
                    },
                    orderBy: { earnedAt: 'desc' }
                  },
                  transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                  }
                },
                orderBy: { createdAt: 'desc' }
              }
            }
          }
        }
      })

      if (legacyMembership) {
        customer = legacyMembership.customer
      }
    }

    if (!customer || customer.memberships.length === 0) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    // Show active program membership (or most recent)
    const membership = customer.memberships.find(
      m => m.loyaltyProgram.status === 'ACTIVE'
    ) || customer.memberships[0]

    // Normalize business logoUrl to ensure it's a public API URL
    const normalizedMembership = {
      ...membership,
      loyaltyProgram: {
        ...membership.loyaltyProgram,
        business: {
          ...membership.loyaltyProgram.business,
          logoUrl: normalizeLogoUrl(
            membership.loyaltyProgram.business.logoUrl,
            membership.loyaltyProgram.business.id
          )
        }
      }
    }

    return NextResponse.json({ membership: normalizedMembership })
  } catch (error) {
    console.error('Wallet fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    )
  }
}
