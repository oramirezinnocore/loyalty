import { PrismaClient, BusinessStatus, SubscriptionStatus } from '@prisma/client'
import {
  canPerformLoyaltyOperations,
  enforceGracePeriod,
  reactivateSubscription,
  calculateMRR,
  getSubscriptionCounts
} from '@/lib/billing-enforcement'
import { createSubscription, mapProviderStatus } from '@/lib/payments/mercado-pago'
import { registerPurchase, redeemReward } from '@/lib/loyalty-engine'

const prisma = new PrismaClient()

describe('Billing and Subscription', () => {
  let testBusinessId: string
  let testSubscriptionId: string

  beforeAll(async () => {
    // Create test business
    const business = await prisma.business.create({
      data: {
        name: 'Billing Test Business',
        slug: 'billing-test-biz',
        status: BusinessStatus.ACTIVE
      }
    })
    testBusinessId = business.id
  })

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { businessId: testBusinessId } })
    await prisma.business.delete({ where: { id: testBusinessId } })
    await prisma.$disconnect()
  })

  describe('Subscription Creation', () => {
    it('should create subscription with $299 MXN plan', async () => {
      const result = await createSubscription(testBusinessId, 'test@example.com')

      expect(result.subscription).toBeTruthy()
      expect(result.subscription.priceMonthlyMXN).toBe(299)
      expect(result.subscription.status).toBe(SubscriptionStatus.TRIAL)
      expect(result.subscription.mpPayerEmail).toBe('test@example.com')
      expect(result.initPoint).toBeTruthy()

      testSubscriptionId = result.subscription.id
    })

    it('should not create duplicate active subscription', async () => {
      // Update to ACTIVE
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: SubscriptionStatus.ACTIVE }
      })

      await expect(
        createSubscription(testBusinessId, 'another@example.com')
      ).rejects.toThrow('already has an active subscription')

      // Reset to TRIAL for other tests
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: SubscriptionStatus.TRIAL }
      })
    })
  })

  describe('Provider Status Mapping', () => {
    it('should map authorized to ACTIVE', () => {
      expect(mapProviderStatus('authorized')).toBe(SubscriptionStatus.ACTIVE)
    })

    it('should map paused to PAST_DUE', () => {
      expect(mapProviderStatus('paused')).toBe(SubscriptionStatus.PAST_DUE)
    })

    it('should map cancelled to CANCELED', () => {
      expect(mapProviderStatus('cancelled')).toBe(SubscriptionStatus.CANCELED)
    })
  })

  describe('Grace Period', () => {
    it('should allow operations during TRIAL', async () => {
      const canOperate = await canPerformLoyaltyOperations(testBusinessId)
      expect(canOperate).toBe(true)
    })

    it('should allow operations during ACTIVE', async () => {
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: SubscriptionStatus.ACTIVE }
      })

      const canOperate = await canPerformLoyaltyOperations(testBusinessId)
      expect(canOperate).toBe(true)
    })

    it('should allow operations during PAST_DUE (grace period)', async () => {
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: SubscriptionStatus.PAST_DUE }
      })

      const canOperate = await canPerformLoyaltyOperations(testBusinessId)
      expect(canOperate).toBe(true)
    })

    it('should set grace period end date', async () => {
      const result = await enforceGracePeriod(testSubscriptionId)

      expect(result?.gracePeriodEndsAt).toBeTruthy()
      expect(result?.status).toBe(SubscriptionStatus.PAST_DUE)
    })

    it('should suspend after grace period expires', async () => {
      // Set grace period to past
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: {
          gracePeriodEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      })

      await enforceGracePeriod(testSubscriptionId)

      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
        include: { business: true }
      })

      expect(subscription?.status).toBe(SubscriptionStatus.SUSPENDED)
      expect(subscription?.business.status).toBe(BusinessStatus.SUSPENDED)
    })

    it('should block operations when SUSPENDED', async () => {
      const canOperate = await canPerformLoyaltyOperations(testBusinessId)
      expect(canOperate).toBe(false)
    })
  })

  describe('Billing Enforcement on Operations', () => {
    let programId: string
    let customerId: string
    let membershipId: string
    let rewardDefId: string
    let earnedRewardId: string

    beforeAll(async () => {
      // Create program, customer, membership for testing
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusinessId,
          name: 'Test Program',
          status: 'ACTIVE',
          pointsRequired: 2,
        reward: 'Test reward'
        }
      })
      programId = program.id

      const rewardDef = await prisma.rewardDefinition.create({
        data: {
          loyaltyProgramId: programId,
          name: 'Test Reward',
          pointsRequired: 2,
          isActive: true
        }
      })
      rewardDefId = rewardDef.id

      const customer = await prisma.customer.create({
        data: {
          businessId: testBusinessId,
          firstName: 'Test',
          phone: '+52 55 9999 0000'
        }
      })
      customerId = customer.id

      const membership = await prisma.membership.create({
        data: {
          customerId,
          loyaltyProgramId: programId
        }
      })
      membershipId = membership.id

      // Create an earned reward
      const reward = await prisma.earnedReward.create({
        data: {
          membershipId,
          rewardDefinitionId: rewardDefId,
          status: 'AVAILABLE'
        }
      })
      earnedRewardId = reward.id
    })

    afterAll(async () => {
      await prisma.redemption.deleteMany({ where: { earnedReward: { membershipId } } })
      await prisma.earnedReward.deleteMany({ where: { membershipId } })
      await prisma.transaction.deleteMany({ where: { membershipId } })
      await prisma.membership.deleteMany({ where: { id: membershipId } })
      await prisma.customer.deleteMany({ where: { id: customerId } })
      await prisma.rewardDefinition.deleteMany({ where: { id: rewardDefId } })
      await prisma.loyaltyProgram.deleteMany({ where: { id: programId } })
    })

    it('should block purchase when business is suspended', async () => {
      await expect(
        registerPurchase(membershipId, testBusinessId)
      ).rejects.toThrow('cannot perform loyalty operations due to billing')
    })

    it('should block reward redemption when business is suspended', async () => {
      await expect(
        redeemReward(earnedRewardId, testBusinessId)
      ).rejects.toThrow('cannot perform loyalty operations due to billing')
    })

    it('should allow operations after reactivation', async () => {
      await reactivateSubscription(testSubscriptionId)

      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscriptionId },
        include: { business: true }
      })

      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE)
      expect(subscription?.business.status).toBe(BusinessStatus.ACTIVE)

      // Should not throw
      const result = await registerPurchase(membershipId, testBusinessId)
      expect(result.transaction).toBeTruthy()
    })

    it('should preserve customer data after suspension and reactivation', async () => {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          memberships: {
            include: {
              transactions: true,
              earnedRewards: true
            }
          }
        }
      })

      expect(customer).toBeTruthy()
      expect(customer?.memberships[0].transactions.length).toBeGreaterThan(0)
    })
  })

  describe('MRR Calculation', () => {
    it('should calculate MRR correctly', async () => {
      // Ensure test subscription is ACTIVE
      await prisma.subscription.update({
        where: { id: testSubscriptionId },
        data: { status: SubscriptionStatus.ACTIVE }
      })

      const mrr = await calculateMRR()
      expect(mrr).toBeGreaterThanOrEqual(299)
    })

    it('should get subscription counts', async () => {
      const counts = await getSubscriptionCounts()

      expect(counts.active).toBeGreaterThanOrEqual(1)
      expect(typeof counts.trial).toBe('number')
      expect(typeof counts.pastDue).toBe('number')
      expect(typeof counts.canceled).toBe('number')
      expect(typeof counts.suspended).toBe('number')
    })
  })
})
