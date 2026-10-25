import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'
import { formatPhone } from '@/lib/utils'

const prisma = new PrismaClient()

describe('Customer Registration', () => {
  let businessId: string
  let programId: string
  const businessSlug = 'test-registration-biz'

  beforeAll(async () => {
    // Create test business with program
    const business = await prisma.business.create({
      data: {
        name: 'Registration Test Business',
        slug: businessSlug,
        status: BusinessStatus.ACTIVE,
        loyaltyPrograms: {
          create: {
            name: 'Test Program',
            status: LoyaltyProgramStatus.ACTIVE,
            pointsRequired: 5,
            rewardDefinitions: {
              create: {
                name: 'Test Reward',
                pointsRequired: 5,
                isActive: true
              }
            }
          }
        }
      }
    })
    businessId = business.id

    const program = await prisma.loyaltyProgram.findFirst({
      where: { businessId }
    })
    programId = program!.id
  })

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { customer: { businessId } } })
    await prisma.customer.deleteMany({ where: { businessId } })
    await prisma.rewardDefinition.deleteMany({ where: { loyaltyProgramId: programId } })
    await prisma.loyaltyProgram.deleteMany({ where: { businessId } })
    await prisma.business.delete({ where: { id: businessId } })
    await prisma.$disconnect()
  })

  it('should create customer and membership', async () => {
    const phone = '+52 55 1234 5678'
    const normalizedPhone = formatPhone(phone)

    const customer = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Test',
        lastName: 'Customer',
        phone: normalizedPhone
      }
    })

    const membership = await prisma.membership.create({
      data: {
        customerId: customer.id,
        loyaltyProgramId: programId
      }
    })

    expect(customer).toBeTruthy()
    expect(membership).toBeTruthy()
    expect(membership.publicToken).toBeTruthy()
    expect(membership.publicToken.length).toBeGreaterThan(10)
    expect(membership.currentPoints).toBe(0)
  })

  it('should normalize phone numbers', async () => {
    const testCases = [
      { input: '+52 55 9876 5432', expected: '+525598765432' },
      { input: '5598765432', expected: '+525598765432' },
      { input: '525598765432', expected: '+525598765432' }
    ]

    testCases.forEach(({ input, expected }) => {
      const normalized = formatPhone(input)
      expect(normalized.replace(/\s/g, '')).toBe(expected)
    })
  })

  it('should allow duplicate phone per business (family accounts)', async () => {
    const phone = formatPhone('+52 55 1111 2222')

    const customer1 = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'First',
        phone,
        email: 'first@test.com'
      }
    })

    const customer2 = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Second',
        phone,
        email: 'second@test.com'
      }
    })

    expect(customer1.phone).toBe(customer2.phone)
    expect(customer1.businessId).toBe(customer2.businessId)
    expect(customer1.id).not.toBe(customer2.id)
  })

  it('should allow same phone for different businesses', async () => {
    const phone = formatPhone('+52 55 3333 4444')

    const business2 = await prisma.business.create({
      data: {
        name: 'Business 2',
        slug: 'test-biz-2-phone',
        status: BusinessStatus.ACTIVE
      }
    })

    const customer1 = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Customer1',
        phone
      }
    })

    const customer2 = await prisma.customer.create({
      data: {
        businessId: business2.id,
        firstName: 'Customer2',
        phone
      }
    })

    expect(customer1.phone).toBe(customer2.phone)
    expect(customer1.businessId).not.toBe(customer2.businessId)

    // Cleanup
    await prisma.customer.deleteMany({ where: { businessId: business2.id } })
    await prisma.business.delete({ where: { id: business2.id } })
  })
})
