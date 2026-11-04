/**
 * Customer Lookup Service
 *
 * Provides unified lookup for customers by public token,
 * supporting both new (Customer.publicToken) and legacy (Membership.publicToken) tokens
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Find customer by public token (stable across programs)
 *
 * Tries Customer.publicToken first (new stable QR),
 * then falls back to Membership.publicToken (legacy compatibility)
 */
export async function findCustomerByToken(token: string) {
  // Try Customer.publicToken (new stable identifier)
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

  // Fallback: Legacy Membership.publicToken
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

  return customer
}

/**
 * Get active membership for customer
 * Returns membership in ACTIVE program, or most recent if none active
 */
export function getActiveMembership(
  customer: Prisma.CustomerGetPayload<{
    include: {
      memberships: {
        include: {
          loyaltyProgram: true
        }
      }
    }
  }>
) {
  if (!customer.memberships || customer.memberships.length === 0) {
    return null
  }

  // Find membership in ACTIVE program
  const activeMembership = customer.memberships.find(
    m => m.loyaltyProgram.status === 'ACTIVE'
  )

  // Fallback to most recent membership
  return activeMembership || customer.memberships[0]
}

/**
 * Auto-create memberships for all customers when a program activates
 * Called when program status changes to ACTIVE
 */
export async function autoCreateMembershipsForProgram(
  programId: string
) {
  // Get program details
  const program = await prisma.loyaltyProgram.findUnique({
    where: { id: programId },
    include: {
      business: {
        include: {
          customers: {
            include: {
              memberships: {
                where: { loyaltyProgramId: programId }
              }
            }
          }
        }
      }
    }
  })

  if (!program) {
    throw new Error(`Program ${programId} not found`)
  }

  // Find customers who don't have membership yet
  const customersWithoutMembership = program.business.customers.filter(
    c => c.memberships.length === 0
  )

  // Create memberships for all customers without one
  if (customersWithoutMembership.length > 0) {
    await prisma.membership.createMany({
      data: customersWithoutMembership.map(customer => ({
        customerId: customer.id,
        loyaltyProgramId: programId,
        currentPoints: 0,
        lifetimePoints: 0,
        isActive: true
        // publicToken NOT set - Customer.publicToken is used
      })),
      skipDuplicates: true // In case of race conditions
    })
  }

  return {
    totalCustomers: program.business.customers.length,
    membershipsCreated: customersWithoutMembership.length
  }
}
