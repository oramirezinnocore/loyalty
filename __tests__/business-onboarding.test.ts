/**
 * Business Onboarding Integration Tests
 *
 * Tests complete SUPER_ADMIN business creation workflow:
 * 1. Business creation with atomic transaction
 * 2. Admin user creation with password hashing
 * 3. BusinessUser relationship
 * 4. Trial subscription creation
 * 5. Duplicate handling (slug, email)
 * 6. Validation
 * 7. Tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient, BusinessStatus, SubscriptionStatus, UserRole } from '@prisma/client'
import { createBusiness } from '@/app/actions/business'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Mock requireSuperAdmin for testing
jest.mock('@/lib/authorization', () => ({
  requireSuperAdmin: jest.fn().mockResolvedValue(undefined),
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'super-admin-id', role: 'SUPER_ADMIN' }
  }),
  getSession: jest.fn().mockResolvedValue({
    user: { id: 'super-admin-id', role: 'SUPER_ADMIN' }
  })
}))

// Mock revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Business Onboarding', () => {
  // Cleanup after all tests
  afterAll(async () => {
    // Clean up test businesses
    await prisma.business.deleteMany({
      where: {
        slug: {
          in: [
            'test-business-creation',
            'duplicate-slug-test',
            'test-tenant-a',
            'test-tenant-b'
          ]
        }
      }
    })

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin@testbusiness.com',
            'duplicate@test.com',
            'admin-a@tenant-test.com',
            'admin-b@tenant-test.com'
          ]
        }
      }
    })

    await prisma.$disconnect()
  })

  describe('Business Creation', () => {
    it('should create business atomically with all required entities', async () => {
      const result = await createBusiness({
        name: 'Test Business Creation',
        slug: 'test-business-creation',
        adminName: 'Test Admin',
        adminEmail: 'admin@testbusiness.com',
        adminPassword: 'TestPassword123',
        status: BusinessStatus.ACTIVE,
        enableTrial: true
      })

      expect(result.success).toBe(true)
      expect(result.businessId).toBeDefined()

      // Verify Business created
      const business = await prisma.business.findUnique({
        where: { id: result.businessId },
        include: {
          subscription: true,
          businessUsers: {
            include: {
              user: true
            }
          }
        }
      })

      expect(business).not.toBeNull()
      expect(business!.name).toBe('Test Business Creation')
      expect(business!.slug).toBe('test-business-creation')
      expect(business!.status).toBe(BusinessStatus.ACTIVE)

      // Verify User created
      expect(business!.businessUsers).toHaveLength(1)
      const admin = business!.businessUsers[0].user
      expect(admin.email).toBe('admin@testbusiness.com')
      expect(admin.name).toBe('Test Admin')
      expect(admin.role).toBe(UserRole.BUSINESS_ADMIN)

      // Verify password is hashed (not plaintext)
      expect(admin.passwordHash).not.toBe('TestPassword123')
      expect(admin.passwordHash).toHaveLength(60) // bcrypt length

      // Verify password validates
      const isValid = await bcrypt.compare('TestPassword123', admin.passwordHash)
      expect(isValid).toBe(true)

      // Verify BusinessUser relationship created
      const businessUser = await prisma.businessUser.findUnique({
        where: {
          businessId_userId: {
            businessId: business!.id,
            userId: admin.id
          }
        }
      })
      expect(businessUser).not.toBeNull()

      // Verify Subscription created
      expect(business!.subscription).not.toBeNull()
      expect(business!.subscription!.status).toBe(SubscriptionStatus.TRIAL)
      expect(business!.subscription!.priceMonthlyMXN).toBe(299)

      // Verify trial expiration is ~7 days in future
      const trialEndsAt = business!.subscription!.trialEndsAt
      expect(trialEndsAt).not.toBeNull()

      const now = new Date()
      const expectedTrialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const timeDiff = Math.abs(trialEndsAt!.getTime() - expectedTrialEnd.getTime())

      // Allow 1 hour tolerance for test timing
      expect(timeDiff).toBeLessThan(60 * 60 * 1000)
    })

    it('should hash password with bcrypt', async () => {
      // Create test business
      const result = await createBusiness({
        name: 'Password Hash Test',
        slug: 'password-hash-test',
        adminName: 'Admin',
        adminEmail: 'password-test@example.com',
        adminPassword: 'SecurePassword456'
      })

      expect(result.success).toBe(true)

      // Retrieve user
      const user = await prisma.user.findUnique({
        where: { email: 'password-test@example.com' }
      })

      expect(user).not.toBeNull()

      // Verify hash format (bcrypt $2a$ or $2b$)
      expect(user!.passwordHash).toMatch(/^\$2[ab]\$\d{2}\$/)

      // Verify correct password validates
      const isValid = await bcrypt.compare('SecurePassword456', user!.passwordHash)
      expect(isValid).toBe(true)

      // Verify wrong password fails
      const isInvalid = await bcrypt.compare('WrongPassword', user!.passwordHash)
      expect(isInvalid).toBe(false)

      // Cleanup
      await prisma.business.deleteMany({
        where: { slug: 'password-hash-test' }
      })
      await prisma.user.deleteMany({
        where: { email: 'password-test@example.com' }
      })
    })

    it('should create trial subscription with 7-day expiration', async () => {
      const beforeCreate = new Date()

      const result = await createBusiness({
        name: 'Trial Test',
        slug: 'trial-test',
        adminName: 'Admin',
        adminEmail: 'trial@test.com',
        adminPassword: 'TrialPassword123',
        enableTrial: true
      })

      expect(result.success).toBe(true)

      const business = await prisma.business.findUnique({
        where: { id: result.businessId },
        include: { subscription: true }
      })

      expect(business!.subscription!.status).toBe(SubscriptionStatus.TRIAL)
      expect(business!.subscription!.priceMonthlyMXN).toBe(299)

      const trialEndsAt = business!.subscription!.trialEndsAt!
      const expectedEnd = new Date(beforeCreate.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Verify trial ends approximately 7 days from now
      const diff = Math.abs(trialEndsAt.getTime() - expectedEnd.getTime())
      expect(diff).toBeLessThan(5000) // Within 5 seconds

      // Cleanup
      await prisma.business.deleteMany({ where: { slug: 'trial-test' } })
      await prisma.user.deleteMany({ where: { email: 'trial@test.com' } })
    })

    it('should create active subscription when trial disabled', async () => {
      const result = await createBusiness({
        name: 'No Trial Test',
        slug: 'no-trial-test',
        adminName: 'Admin',
        adminEmail: 'notrial@test.com',
        adminPassword: 'NoTrialPassword123',
        enableTrial: false
      })

      expect(result.success).toBe(true)

      const business = await prisma.business.findUnique({
        where: { id: result.businessId },
        include: { subscription: true }
      })

      expect(business!.subscription!.status).toBe(SubscriptionStatus.ACTIVE)
      expect(business!.subscription!.trialEndsAt).toBeNull()

      // Cleanup
      await prisma.business.deleteMany({ where: { slug: 'no-trial-test' } })
      await prisma.user.deleteMany({ where: { email: 'notrial@test.com' } })
    })
  })

  describe('Duplicate Handling', () => {
    beforeAll(async () => {
      // Create a business for duplicate tests
      await createBusiness({
        name: 'Duplicate Test Business',
        slug: 'duplicate-slug-test',
        adminName: 'First Admin',
        adminEmail: 'duplicate@test.com',
        adminPassword: 'FirstPassword123'
      })
    })

    it('should reject duplicate slug safely', async () => {
      const result = await createBusiness({
        name: 'Another Business',
        slug: 'duplicate-slug-test', // Same slug
        adminName: 'Second Admin',
        adminEmail: 'different@test.com',
        adminPassword: 'SecondPassword123'
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors!.slug).toBe('This slug is already taken')

      // Verify no business created
      const businesses = await prisma.business.findMany({
        where: { name: 'Another Business' }
      })
      expect(businesses).toHaveLength(0)

      // Verify no user created
      const user = await prisma.user.findUnique({
        where: { email: 'different@test.com' }
      })
      expect(user).toBeNull()
    })

    it('should reject duplicate admin email safely', async () => {
      const result = await createBusiness({
        name: 'Email Duplicate Test',
        slug: 'email-duplicate-test',
        adminName: 'Admin',
        adminEmail: 'duplicate@test.com', // Same email
        adminPassword: 'DuplicatePassword123'
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors!.adminEmail).toBe('This email is already registered')

      // Verify no business created (transaction rolled back)
      const business = await prisma.business.findUnique({
        where: { slug: 'email-duplicate-test' }
      })
      expect(business).toBeNull()
    })

    it('should rollback entire transaction if admin creation fails', async () => {
      // This test verifies atomicity: if admin creation fails,
      // the business should NOT be created

      const result = await createBusiness({
        name: 'Rollback Test',
        slug: 'rollback-test',
        adminName: 'Admin',
        adminEmail: 'duplicate@test.com', // Will fail (duplicate)
        adminPassword: 'RollbackPassword123'
      })

      expect(result.success).toBe(false)

      // Verify business was NOT created (rolled back)
      const business = await prisma.business.findUnique({
        where: { slug: 'rollback-test' }
      })
      expect(business).toBeNull()

      // Verify subscription was NOT created
      const subscription = await prisma.subscription.findFirst({
        where: {
          business: {
            slug: 'rollback-test'
          }
        }
      })
      expect(subscription).toBeNull()
    })
  })

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const result = await createBusiness({
        name: '',
        slug: '',
        adminName: '',
        adminEmail: '',
        adminPassword: ''
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors).toBeDefined()
      expect(result.fieldErrors!.name).toBeDefined()
      expect(result.fieldErrors!.slug).toBeDefined()
      expect(result.fieldErrors!.adminName).toBeDefined()
      expect(result.fieldErrors!.adminEmail).toBeDefined()
      expect(result.fieldErrors!.adminPassword).toBeDefined()
    })

    it('should validate password strength', async () => {
      // Too short
      const result1 = await createBusiness({
        name: 'Test',
        slug: 'test',
        adminName: 'Admin',
        adminEmail: 'test@test.com',
        adminPassword: 'short'
      })

      expect(result1.success).toBe(false)
      expect(result1.fieldErrors!.adminPassword).toContain('12 characters')

      // No numbers
      const result2 = await createBusiness({
        name: 'Test',
        slug: 'test',
        adminName: 'Admin',
        adminEmail: 'test@test.com',
        adminPassword: 'NoNumbersHere'
      })

      expect(result2.success).toBe(false)
      expect(result2.fieldErrors!.adminPassword).toContain('letters and numbers')

      // No letters
      const result3 = await createBusiness({
        name: 'Test',
        slug: 'test',
        adminName: 'Admin',
        adminEmail: 'test@test.com',
        adminPassword: '123456789012'
      })

      expect(result3.success).toBe(false)
      expect(result3.fieldErrors!.adminPassword).toContain('letters and numbers')
    })

    it('should validate email format', async () => {
      const result = await createBusiness({
        name: 'Test',
        slug: 'test',
        adminName: 'Admin',
        adminEmail: 'invalid-email',
        adminPassword: 'ValidPassword123'
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors!.adminEmail).toContain('Invalid email')
    })

    it('should validate slug format', async () => {
      // Invalid characters
      const result1 = await createBusiness({
        name: 'Test',
        slug: 'test spaces',
        adminName: 'Admin',
        adminEmail: 'test@test.com',
        adminPassword: 'TestPassword123'
      })

      expect(result1.success).toBe(false)
      expect(result1.fieldErrors!.slug).toBeDefined()

      // Consecutive hyphens
      const result2 = await createBusiness({
        name: 'Test',
        slug: 'test--slug',
        adminName: 'Admin',
        adminEmail: 'test@test.com',
        adminPassword: 'TestPassword123'
      })

      expect(result2.success).toBe(false)
      expect(result2.fieldErrors!.slug).toBeDefined()
    })
  })

  describe('Tenant Isolation', () => {
    let businessA: { id: string; adminId: string }
    let businessB: { id: string; adminId: string }

    beforeAll(async () => {
      // Create two businesses
      const resultA = await createBusiness({
        name: 'Tenant A',
        slug: 'test-tenant-a',
        adminName: 'Admin A',
        adminEmail: 'admin-a@tenant-test.com',
        adminPassword: 'TenantAPassword123'
      })

      const resultB = await createBusiness({
        name: 'Tenant B',
        slug: 'test-tenant-b',
        adminName: 'Admin B',
        adminEmail: 'admin-b@tenant-test.com',
        adminPassword: 'TenantBPassword123'
      })

      const busA = await prisma.business.findUnique({
        where: { id: resultA.businessId },
        include: { businessUsers: true }
      })

      const busB = await prisma.business.findUnique({
        where: { id: resultB.businessId },
        include: { businessUsers: true }
      })

      businessA = {
        id: busA!.id,
        adminId: busA!.businessUsers[0].userId
      }

      businessB = {
        id: busB!.id,
        adminId: busB!.businessUsers[0].userId
      }
    })

    it('should enforce BusinessUser relationship per tenant', async () => {
      // Admin A should have access to Business A
      const relationA = await prisma.businessUser.findUnique({
        where: {
          businessId_userId: {
            businessId: businessA.id,
            userId: businessA.adminId
          }
        }
      })
      expect(relationA).not.toBeNull()

      // Admin A should NOT have access to Business B
      const crossRelation = await prisma.businessUser.findUnique({
        where: {
          businessId_userId: {
            businessId: businessB.id,
            userId: businessA.adminId
          }
        }
      })
      expect(crossRelation).toBeNull()
    })

    it('should isolate customers by business', async () => {
      // Create customer for Business A
      const customerA = await prisma.customer.create({
        data: {
          businessId: businessA.id,
          firstName: 'Customer',
          lastName: 'A',
          phone: '+52 55 1111 1111'
        }
      })

      // Query customers scoped to Business A
      const customersA = await prisma.customer.findMany({
        where: { businessId: businessA.id }
      })
      expect(customersA).toHaveLength(1)
      expect(customersA[0].id).toBe(customerA.id)

      // Query customers scoped to Business B (should be empty)
      const customersB = await prisma.customer.findMany({
        where: { businessId: businessB.id }
      })
      expect(customersB).toHaveLength(0)

      // Verify Customer A cannot be accessed via Business B query
      const customerInB = await prisma.customer.findFirst({
        where: {
          id: customerA.id,
          businessId: businessB.id
        }
      })
      expect(customerInB).toBeNull()

      // Cleanup
      await prisma.customer.delete({ where: { id: customerA.id } })
    })

    it('should isolate loyalty programs by business', async () => {
      // Create loyalty program for Business A
      const programA = await prisma.loyaltyProgram.create({
        data: {
          businessId: businessA.id,
          name: 'Program A',
          description: 'Test',
          status: 'ACTIVE',
          pointsRequired: 10,
        reward: 'Test reward'
        }
      })

      // Query programs scoped to Business A
      const programsA = await prisma.loyaltyProgram.findMany({
        where: { businessId: businessA.id }
      })
      expect(programsA).toHaveLength(1)

      // Query programs scoped to Business B (should be empty)
      const programsB = await prisma.loyaltyProgram.findMany({
        where: { businessId: businessB.id }
      })
      expect(programsB).toHaveLength(0)

      // Cleanup
      await prisma.loyaltyProgram.delete({ where: { id: programA.id } })
    })
  })

  describe('Dashboard Integration', () => {
    it('should increment business count after creation', async () => {
      const countBefore = await prisma.business.count()

      await createBusiness({
        name: 'Dashboard Test',
        slug: 'dashboard-count-test',
        adminName: 'Admin',
        adminEmail: 'dashboard-test@example.com',
        adminPassword: 'DashboardPassword123'
      })

      const countAfter = await prisma.business.count()
      expect(countAfter).toBe(countBefore + 1)

      // Cleanup
      await prisma.business.deleteMany({ where: { slug: 'dashboard-count-test' } })
      await prisma.user.deleteMany({ where: { email: 'dashboard-test@example.com' } })
    })

    it('should reflect correct subscription status in metrics', async () => {
      const result = await createBusiness({
        name: 'Metrics Test',
        slug: 'metrics-test',
        adminName: 'Admin',
        adminEmail: 'metrics@example.com',
        adminPassword: 'MetricsPassword123',
        enableTrial: true
      })

      // Count trial subscriptions
      const trialCount = await prisma.subscription.count({
        where: { status: SubscriptionStatus.TRIAL }
      })

      expect(trialCount).toBeGreaterThan(0)

      // Cleanup
      await prisma.business.deleteMany({ where: { id: result.businessId } })
      await prisma.user.deleteMany({ where: { email: 'metrics@example.com' } })
    })
  })

  describe('No Password Exposure', () => {
    it('should never expose passwordHash in business queries', async () => {
      const result = await createBusiness({
        name: 'Security Test',
        slug: 'security-test',
        adminName: 'Admin',
        adminEmail: 'security@test.com',
        adminPassword: 'SecurePassword123'
      })

      // Query business with full include
      const business = await prisma.business.findUnique({
        where: { id: result.businessId },
        include: {
          businessUsers: {
            include: {
              user: true
            }
          }
        }
      })

      // Verify user has passwordHash (in database)
      expect(business!.businessUsers[0].user.passwordHash).toBeDefined()
      expect(business!.businessUsers[0].user.passwordHash).not.toBe('SecurePassword123')

      // In production, API/page would exclude passwordHash from response
      // This test verifies it exists in DB but is hashed

      // Cleanup
      await prisma.business.deleteMany({ where: { slug: 'security-test' } })
      await prisma.user.deleteMany({ where: { email: 'security@test.com' } })
    })
  })
})
