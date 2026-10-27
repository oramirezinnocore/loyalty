import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'
import { registerPurchase, redeemReward } from '@/lib/loyalty-engine'

const prisma = new PrismaClient()

describe('Cross-Tenant Security', () => {
  let businessA: any, businessB: any
  let programA: any, programB: any
  let customerA: any, customerB: any
  let membershipA: any, membershipB: any
  let rewardDefA: any, rewardDefB: any

  beforeAll(async () => {
    // Setup Business A
    businessA = await prisma.business.create({
      data: {
        name: 'Business A',
        slug: 'business-a-security',
        status: BusinessStatus.ACTIVE,
        subscription: {
          create: {
            status: 'ACTIVE',
            priceMonthlyMXN: 299
          }
        }
      }
    })

    programA = await prisma.loyaltyProgram.create({
      data: {
        businessId: businessA.id,
        name: 'Program A',
        status: LoyaltyProgramStatus.ACTIVE,
        pointsRequired: 2,
        reward: 'Test reward'
      }
    })

    rewardDefA = await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programA.id,
        name: 'Reward A',
        pointsRequired: 2,
        isActive: true
      }
    })

    customerA = await prisma.customer.create({
      data: {
        businessId: businessA.id,
        firstName: 'Customer',
        lastName: 'A',
        phone: '+52 55 1111 1111'
      }
    })

    membershipA = await prisma.membership.create({
      data: {
        customerId: customerA.id,
        loyaltyProgramId: programA.id
      }
    })

    // Setup Business B
    businessB = await prisma.business.create({
      data: {
        name: 'Business B',
        slug: 'business-b-security',
        status: BusinessStatus.ACTIVE,
        subscription: {
          create: {
            status: 'ACTIVE',
            priceMonthlyMXN: 299
          }
        }
      }
    })

    programB = await prisma.loyaltyProgram.create({
      data: {
        businessId: businessB.id,
        name: 'Program B',
        status: LoyaltyProgramStatus.ACTIVE,
        pointsRequired: 2,
        reward: 'Test reward'
      }
    })

    rewardDefB = await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programB.id,
        name: 'Reward B',
        pointsRequired: 2,
        isActive: true
      }
    })

    customerB = await prisma.customer.create({
      data: {
        businessId: businessB.id,
        firstName: 'Customer',
        lastName: 'B',
        phone: '+52 55 2222 2222'
      }
    })

    membershipB = await prisma.membership.create({
      data: {
        customerId: customerB.id,
        loyaltyProgramId: programB.id
      }
    })
  })

  afterAll(async () => {
    // Cleanup Business A
    await prisma.redemption.deleteMany({
      where: { earnedReward: { membershipId: membershipA.id } }
    })
    await prisma.earnedReward.deleteMany({ where: { membershipId: membershipA.id } })
    await prisma.transaction.deleteMany({ where: { membershipId: membershipA.id } })
    await prisma.membership.deleteMany({ where: { id: membershipA.id } })
    await prisma.customer.delete({ where: { id: customerA.id } })
    await prisma.rewardDefinition.delete({ where: { id: rewardDefA.id } })
    await prisma.loyaltyProgram.delete({ where: { id: programA.id } })
    await prisma.subscription.deleteMany({ where: { businessId: businessA.id } })
    await prisma.business.delete({ where: { id: businessA.id } })

    // Cleanup Business B
    await prisma.redemption.deleteMany({
      where: { earnedReward: { membershipId: membershipB.id } }
    })
    await prisma.earnedReward.deleteMany({ where: { membershipId: membershipB.id } })
    await prisma.transaction.deleteMany({ where: { membershipId: membershipB.id } })
    await prisma.membership.deleteMany({ where: { id: membershipB.id } })
    await prisma.customer.delete({ where: { id: customerB.id } })
    await prisma.rewardDefinition.delete({ where: { id: rewardDefB.id } })
    await prisma.loyaltyProgram.delete({ where: { id: programB.id } })
    await prisma.subscription.deleteMany({ where: { businessId: businessB.id } })
    await prisma.business.delete({ where: { id: businessB.id } })

    await prisma.$disconnect()
  })

  it('should reject Business B registering purchase for Business A membership', async () => {
    await expect(
      registerPurchase(membershipA.id, businessB.id)
    ).rejects.toThrow('Membership not found or unauthorized')
  })

  it('should reject Business A registering purchase for Business B membership', async () => {
    await expect(
      registerPurchase(membershipB.id, businessA.id)
    ).rejects.toThrow('Membership not found or unauthorized')
  })

  it('should allow correct business to register purchase', async () => {
    const result = await registerPurchase(membershipA.id, businessA.id)
    expect(result.transaction).toBeTruthy()
  })

  it('should create earned reward and reject cross-tenant redemption', async () => {
    // Complete cycle for Business A
    await registerPurchase(membershipA.id, businessA.id)

    const earnedRewardA = await prisma.earnedReward.findFirst({
      where: {
        membershipId: membershipA.id,
        status: 'AVAILABLE'
      }
    })

    expect(earnedRewardA).toBeTruthy()

    // Business B trying to redeem Business A's reward
    await expect(
      redeemReward(earnedRewardA!.id, businessB.id)
    ).rejects.toThrow('Unauthorized')
  })

  it('should allow correct business to redeem reward', async () => {
    const earnedRewardA = await prisma.earnedReward.findFirst({
      where: {
        membershipId: membershipA.id,
        status: 'AVAILABLE'
      }
    })

    const result = await redeemReward(earnedRewardA!.id, businessA.id)
    expect(result.earnedReward.status).toBe('REDEEMED')
  })

  it('should isolate customer data by business', async () => {
    const customersA = await prisma.customer.findMany({
      where: { businessId: businessA.id }
    })

    const customersB = await prisma.customer.findMany({
      where: { businessId: businessB.id }
    })

    expect(customersA.some(c => c.id === customerB.id)).toBe(false)
    expect(customersB.some(c => c.id === customerA.id)).toBe(false)
  })
})
