/**
 * Loyalty Program E2E Integration Tests
 *
 * Tests complete flow from business creation through customer enrollment:
 * 1. Program creation by BUSINESS_ADMIN
 * 2. Acquisition QR generation
 * 3. Customer registration via /join
 * 4. Wallet creation
 * 5. Purchase progression
 * 6. Reward generation
 * 7. Redemption
 * 8. Tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient, LoyaltyProgramStatus, EarnedRewardStatus } from '@prisma/client'
import { createLoyaltyProgram, updateProgramStatus } from '@/app/actions/loyalty-program'
import { registerPurchase, redeemReward } from '@/lib/loyalty-engine'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Mock authentication - define session inline
jest.mock('@/lib/authorization', () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: 'test-business-admin', role: 'BUSINESS_ADMIN' }
  }),
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'test-business-admin', role: 'BUSINESS_ADMIN' }
  }),
  requireSuperAdmin: jest.fn().mockResolvedValue(undefined),
  requireBusinessAccess: jest.fn().mockResolvedValue({
    user: { id: 'test-business-admin', role: 'BUSINESS_ADMIN' }
  }),
  getUserBusinesses: jest.fn().mockResolvedValue([
    { id: 'test-business-1', name: 'Test Business', slug: 'test-business' }
  ])
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Loyalty Program E2E', () => {
  let businessId: string
  let userId: string
  let programId: string
  let membershipId: string
  let customerId: string

  beforeAll(async () => {
    // Create test business
    const business = await prisma.business.create({
      data: {
        name: 'Test Loyalty Business',
        slug: 'test-loyalty-business',
        status: 'ACTIVE'
      }
    })
    businessId = business.id

    // Create test admin user
    const user = await prisma.user.create({
      data: {
        email: 'admin@testloyalty.com',
        name: 'Test Admin',
        passwordHash: await bcrypt.hash('TestPassword123', 12),
        role: 'BUSINESS_ADMIN'
      }
    })
    userId = user.id

    // Create BusinessUser relationship
    await prisma.businessUser.create({
      data: {
        businessId,
        userId
      }
    })

    // Create subscription
    await prisma.subscription.create({
      data: {
        businessId,
        status: 'ACTIVE',
        priceMonthlyMXN: 299
      }
    })

    // Update mock to return actual business
    const { getUserBusinesses } = require('@/lib/authorization')
    getUserBusinesses.mockResolvedValue([
      { id: businessId, name: business.name, slug: business.slug }
    ])
  })

  afterAll(async () => {
    // Cleanup
    await prisma.business.deleteMany({
      where: { slug: { in: ['test-loyalty-business', 'test-tenant-isolation'] } }
    })
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@testloyalty.com', 'admin@isolation.com'] } }
    })
    await prisma.$disconnect()
  })

  describe('Program Creation', () => {
    it('should create program with reward definition atomically', async () => {
      const result = await createLoyaltyProgram({
        name: 'Cliente Frecuente Test',
        description: 'Términos y condiciones',
        publicDescription: 'Completa 5 compras y recibe 1 churro gratis',
        pointsRequired: 5,
        rewardName: '1 churro gratis',
        rewardDescription: 'Muestra este cupón al personal',
        status: LoyaltyProgramStatus.ACTIVE
      })

      expect(result.success).toBe(true)
      expect(result.programId).toBeDefined()

      programId = result.programId!

      // Verify program created
      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: programId },
        include: {
          rewardDefinitions: true
        }
      })

      expect(program).not.toBeNull()
      expect(program!.name).toBe('Cliente Frecuente Test')
      expect(program!.pointsRequired).toBe(5)
      expect(program!.status).toBe(LoyaltyProgramStatus.ACTIVE)
      expect(program!.businessId).toBe(businessId)

      // Verify reward definition created
      expect(program!.rewardDefinitions).toHaveLength(1)
      const reward = program!.rewardDefinitions[0]
      expect(reward.name).toBe('1 churro gratis')
      expect(reward.pointsRequired).toBe(5)
      expect(reward.isActive).toBe(true)
    })

    it('should reject second ACTIVE program', async () => {
      const result = await createLoyaltyProgram({
        name: 'Second Program',
        pointsRequired: 10,
        rewardName: 'Second Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors?.status).toContain('Ya existe un programa activo')
    })

    it('should validate required fields', async () => {
      const result = await createLoyaltyProgram({
        name: '',
        pointsRequired: 0,
        rewardName: ''
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors?.name).toBeDefined()
      expect(result.fieldErrors?.pointsRequired).toBeDefined()
      expect(result.fieldErrors?.rewardName).toBeDefined()
    })

    it('should validate goal bounds', async () => {
      // Too low
      const result1 = await createLoyaltyProgram({
        name: 'Test',
        pointsRequired: 0,
        rewardName: 'Reward'
      })
      expect(result1.success).toBe(false)
      expect(result1.fieldErrors?.pointsRequired).toContain('al menos 1')

      // Too high
      const result2 = await createLoyaltyProgram({
        name: 'Test',
        pointsRequired: 101,
        rewardName: 'Reward'
      })
      expect(result2.success).toBe(false)
      expect(result2.fieldErrors?.pointsRequired).toContain('no puede exceder 100')
    })
  })

  describe('Program Management', () => {
    it('should update program status', async () => {
      // Pause program
      const pauseResult = await updateProgramStatus(programId, LoyaltyProgramStatus.PAUSED)
      expect(pauseResult.success).toBe(true)

      const paused = await prisma.loyaltyProgram.findUnique({
        where: { id: programId }
      })
      expect(paused!.status).toBe(LoyaltyProgramStatus.PAUSED)

      // Reactivate
      const activateResult = await updateProgramStatus(programId, LoyaltyProgramStatus.ACTIVE)
      expect(activateResult.success).toBe(true)

      const active = await prisma.loyaltyProgram.findUnique({
        where: { id: programId }
      })
      expect(active!.status).toBe(LoyaltyProgramStatus.ACTIVE)
    })

    it('should reject duplicate status', async () => {
      const result = await updateProgramStatus(programId, LoyaltyProgramStatus.ACTIVE)
      expect(result.success).toBe(false)
      expect(result.error).toContain('ya tiene este estado')
    })
  })

  describe('Customer Enrollment', () => {
    it('should create customer and membership', async () => {
      // Simulate customer registration
      const customer = await prisma.customer.create({
        data: {
          businessId,
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+52 55 1234 5678'
        }
      })
      customerId = customer.id

      const membership = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: programId,
          currentPoints: 0,
          lifetimePoints: 0
        }
      })
      membershipId = membership.id

      expect(membership.publicToken).toBeDefined()
      expect(membership.publicToken).toHaveLength(25) // CUID length
      expect(membership.currentPoints).toBe(0)
      expect(membership.isActive).toBe(true)
    })

    it('should use secure public token (not DB ID)', async () => {
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId }
      })

      // Verify publicToken is not the DB ID
      expect(membership!.publicToken).not.toBe(membershipId)

      // Verify publicToken is unique and follows CUID format
      expect(membership!.publicToken).toMatch(/^[a-z0-9]{25}$/)
    })
  })

  describe('Purchase Progression', () => {
    it('should increment points on purchase', async () => {
      // First purchase
      const result1 = await registerPurchase(membershipId, businessId, 10.00)

      expect(result1.membership.currentPoints).toBe(1)
      expect(result1.membership.lifetimePoints).toBe(1)
      expect(result1.transaction).toBeDefined()
      expect(result1.transaction.type).toBe('PURCHASE')
      expect(result1.transaction.points).toBe(1)
      expect(result1.reachedGoal).toBe(false)
      expect(result1.earnedReward).toBeNull()

      // Second purchase
      const result2 = await registerPurchase(membershipId, businessId)
      expect(result2.membership.currentPoints).toBe(2)
      expect(result2.membership.lifetimePoints).toBe(2)

      // Third purchase
      const result3 = await registerPurchase(membershipId, businessId)
      expect(result3.membership.currentPoints).toBe(3)

      // Fourth purchase
      const result4 = await registerPurchase(membershipId, businessId)
      expect(result4.membership.currentPoints).toBe(4)
    })

    it('should generate reward on goal completion', async () => {
      // Fifth purchase (completes goal of 5)
      const result = await registerPurchase(membershipId, businessId)

      expect(result.reachedGoal).toBe(true)
      expect(result.earnedReward).not.toBeNull()

      // Points should reset to 0 after goal
      expect(result.membership.currentPoints).toBe(0)
      expect(result.membership.lifetimePoints).toBe(5)

      // Verify reward created
      expect(result.earnedReward!.status).toBe(EarnedRewardStatus.AVAILABLE)
      expect(result.earnedReward!.membershipId).toBe(membershipId)
    })

    it('should generate exactly ONE reward per completion', async () => {
      // Query all rewards for this membership
      const rewards = await prisma.earnedReward.findMany({
        where: {
          membershipId,
          status: EarnedRewardStatus.AVAILABLE
        }
      })

      // Should have exactly 1 reward (from previous test)
      expect(rewards).toHaveLength(1)
    })

    it('should continue progression after reward earned', async () => {
      // Sixth purchase (starts new cycle)
      const result = await registerPurchase(membershipId, businessId)

      expect(result.membership.currentPoints).toBe(1)
      expect(result.membership.lifetimePoints).toBe(6)
      expect(result.reachedGoal).toBe(false)
      expect(result.earnedReward).toBeNull()
    })
  })

  describe('Reward Redemption', () => {
    it('should redeem reward atomically', async () => {
      // Find available reward
      const reward = await prisma.earnedReward.findFirst({
        where: {
          membershipId,
          status: EarnedRewardStatus.AVAILABLE
        }
      })

      expect(reward).not.toBeNull()

      // Redeem
      const result = await redeemReward(reward!.id, businessId, userId)

      expect(result.earnedReward.status).toBe(EarnedRewardStatus.REDEEMED)
      expect(result.earnedReward.redeemedAt).not.toBeNull()
      expect(result.redemption).not.toBeNull()
      expect(result.redemption.earnedRewardId).toBe(reward!.id)
    })

    it('should reject duplicate redemption', async () => {
      // Find redeemed reward
      const reward = await prisma.earnedReward.findFirst({
        where: {
          membershipId,
          status: EarnedRewardStatus.REDEEMED
        }
      })

      // Try to redeem again
      await expect(
        redeemReward(reward!.id, businessId, userId)
      ).rejects.toThrow('not available')
    })
  })

  describe('Tenant Isolation', () => {
    let business2Id: string
    let program2Id: string
    let customer2Id: string
    let membership2Id: string

    beforeAll(async () => {
      // Create second business
      const business2 = await prisma.business.create({
        data: {
          name: 'Isolation Test Business',
          slug: 'test-tenant-isolation',
          status: 'ACTIVE'
        }
      })
      business2Id = business2.id

      // Create subscription for business2
      await prisma.subscription.create({
        data: {
          businessId: business2Id,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })

      // Create admin2
      const user2 = await prisma.user.create({
        data: {
          email: 'admin@isolation.com',
          name: 'Admin 2',
          passwordHash: await bcrypt.hash('Password123', 12),
          role: 'BUSINESS_ADMIN'
        }
      })

      await prisma.businessUser.create({
        data: {
          businessId: business2Id,
          userId: user2.id
        }
      })

      // Create program for business2
      const program2 = await prisma.loyaltyProgram.create({
        data: {
          businessId: business2Id,
          name: 'Program 2',
          pointsRequired: 10,
          status: LoyaltyProgramStatus.ACTIVE
        }
      })
      program2Id = program2.id

      await prisma.rewardDefinition.create({
        data: {
          loyaltyProgramId: program2Id,
          name: 'Reward 2',
          pointsRequired: 10
        }
      })

      // Create customer for business2
      const customer2 = await prisma.customer.create({
        data: {
          businessId: business2Id,
          firstName: 'Customer',
          lastName: '2',
          phone: '+52 55 9999 9999'
        }
      })
      customer2Id = customer2.id

      const membership2 = await prisma.membership.create({
        data: {
          customerId: customer2Id,
          loyaltyProgramId: program2Id
        }
      })
      membership2Id = membership2.id
    })

    it('should isolate programs by business', async () => {
      // Query programs for business1
      const programs1 = await prisma.loyaltyProgram.findMany({
        where: { businessId }
      })
      expect(programs1.every(p => p.businessId === businessId)).toBe(true)

      // Query programs for business2
      const programs2 = await prisma.loyaltyProgram.findMany({
        where: { businessId: business2Id }
      })
      expect(programs2.every(p => p.businessId === business2Id)).toBe(true)

      // Programs should not overlap
      expect(programs1.some(p => p.id === program2Id)).toBe(false)
      expect(programs2.some(p => p.id === programId)).toBe(false)
    })

    it('should isolate customers by business', async () => {
      // Customer1 should only be in business1
      const customer1 = await prisma.customer.findUnique({
        where: { id: customerId }
      })
      expect(customer1!.businessId).toBe(businessId)

      // Customer2 should only be in business2
      const customer2 = await prisma.customer.findUnique({
        where: { id: customer2Id }
      })
      expect(customer2!.businessId).toBe(business2Id)

      // Cross-business query should fail
      const crossCustomer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          businessId: business2Id
        }
      })
      expect(crossCustomer).toBeNull()
    })

    it('should prevent cross-tenant purchase registration', async () => {
      // Try to register purchase for business1 membership using business2 ID
      await expect(
        registerPurchase(membershipId, business2Id)
      ).rejects.toThrow('unauthorized')
    })

    it('should prevent cross-tenant reward redemption', async () => {
      // Create reward for business2
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      await registerPurchase(membership2Id, business2Id)
      const result = await registerPurchase(membership2Id, business2Id)

      expect(result.earnedReward).not.toBeNull()

      // Try to redeem business2 reward using business1 ID
      await expect(
        redeemReward(result.earnedReward!.id, businessId)
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('Acquisition URL', () => {
    it('should use business slug in acquisition URL', async () => {
      const business = await prisma.business.findUnique({
        where: { id: businessId }
      })

      const expectedSlug = business!.slug
      const expectedUrl = `${process.env.NEXTAUTH_URL}/join/${expectedSlug}`

      expect(expectedUrl).toContain('/join/test-loyalty-business')
      expect(expectedUrl).not.toContain(businessId) // Should not expose DB ID
    })

    it('should resolve business by slug', async () => {
      const business = await prisma.business.findUnique({
        where: { slug: 'test-loyalty-business' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business).not.toBeNull()
      expect(business!.id).toBe(businessId)
      expect(business!.loyaltyPrograms).toHaveLength(1)
    })
  })

  describe('Wallet Readiness', () => {
    it('should load membership by public token', async () => {
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId }
      })

      // Query by publicToken (as wallet endpoint does)
      const membershipByToken = await prisma.membership.findUnique({
        where: { publicToken: membership!.publicToken },
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
            where: { status: EarnedRewardStatus.AVAILABLE }
          }
        }
      })

      expect(membershipByToken).not.toBeNull()
      expect(membershipByToken!.id).toBe(membershipId)
      expect(membershipByToken!.customer).toBeDefined()
      expect(membershipByToken!.loyaltyProgram).toBeDefined()
      expect(membershipByToken!.loyaltyProgram.business).toBeDefined()
    })

    it('should expose public token only (not DB IDs)', async () => {
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId }
      })

      // Wallet should use publicToken
      expect(membership!.publicToken).toBeDefined()
      expect(membership!.publicToken).toHaveLength(25)

      // publicToken should be secure (CUID)
      expect(membership!.publicToken).toMatch(/^c[a-z0-9]{24}$/)
    })
  })
})
