/**
 * Loyalty Program Lifecycle - Earning & Redemption Tests
 *
 * Tests program status enforcement:
 * - ACTIVE: earning allowed, redemption allowed
 * - PAUSED: earning blocked, existing AVAILABLE reward redemption allowed
 * - ARCHIVED: earning blocked, redemption blocked
 */

import { prisma } from '@/lib/prisma'
import { LoyaltyProgramStatus, EarnedRewardStatus } from '@prisma/client'
import { registerPurchase, redeemReward } from '@/lib/loyalty-engine'

// Mock billing enforcement
jest.mock('@/lib/billing-enforcement', () => ({
  canPerformLoyaltyOperations: jest.fn(() => Promise.resolve(true))
}))

describe('Loyalty Lifecycle - Earning & Redemption', () => {
  let testBusiness: any
  let testProgram: any
  let testCustomer: any
  let testMembership: any

  beforeAll(async () => {
    // Create test business
    testBusiness = await prisma.business.create({
      data: {
        name: 'Test Lifecycle Business',
        slug: 'test-lifecycle-earning',
        status: 'ACTIVE'
      }
    })

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        businessId: testBusiness.id,
        firstName: 'Test',
        phone: '+1234567890'
      }
    })
  })

  beforeEach(async () => {
    // Clean up programs and related data
    await prisma.loyaltyProgram.deleteMany({
      where: { businessId: testBusiness.id }
    })
  })

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { id: testCustomer.id } })
    await prisma.business.deleteMany({ where: { id: testBusiness.id } })
  })

  describe('ACTIVE Program', () => {
    beforeEach(async () => {
      testProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness.id,
          name: 'Active Program',
          pointsRequired: 3,
          status: LoyaltyProgramStatus.ACTIVE,
          rewardDefinitions: {
            create: {
              name: 'Test Reward',
              pointsRequired: 3
            }
          }
        }
      })

      testMembership = await prisma.membership.create({
        data: {
          customerId: testCustomer.id,
          loyaltyProgramId: testProgram.id
        }
      })
    })

    it('allows earning points', async () => {
      const result = await registerPurchase(
        testMembership.id,
        testBusiness.id,
        100
      )

      expect(result.transaction).toBeDefined()
      expect(result.membership.currentPoints).toBe(1)
    })

    it('allows redeeming AVAILABLE reward', async () => {
      // Earn reward
      await registerPurchase(testMembership.id, testBusiness.id)
      await registerPurchase(testMembership.id, testBusiness.id)
      const earnResult = await registerPurchase(testMembership.id, testBusiness.id)

      expect(earnResult.reachedGoal).toBe(true)
      expect(earnResult.earnedReward).not.toBeNull()

      // Redeem reward
      const redeemResult = await redeemReward(
        earnResult.earnedReward!.id,
        testBusiness.id
      )

      expect(redeemResult.earnedReward.status).toBe(EarnedRewardStatus.REDEEMED)
      expect(redeemResult.redemption).toBeDefined()
    })
  })

  describe('PAUSED Program', () => {
    beforeEach(async () => {
      testProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness.id,
          name: 'Paused Program',
          pointsRequired: 3,
          status: LoyaltyProgramStatus.PAUSED,
          rewardDefinitions: {
            create: {
              name: 'Test Reward',
              pointsRequired: 3
            }
          }
        }
      })

      testMembership = await prisma.membership.create({
        data: {
          customerId: testCustomer.id,
          loyaltyProgramId: testProgram.id
        }
      })
    })

    it('blocks earning new points', async () => {
      await expect(
        registerPurchase(testMembership.id, testBusiness.id, 100)
      ).rejects.toThrow('no está activo')
    })

    it('allows redeeming existing AVAILABLE reward', async () => {
      // Create an AVAILABLE reward (earned before pause)
      const rewardDef = await prisma.rewardDefinition.findFirst({
        where: { loyaltyProgramId: testProgram.id }
      })

      const earnedReward = await prisma.earnedReward.create({
        data: {
          membershipId: testMembership.id,
          rewardDefinitionId: rewardDef!.id,
          status: EarnedRewardStatus.AVAILABLE
        }
      })

      // Redeem should succeed even though program is PAUSED
      const result = await redeemReward(earnedReward.id, testBusiness.id)

      expect(result.earnedReward.status).toBe(EarnedRewardStatus.REDEEMED)
      expect(result.redemption).toBeDefined()
    })
  })

  describe('ARCHIVED Program', () => {
    beforeEach(async () => {
      testProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness.id,
          name: 'Archived Program',
          pointsRequired: 3,
          status: LoyaltyProgramStatus.ARCHIVED,
          rewardDefinitions: {
            create: {
              name: 'Test Reward',
              pointsRequired: 3
            }
          }
        }
      })

      testMembership = await prisma.membership.create({
        data: {
          customerId: testCustomer.id,
          loyaltyProgramId: testProgram.id
        }
      })
    })

    it('blocks earning new points', async () => {
      await expect(
        registerPurchase(testMembership.id, testBusiness.id, 100)
      ).rejects.toThrow('no está activo')
    })

    it('blocks redeeming AVAILABLE reward', async () => {
      // Create an AVAILABLE reward (theoretical historical reward)
      const rewardDef = await prisma.rewardDefinition.findFirst({
        where: { loyaltyProgramId: testProgram.id }
      })

      const earnedReward = await prisma.earnedReward.create({
        data: {
          membershipId: testMembership.id,
          rewardDefinitionId: rewardDef!.id,
          status: EarnedRewardStatus.AVAILABLE
        }
      })

      // Redemption should fail for ARCHIVED program
      await expect(
        redeemReward(earnedReward.id, testBusiness.id)
      ).rejects.toThrow('finalizado')
    })
  })

  describe('REDEEMED Reward', () => {
    beforeEach(async () => {
      testProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness.id,
          name: 'Active Program',
          pointsRequired: 3,
          status: LoyaltyProgramStatus.ACTIVE,
          rewardDefinitions: {
            create: {
              name: 'Test Reward',
              pointsRequired: 3
            }
          }
        }
      })

      testMembership = await prisma.membership.create({
        data: {
          customerId: testCustomer.id,
          loyaltyProgramId: testProgram.id
        }
      })
    })

    it('cannot redeem already REDEEMED reward', async () => {
      // Earn reward
      await registerPurchase(testMembership.id, testBusiness.id)
      await registerPurchase(testMembership.id, testBusiness.id)
      const earnResult = await registerPurchase(testMembership.id, testBusiness.id)

      const earnedRewardId = earnResult.earnedReward!.id

      // Redeem once
      await redeemReward(earnedRewardId, testBusiness.id)

      // Try to redeem again
      await expect(
        redeemReward(earnedRewardId, testBusiness.id)
      ).rejects.toThrow('not available')
    })
  })
})
