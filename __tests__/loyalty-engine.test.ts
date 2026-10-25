import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'
import { registerPurchase, redeemReward } from '@/lib/loyalty-engine'

const prisma = new PrismaClient()

describe('Loyalty Engine', () => {
  let businessId: string
  let programId: string
  let customerId: string
  let membershipId: string
  let rewardDefId: string

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: {
        name: 'Loyalty Test Business',
        slug: 'loyalty-test-business',
        status: BusinessStatus.ACTIVE,
        subscription: {
          create: {
            status: 'ACTIVE',
            priceMonthlyMXN: 299
          }
        }
      }
    })
    businessId = business.id

    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId,
        name: 'Test Program',
        status: LoyaltyProgramStatus.ACTIVE,
        pointsRequired: 3
      }
    })
    programId = program.id

    const rewardDef = await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programId,
        name: 'Test Reward',
        pointsRequired: 3,
        isActive: true
      }
    })
    rewardDefId = rewardDef.id

    const customer = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Loyalty',
        lastName: 'Tester',
        phone: '+52 55 9999 8888'
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
  })

  afterAll(async () => {
    await prisma.redemption.deleteMany({
      where: { earnedReward: { membershipId } }
    })
    await prisma.earnedReward.deleteMany({ where: { membershipId } })
    await prisma.transaction.deleteMany({ where: { membershipId } })
    await prisma.membership.deleteMany({ where: { id: membershipId } })
    await prisma.customer.deleteMany({ where: { id: customerId } })
    await prisma.rewardDefinition.deleteMany({ where: { loyaltyProgramId: programId } })
    await prisma.loyaltyProgram.deleteMany({ where: { id: programId } })
    await prisma.subscription.deleteMany({ where: { businessId } })
    await prisma.business.deleteMany({ where: { id: businessId } })
    await prisma.$disconnect()
  })

  it('should register purchase and increment points', async () => {
    const result = await registerPurchase(membershipId, businessId)

    expect(result.transaction).toBeTruthy()
    expect(result.transaction.points).toBe(1)
    expect(result.membership.currentPoints).toBe(1)
    expect(result.membership.lifetimePoints).toBe(1)
    expect(result.reachedGoal).toBe(false)
    expect(result.earnedReward).toBeNull()
  })

  it('should create earned reward when goal reached', async () => {
    // Current points: 1, need 2 more to reach goal of 3
    await registerPurchase(membershipId, businessId)
    const result = await registerPurchase(membershipId, businessId)

    expect(result.reachedGoal).toBe(true)
    expect(result.earnedReward).toBeTruthy()
    expect(result.earnedReward?.status).toBe('AVAILABLE')
    expect(result.membership.currentPoints).toBe(0) // Reset after reaching goal
  })

  it('should create exactly one earned reward per cycle', async () => {
    const earnedRewards = await prisma.earnedReward.findMany({
      where: { membershipId }
    })

    expect(earnedRewards.length).toBe(1)
  })

  it('should reset progress after reward earned', async () => {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId }
    })

    expect(membership?.currentPoints).toBe(0)
    expect(membership?.lifetimePoints).toBe(3)
  })

  it('should reject purchase for different business', async () => {
    const wrongBusinessId = 'wrong-business-id'

    await expect(registerPurchase(membershipId, wrongBusinessId)).rejects.toThrow()
  })

  it('should redeem reward successfully', async () => {
    const earnedReward = await prisma.earnedReward.findFirst({
      where: {
        membershipId,
        status: 'AVAILABLE'
      }
    })

    expect(earnedReward).toBeTruthy()

    const result = await redeemReward(earnedReward!.id, businessId)

    expect(result.earnedReward.status).toBe('REDEEMED')
    expect(result.redemption).toBeTruthy()
  })

  it('should reject second redemption attempt', async () => {
    const redeemedReward = await prisma.earnedReward.findFirst({
      where: {
        membershipId,
        status: 'REDEEMED'
      }
    })

    await expect(redeemReward(redeemedReward!.id, businessId)).rejects.toThrow(
      'Reward is not available for redemption'
    )
  })

  it('should reject redemption for different business', async () => {
    // Create a new available reward for testing
    const newReward = await prisma.earnedReward.create({
      data: {
        membershipId,
        rewardDefinitionId: rewardDefId,
        status: 'AVAILABLE'
      }
    })

    const wrongBusinessId = 'wrong-business-id'

    await expect(redeemReward(newReward.id, wrongBusinessId)).rejects.toThrow()

    // Cleanup
    await prisma.earnedReward.delete({ where: { id: newReward.id } })
  })
})
