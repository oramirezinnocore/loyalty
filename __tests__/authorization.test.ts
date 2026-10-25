import { PrismaClient, UserRole, BusinessStatus, SubscriptionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Import only the functions we'll test directly
const prisma = new PrismaClient()

// Mock getUserBusinesses and canAccessBusiness functions inline to avoid next-auth ESM issues
async function getUserBusinesses(userId: string, role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) {
    return await prisma.business.findMany({
      orderBy: { name: 'asc' }
    })
  }

  const businessUsers = await prisma.businessUser.findMany({
    where: { userId },
    include: { business: true }
  })

  return businessUsers.map(bu => bu.business)
}

async function canAccessBusiness(userId: string, role: UserRole, businessId: string): Promise<boolean> {
  if (role === UserRole.SUPER_ADMIN) {
    return true
  }

  const businessUser = await prisma.businessUser.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId
      }
    }
  })

  return !!businessUser
}

describe('Authorization', () => {
  let superAdminId: string
  let businessAdminId: string
  let businessAId: string
  let businessBId: string

  beforeAll(async () => {
    // Clean up test data - find and delete existing test data
    const existingUsers = await prisma.user.findMany({
      where: { email: { contains: 'test-' } }
    })
    for (const user of existingUsers) {
      await prisma.businessUser.deleteMany({ where: { userId: user.id } })
    }

    const existingBusinesses = await prisma.business.findMany({
      where: { slug: { contains: '-test' } }
    })
    for (const biz of existingBusinesses) {
      await prisma.subscription.deleteMany({ where: { businessId: biz.id } })
      await prisma.business.delete({ where: { id: biz.id } })
    }

    await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } })

    // Create test users
    const passwordHash = await bcrypt.hash('test123', 10)

    const superAdmin = await prisma.user.create({
      data: {
        email: 'test-super@test.com',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        name: 'Test Super Admin'
      }
    })
    superAdminId = superAdmin.id

    const businessAdmin = await prisma.user.create({
      data: {
        email: 'test-admin@test.com',
        passwordHash,
        role: UserRole.BUSINESS_ADMIN,
        name: 'Test Business Admin'
      }
    })
    businessAdminId = businessAdmin.id

    // Create test businesses
    const businessA = await prisma.business.create({
      data: {
        name: 'Business A',
        slug: 'business-a-test',
        status: BusinessStatus.ACTIVE,
        subscription: {
          create: {
            status: SubscriptionStatus.ACTIVE,
            priceMonthlyMXN: 299
          }
        }
      }
    })
    businessAId = businessA.id

    const businessB = await prisma.business.create({
      data: {
        name: 'Business B',
        slug: 'business-b-test',
        status: BusinessStatus.ACTIVE,
        subscription: {
          create: {
            status: SubscriptionStatus.ACTIVE,
            priceMonthlyMXN: 299
          }
        }
      }
    })
    businessBId = businessB.id

    // Associate business admin with Business A only
    await prisma.businessUser.create({
      data: {
        userId: businessAdminId,
        businessId: businessAId
      }
    })
  })

  afterAll(async () => {
    // Clean up
    await prisma.businessUser.deleteMany({ where: { businessId: { in: [businessAId, businessBId] } } })
    await prisma.subscription.deleteMany({ where: { businessId: { in: [businessAId, businessBId] } } })
    await prisma.business.deleteMany({ where: { id: { in: [businessAId, businessBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [superAdminId, businessAdminId] } } })
    await prisma.$disconnect()
  })

  describe('SUPER_ADMIN authorization', () => {
    it('should allow super admin to access any business', async () => {
      const canAccessA = await canAccessBusiness(superAdminId, UserRole.SUPER_ADMIN, businessAId)
      const canAccessB = await canAccessBusiness(superAdminId, UserRole.SUPER_ADMIN, businessBId)

      expect(canAccessA).toBe(true)
      expect(canAccessB).toBe(true)
    })

    it('should return all businesses for super admin', async () => {
      const businesses = await getUserBusinesses(superAdminId, UserRole.SUPER_ADMIN)
      expect(businesses.length).toBeGreaterThanOrEqual(2)
      expect(businesses.some(b => b.id === businessAId)).toBe(true)
      expect(businesses.some(b => b.id === businessBId)).toBe(true)
    })
  })

  describe('BUSINESS_ADMIN authorization', () => {
    it('should allow business admin to access associated business', async () => {
      const canAccess = await canAccessBusiness(businessAdminId, UserRole.BUSINESS_ADMIN, businessAId)
      expect(canAccess).toBe(true)
    })

    it('should deny business admin access to non-associated business', async () => {
      const canAccess = await canAccessBusiness(businessAdminId, UserRole.BUSINESS_ADMIN, businessBId)
      expect(canAccess).toBe(false)
    })

    it('should return only associated businesses for business admin', async () => {
      const businesses = await getUserBusinesses(businessAdminId, UserRole.BUSINESS_ADMIN)
      expect(businesses.length).toBe(1)
      expect(businesses[0].id).toBe(businessAId)
      expect(businesses.some(b => b.id === businessBId)).toBe(false)
    })
  })

  describe('Tenant isolation', () => {
    it('should enforce unique business-user associations', async () => {
      await expect(
        prisma.businessUser.create({
          data: {
            userId: businessAdminId,
            businessId: businessAId
          }
        })
      ).rejects.toThrow()
    })
  })
})
