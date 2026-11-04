import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'

const prisma = new PrismaClient()

describe('Membership', () => {
  let businessId: string
  let customerId: string
  let loyaltyProgramId: string

  beforeAll(async () => {
    // Create test business
    const business = await prisma.business.create({
      data: {
        name: 'Test Business',
        slug: 'test-business-membership',
        status: BusinessStatus.ACTIVE
      }
    })
    businessId = business.id

    // Create loyalty program
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId,
        name: 'Test Program',
        status: LoyaltyProgramStatus.ACTIVE,
        pointsRequired: 10
      }
    })
    loyaltyProgramId = program.id

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test-customer@test.com'
      }
    })
    customerId = customer.id
  })

  afterAll(async () => {
    await prisma.$transaction([
      prisma.membership.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.loyaltyProgram.deleteMany(),
      prisma.business.deleteMany(),
    ])
    await prisma.$disconnect()
  })

  describe('Public token', () => {
    it('should generate unique non-sequential public token', async () => {
      // Get first customer from customerId (created in beforeAll)
      const customer1 = await prisma.customer.findUnique({
        where: { id: customerId }
      })

      const customer2 = await prisma.customer.create({
        data: {
          businessId,
          firstName: 'Another',
          email: 'another-token-test@test.com'
        }
      })

      const membership1 = await prisma.membership.create({
        data: {
          customerId: customer1!.id,
          loyaltyProgramId
        }
      })

      const membership2 = await prisma.membership.create({
        data: {
          customerId: customer2.id,
          loyaltyProgramId
        }
      })

      // NEW: Verify Customer.publicToken (stable identifier), not Membership.publicToken (deprecated)
      expect(customer1!.publicToken).toBeTruthy()
      expect(customer2.publicToken).toBeTruthy()
      expect(customer1!.publicToken).not.toBe(customer2.publicToken)

      // Check that tokens are not sequential integers
      expect(Number.isNaN(Number(customer1!.publicToken))).toBe(true)
      expect(Number.isNaN(Number(customer2.publicToken))).toBe(true)

      // Check minimum length for security
      expect(customer1!.publicToken.length).toBeGreaterThan(10)
      expect(customer2.publicToken.length).toBeGreaterThan(10)
    })

    it('should enforce unique public token constraint', async () => {
      const customer3 = await prisma.customer.create({
        data: {
          businessId,
          firstName: 'TokenTest',
          email: 'token-unique-test@test.com'
        }
      })

      const membership = await prisma.membership.create({
        data: {
          customerId: customer3.id,
          loyaltyProgramId,
          publicToken: 'unique-test-token-12345'
        }
      })

      const newCustomer = await prisma.customer.create({
        data: {
          businessId,
          firstName: 'New',
          email: 'new-token-constraint@test.com'
        }
      })

      await expect(
        prisma.membership.create({
          data: {
            customerId: newCustomer.id,
            loyaltyProgramId,
            publicToken: 'unique-test-token-12345'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('One membership per customer per program', () => {
    it('should enforce unique customer-program constraint', async () => {
      const customer4 = await prisma.customer.create({
        data: {
          businessId,
          firstName: 'UniqueTest',
          email: 'unique-membership@test.com'
        }
      })

      await prisma.membership.create({
        data: {
          customerId: customer4.id,
          loyaltyProgramId
        }
      })

      await expect(
        prisma.membership.create({
          data: {
            customerId: customer4.id,
            loyaltyProgramId
          }
        })
      ).rejects.toThrow()
    })
  })
})
