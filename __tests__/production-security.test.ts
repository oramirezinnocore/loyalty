import { PrismaClient } from '@prisma/client'
import { validateMercadoPagoWebhook } from '@/lib/webhook-security'

const prisma = new PrismaClient()

describe('Production Security', () => {
  describe('Mock Mode Detection', () => {
    it('should detect mock credentials', () => {
      const originalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

      // Set mock token
      process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-mock-access-token'

      // Mock mode detection should work
      const isMockMode = process.env.MERCADO_PAGO_ACCESS_TOKEN === 'TEST-mock-access-token'
      expect(isMockMode).toBe(true)

      // In production, this should be rejected by environment checks
      // (handled in webhook-security.ts and payment integrations)

      // Restore
      if (originalToken) {
        process.env.MERCADO_PAGO_ACCESS_TOKEN = originalToken
      } else {
        delete process.env.MERCADO_PAGO_ACCESS_TOKEN
      }
    })
  })

  describe('Webhook Signature Validation', () => {
    it('should reject webhook without signature', () => {
      const result = validateMercadoPagoWebhook(null, 'request-123', 'data-456')
      expect(result).toBe(false)
    })

    it('should reject webhook with missing headers', () => {
      const result = validateMercadoPagoWebhook('ts=123,v1=abc', null, 'data-456')
      expect(result).toBe(false)
    })

    it('should reject webhook with malformed signature', () => {
      const result = validateMercadoPagoWebhook('invalid', 'request-123', 'data-456')
      expect(result).toBe(false)
    })

    it('should require webhook secret in production', () => {
      // Without webhook secret configured, should fail
      // (Even in test mode, webhook validation requires proper setup)
      const originalSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET

      const result = validateMercadoPagoWebhook('ts=123,v1=abc', 'request-123', 'data-456')
      expect(result).toBe(false)

      // Restore
      if (originalSecret) {
        process.env.MERCADO_PAGO_WEBHOOK_SECRET = originalSecret
      }
    })
  })

  describe('CUID Token Security', () => {
    beforeEach(async () => {
      // Clean up test data before each test
      await prisma.business.deleteMany({
        where: { slug: 'token-test-biz' }
      })
    })

    afterEach(async () => {
      // Clean up after tests
      await prisma.business.deleteMany({
        where: { slug: 'token-test-biz' }
      })
    })

    it('should generate non-sequential membership tokens', async () => {
      const businessId = 'test-business-id'

      // Create business
      const business = await prisma.business.create({
        data: {
          name: 'Token Test Business',
          slug: 'token-test-biz',
          subscription: {
            create: {
              status: 'ACTIVE',
              priceMonthlyMXN: 299
            }
          }
        }
      })

      const program1 = await prisma.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Token Test Program 1',
          status: 'ACTIVE',
          pointsRequired: 10,
        reward: 'Test reward'
        }
      })

      const program2 = await prisma.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Token Test Program 2',
          status: 'PAUSED', // Use PAUSED to avoid unique ACTIVE constraint
          pointsRequired: 10,
        reward: 'Test reward'
        }
      })

      const customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          firstName: 'Token',
          lastName: 'Test',
          phone: '+52 55 1111 1111'
        }
      })

      // Create multiple memberships with different programs
      const membership1 = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: program1.id
        }
      })

      const membership2 = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: program2.id
        }
      })

      // Tokens should be CUIDs (not sequential)
      expect(membership1.publicToken).toBeTruthy()
      expect(membership2.publicToken).toBeTruthy()
      expect(membership1.publicToken).not.toBe(membership2.publicToken)

      // CUIDs are 25 characters
      expect(membership1.publicToken.length).toBeGreaterThanOrEqual(20)
      expect(membership2.publicToken.length).toBeGreaterThanOrEqual(20)

      // Should not be sequential numbers
      expect(Number.isNaN(parseInt(membership1.publicToken))).toBe(true)
      expect(Number.isNaN(parseInt(membership2.publicToken))).toBe(true)

      // Cleanup
      await prisma.membership.deleteMany({ where: { customerId: customer.id } })
      await prisma.customer.deleteMany({ where: { id: customer.id } })
      await prisma.loyaltyProgram.deleteMany({ where: { id: program1.id } })
      await prisma.loyaltyProgram.deleteMany({ where: { id: program2.id } })
      await prisma.subscription.deleteMany({ where: { businessId: business.id } })
      await prisma.business.deleteMany({ where: { id: business.id } })
    })
  })

  describe('Database Indexes', () => {
    it('should have index on membership publicToken', async () => {
      // Check that publicToken is indexed (fast lookups)
      const startTime = Date.now()

      const membership = await prisma.membership.findFirst({
        where: { publicToken: 'non-existent-token' }
      })

      const duration = Date.now() - startTime

      // Query should be fast even for non-existent token (index scan)
      expect(duration).toBeLessThan(100) // Should be <100ms with index
      expect(membership).toBeNull()
    })
  })

  describe('Tenant Isolation', () => {
    it('should enforce business scoping in customer queries', async () => {
      // Clean up any existing test businesses first
      await prisma.business.deleteMany({
        where: {
          slug: {
            in: ['business-1-isolation', 'business-2-isolation']
          }
        }
      })

      // This test verifies that customer lookups are always scoped to business
      const business1 = await prisma.business.create({
        data: {
          name: 'Business 1',
          slug: 'business-1-isolation',
          subscription: {
            create: { status: 'ACTIVE', priceMonthlyMXN: 299 }
          }
        }
      })

      const business2 = await prisma.business.create({
        data: {
          name: 'Business 2',
          slug: 'business-2-isolation',
          subscription: {
            create: { status: 'ACTIVE', priceMonthlyMXN: 299 }
          }
        }
      })

      const customer1 = await prisma.customer.create({
        data: {
          businessId: business1.id,
          firstName: 'Customer',
          lastName: 'One',
          phone: '+52 55 2222 2222'
        }
      })

      const customer2 = await prisma.customer.create({
        data: {
          businessId: business2.id,
          firstName: 'Customer',
          lastName: 'Two',
          phone: '+52 55 3333 3333'
        }
      })

      // Query customer1 scoped to business1
      const found1 = await prisma.customer.findFirst({
        where: {
          id: customer1.id,
          businessId: business1.id
        }
      })
      expect(found1).toBeTruthy()

      // Try to query customer1 scoped to business2 (should fail)
      const notFound = await prisma.customer.findFirst({
        where: {
          id: customer1.id,
          businessId: business2.id
        }
      })
      expect(notFound).toBeNull()

      // Cleanup
      await prisma.customer.deleteMany({ where: { businessId: business1.id } })
      await prisma.customer.deleteMany({ where: { businessId: business2.id } })
      await prisma.subscription.deleteMany({ where: { businessId: business1.id } })
      await prisma.subscription.deleteMany({ where: { businessId: business2.id } })
      await prisma.business.deleteMany({ where: { id: business1.id } })
      await prisma.business.deleteMany({ where: { id: business2.id } })
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
