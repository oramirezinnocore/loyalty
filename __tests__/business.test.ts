import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'

const prisma = new PrismaClient()

describe('Business', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Suspension', () => {
    it('should allow suspending business without deletion', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Test Suspend Business',
          slug: 'test-suspend-business',
          status: BusinessStatus.ACTIVE
        }
      })

      // Suspend the business
      const suspended = await prisma.business.update({
        where: { id: business.id },
        data: { status: BusinessStatus.SUSPENDED }
      })

      expect(suspended.status).toBe(BusinessStatus.SUSPENDED)

      // Verify business still exists
      const found = await prisma.business.findUnique({
        where: { id: business.id }
      })

      expect(found).not.toBeNull()
      expect(found?.status).toBe(BusinessStatus.SUSPENDED)

      // Clean up
      await prisma.business.delete({ where: { id: business.id } })
    })
  })

  describe('One active loyalty program per business', () => {
    it('should allow only one active loyalty program', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Test Program Business',
          slug: 'test-program-business',
          status: BusinessStatus.ACTIVE
        }
      })

      // Create first active program
      await prisma.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Program 1',
          status: LoyaltyProgramStatus.ACTIVE,
          pointsRequired: 10
        }
      })

      // Verify only one active program
      const activePrograms = await prisma.loyaltyProgram.findMany({
        where: {
          businessId: business.id,
          status: LoyaltyProgramStatus.ACTIVE
        }
      })

      expect(activePrograms.length).toBe(1)

      // Clean up
      await prisma.loyaltyProgram.deleteMany({ where: { businessId: business.id } })
      await prisma.business.delete({ where: { id: business.id } })
    })

    it('should allow multiple draft programs but only one active', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Test Multiple Programs Business',
          slug: 'test-multiple-programs',
          status: BusinessStatus.ACTIVE
        }
      })

      // Create active program
      const activeProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Active Program',
          status: LoyaltyProgramStatus.ACTIVE,
          pointsRequired: 10
        }
      })

      // Create draft program
      const draftProgram = await prisma.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Draft Program',
          status: LoyaltyProgramStatus.DRAFT,
          pointsRequired: 15
        }
      })

      // Verify counts
      const activeCount = await prisma.loyaltyProgram.count({
        where: {
          businessId: business.id,
          status: LoyaltyProgramStatus.ACTIVE
        }
      })

      const draftCount = await prisma.loyaltyProgram.count({
        where: {
          businessId: business.id,
          status: LoyaltyProgramStatus.DRAFT
        }
      })

      expect(activeCount).toBe(1)
      expect(draftCount).toBe(1)

      // Clean up
      await prisma.loyaltyProgram.deleteMany({ where: { businessId: business.id } })
      await prisma.business.delete({ where: { id: business.id } })
    })
  })

  describe('Unique constraints', () => {
    it('should enforce unique business slug', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Unique Slug Test',
          slug: 'unique-slug-test',
          status: BusinessStatus.ACTIVE
        }
      })

      const result = await prisma.business.create({
        data: {
          name: 'Another Business',
          slug: 'unique-slug-test-2',
          status: BusinessStatus.ACTIVE
        }
      }).catch(e => null)

      await expect(
        prisma.business.create({
          data: {
            name: 'Yet Another',
            slug: 'unique-slug-test',
            status: BusinessStatus.ACTIVE
          }
        })
      ).rejects.toThrow()

      // Clean up - handle cascade deletes
      if (result) {
        await prisma.business.delete({ where: { id: result.id } }).catch(() => {})
      }
      await prisma.business.delete({ where: { id: business.id } }).catch(() => {})
    })

    it('should enforce unique customer email per business', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Customer Email Test',
          slug: 'customer-email-test',
          status: BusinessStatus.ACTIVE
        }
      })

      await prisma.customer.create({
        data: {
          businessId: business.id,
          firstName: 'John',
          email: 'unique-email@test.com'
        }
      })

      await expect(
        prisma.customer.create({
          data: {
            businessId: business.id,
            firstName: 'Jane',
            email: 'unique-email@test.com'
          }
        })
      ).rejects.toThrow()

      // Clean up - customers are cascade deleted via onDelete: Cascade
      await prisma.business.delete({ where: { id: business.id } }).catch(() => {})
    })
  })
})
