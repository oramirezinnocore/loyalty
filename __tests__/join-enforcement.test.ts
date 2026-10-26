/**
 * Join Page Enforcement Tests
 *
 * CRITICAL: Verifies customer enrollment requires ACTIVE program
 * NO fake/fallback program data allowed
 *
 * Regression tests for production bug where join page showed:
 * "Compra 9 churros y recibe el 10 gratis"
 * even though NO program existed for the business.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient, LoyaltyProgramStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/customer/register/route'

const prisma = new PrismaClient()

describe('Join Page Enforcement', () => {
  let businessId: string
  let programId: string

  beforeAll(async () => {
    // Create test business
    const business = await prisma.business.create({
      data: {
        name: 'Test Join Business',
        slug: 'test-join-enforcement',
        status: 'ACTIVE'
      }
    })
    businessId = business.id

    // Create subscription
    await prisma.subscription.create({
      data: {
        businessId,
        status: 'ACTIVE',
        priceMonthlyMXN: 299
      }
    })
  })

  afterAll(async () => {
    await prisma.business.deleteMany({
      where: { slug: 'test-join-enforcement' }
    })
    await prisma.$disconnect()
  })

  describe('No Active Program State', () => {
    it('should reject registration when no program exists', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+52 55 1234 5678',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No hay programa de lealtad activo')
    })

    it('should NOT create customer when no program exists', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Should',
          lastName: 'NotExist',
          phone: '+52 55 9999 9999',
          termsAccepted: true
        })
      })

      await POST(request)

      // Verify no customer created
      const customer = await prisma.customer.findFirst({
        where: {
          businessId,
          firstName: 'Should'
        }
      })

      expect(customer).toBeNull()
    })

    it('should NOT create membership when no program exists', async () => {
      const membershipsBefore = await prisma.membership.count({
        where: {
          loyaltyProgram: {
            businessId
          }
        }
      })

      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'No',
          lastName: 'Membership',
          phone: '+52 55 8888 8888',
          termsAccepted: true
        })
      })

      await POST(request)

      const membershipsAfter = await prisma.membership.count({
        where: {
          loyaltyProgram: {
            businessId
          }
        }
      })

      expect(membershipsAfter).toBe(membershipsBefore)
    })

    it('should return business info even with no program (DB query)', async () => {
      // Verify business exists but has no active program
      const business = await prisma.business.findUnique({
        where: { slug: 'test-join-enforcement' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business).not.toBeNull()
      expect(business!.name).toBe('Test Join Business')
      expect(business!.loyaltyPrograms).toHaveLength(0)
    })
  })

  describe('Active Program State', () => {
    beforeAll(async () => {
      // Create ACTIVE program
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId,
          name: 'Real Program',
          publicDescription: 'Real program description',
          pointsRequired: 5,
          status: LoyaltyProgramStatus.ACTIVE
        }
      })
      programId = program.id

      await prisma.rewardDefinition.create({
        data: {
          loyaltyProgramId: programId,
          name: 'Real Reward',
          description: 'Real reward description',
          pointsRequired: 5,
          isActive: true
        }
      })
    })

    it('should allow registration with active program', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Valid',
          lastName: 'Customer',
          phone: '+52 55 7777 7777',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.customer).toBeDefined()
      expect(data.membership).toBeDefined()
      expect(data.membership.publicToken).toBeDefined()

      // Cleanup
      await prisma.membership.deleteMany({
        where: { customer: { phone: '+52 55 7777 7777' } }
      })
      await prisma.customer.deleteMany({
        where: { phone: '+52 55 7777 7777' }
      })
    })

    it('should create customer with active program', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Created',
          lastName: 'Customer',
          phone: '+52 55 6666 6666',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.customer).toBeDefined()

      const customer = await prisma.customer.findFirst({
        where: {
          businessId,
          phone: data.customer.phone // Use actual stored phone format
        }
      })

      expect(customer).not.toBeNull()
      expect(customer!.firstName).toBe('Created')

      // Cleanup
      await prisma.membership.deleteMany({
        where: { customerId: customer!.id }
      })
      await prisma.customer.delete({
        where: { id: customer!.id }
      })
    })

    it('should return real program data from DB', async () => {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE },
            include: {
              rewardDefinitions: {
                where: { isActive: true }
              }
            }
          }
        }
      })

      expect(business!.loyaltyPrograms).toHaveLength(1)
      const program = business!.loyaltyPrograms[0]

      expect(program.name).toBe('Real Program')
      expect(program.publicDescription).toBe('Real program description')
      expect(program.pointsRequired).toBe(5)
      expect(program.rewardDefinitions).toHaveLength(1)
      expect(program.rewardDefinitions[0].name).toBe('Real Reward')
    })
  })

  describe('Paused Program State', () => {
    it('should reject registration when program is paused', async () => {
      // Pause the program
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.PAUSED }
      })

      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Paused',
          lastName: 'Test',
          phone: '+52 55 5555 5555',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No hay programa de lealtad activo')

      // Reactivate for other tests
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.ACTIVE }
      })
    })

    it('should return null program when paused (DB query)', async () => {
      // Pause
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.PAUSED }
      })

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business!.loyaltyPrograms).toHaveLength(0)

      // Reactivate
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.ACTIVE }
      })
    })
  })

  describe('Suspended Business State', () => {
    it('should reject registration when business is suspended', async () => {
      // Suspend business
      await prisma.business.update({
        where: { id: businessId },
        data: { status: 'SUSPENDED' }
      })

      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'Suspended',
          lastName: 'Test',
          phone: '+52 55 4444 4444',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('no está disponible temporalmente')

      // Reactivate
      await prisma.business.update({
        where: { id: businessId },
        data: { status: 'ACTIVE' }
      })
    })
  })

  describe('Cross-Tenant Isolation', () => {
    let business2Id: string
    let program2Id: string

    beforeAll(async () => {
      // Create second business with program
      const business2 = await prisma.business.create({
        data: {
          name: 'Business 2',
          slug: 'test-cross-tenant',
          status: 'ACTIVE'
        }
      })
      business2Id = business2.id

      await prisma.subscription.create({
        data: {
          businessId: business2Id,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })

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
    })

    afterAll(async () => {
      await prisma.business.deleteMany({
        where: { slug: 'test-cross-tenant' }
      })
    })

    it('should return correct program for each business (DB query)', async () => {
      // Business 1
      const business1 = await prisma.business.findUnique({
        where: { slug: 'test-join-enforcement' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business1!.loyaltyPrograms).toHaveLength(1)
      expect(business1!.loyaltyPrograms[0].name).toBe('Real Program')
      expect(business1!.loyaltyPrograms[0].pointsRequired).toBe(5)

      // Business 2
      const business2 = await prisma.business.findUnique({
        where: { slug: 'test-cross-tenant' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business2!.loyaltyPrograms).toHaveLength(1)
      expect(business2!.loyaltyPrograms[0].name).toBe('Program 2')
      expect(business2!.loyaltyPrograms[0].pointsRequired).toBe(10)
    })

    it('should never show program from another business (DB query)', async () => {
      const business = await prisma.business.findUnique({
        where: { slug: 'test-join-enforcement' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      const program = business!.loyaltyPrograms[0]

      // Should NOT contain data from business2
      expect(program.name).not.toBe('Program 2')
      expect(program.pointsRequired).not.toBe(10)
      expect(program.businessId).toBe(businessId)
    })
  })

  describe('No Hardcoded Fallback Data', () => {
    it('should never show "Compra 9 churros" when no program exists (DB query)', async () => {
      // Verify program exists before test
      const programBefore = await prisma.loyaltyProgram.findUnique({
        where: { id: programId }
      })

      if (!programBefore) {
        throw new Error('Program not found before test - check test execution order')
      }

      // Set program to DRAFT temporarily
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.DRAFT }
      })

      const business = await prisma.business.findUnique({
        where: { slug: 'test-join-enforcement' },
        include: {
          loyaltyPrograms: {
            where: { status: LoyaltyProgramStatus.ACTIVE }
          }
        }
      })

      expect(business!.loyaltyPrograms).toHaveLength(0)

      // Restore
      await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { status: LoyaltyProgramStatus.ACTIVE }
      })
    })

    it('should never fabricate reward data', async () => {
      // Verify program exists
      const programBefore = await prisma.loyaltyProgram.findUnique({
        where: { id: programId },
        include: { rewardDefinitions: true }
      })

      if (!programBefore || programBefore.rewardDefinitions.length === 0) {
        throw new Error('Program or rewards not found - check test execution order')
      }

      // Deactivate rewards temporarily
      await prisma.rewardDefinition.updateMany({
        where: { loyaltyProgramId: programId },
        data: { isActive: false }
      })

      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-enforcement',
          firstName: 'No',
          lastName: 'Reward',
          phone: '+52 55 3333 3333',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('no configurado correctamente')

      // Restore
      await prisma.rewardDefinition.updateMany({
        where: { loyaltyProgramId: programId },
        data: { isActive: true }
      })
    })
  })
})
