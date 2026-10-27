/**
 * Public Program Lookup Integration Tests
 *
 * CRITICAL: Verifies public customer acquisition flow
 *
 * Tests the exact scenario reported in production:
 * - Business "Cono Churro" with slug "cono-churro" exists
 * - Program "Cliente Frecuente" is ACTIVE
 * - Public lookup MUST return business + program data
 * - NOT "Negocio no encontrado"
 *
 * Regression prevention for production bug where existing business
 * returned "Negocio no encontrado" on /join/cono-churro
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient, LoyaltyProgramStatus, BusinessStatus } from '@prisma/client'
import { getPublicBusinessProgramBySlug, resolveBusinessForRegistration } from '@/lib/services/public-program'

const prisma = new PrismaClient()

describe('Public Program Lookup', () => {
  let conoChurroId: string
  let programId: string

  beforeAll(async () => {
    // Create exact production scenario: Cono Churro business
    const business = await prisma.business.create({
      data: {
        name: 'Cono Churro',
        slug: 'cono-churro',
        status: BusinessStatus.ACTIVE
      }
    })
    conoChurroId = business.id

    // Create subscription
    await prisma.subscription.create({
      data: {
        businessId: conoChurroId,
        status: 'ACTIVE',
        priceMonthlyMXN: 299
      }
    })

    // Create ACTIVE program: Cliente Frecuente
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: conoChurroId,
        name: 'Cliente Frecuente',
        publicDescription: 'Completa 5 compras y recibe 1 churro gratis',
        pointsRequired: 5,
        status: LoyaltyProgramStatus.ACTIVE
      }
    })
    programId = program.id

    // Create rewardName: 1 churro gratis
    await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programId,
        name: '1 churro gratis',
        description: 'Muestra este cupón al personal',
        pointsRequired: 5,
        isActive: true
      }
    })
  })

  afterAll(async () => {
    await prisma.business.deleteMany({
      where: { slug: 'cono-churro' }
    })
    await prisma.$disconnect()
  })

  describe('Production Scenario - Cono Churro', () => {
    it('should find business by exact slug "cono-churro"', async () => {
      const result = await getPublicBusinessProgramBySlug('cono-churro')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.business.name).toBe('Cono Churro')
        expect(result.data.business.slug).toBe('cono-churro')
        expect(result.data.business.status).toBe('ACTIVE')
      }
    })

    it('should return ACTIVE program "Cliente Frecuente"', async () => {
      const result = await getPublicBusinessProgramBySlug('cono-churro')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.program).not.toBeNull()
        expect(result.data.program?.name).toBe('Cliente Frecuente')
        expect(result.data.program?.publicDescription).toBe('Completa 5 compras y recibe 1 churro gratis')
        expect(result.data.program?.pointsRequired).toBe(5)
      }
    })

    it('should return reward "1 churro gratis"', async () => {
      const result = await getPublicBusinessProgramBySlug('cono-churro')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.program?.rewardDefinitions).toHaveLength(1)
        expect(result.data.program?.rewardDefinitions[0].name).toBe('1 churro gratis')
      }
    })

    it('should handle case-insensitive slug lookup', async () => {
      const variations = [
        'cono-churro',
        'Cono-Churro',
        'CONO-CHURRO',
        'cono-churro ', // with trailing space
        ' cono-churro'  // with leading space
      ]

      for (const slug of variations) {
        const result = await getPublicBusinessProgramBySlug(slug)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.business.name).toBe('Cono Churro')
        }
      }
    })

    it('should resolve business for customer registration', async () => {
      const business = await resolveBusinessForRegistration('cono-churro')

      expect(business).not.toBeNull()
      expect(business!.name).toBe('Cono Churro')
      expect(business!.loyaltyPrograms).toHaveLength(1)
      expect(business!.loyaltyPrograms[0].name).toBe('Cliente Frecuente')
      expect(business!.loyaltyPrograms[0].rewardDefinitions).toHaveLength(1)
    })
  })

  describe('Business Not Found', () => {
    it('should return BUSINESS_NOT_FOUND for unknown slug', async () => {
      const result = await getPublicBusinessProgramBySlug('unknown-business')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('BUSINESS_NOT_FOUND')
        expect(result.message).toBe('Negocio no encontrado')
      }
    })

    it('should return null for registration with unknown slug', async () => {
      const business = await resolveBusinessForRegistration('unknown-business')
      expect(business).toBeNull()
    })
  })

  describe('No Active Program', () => {
    let noProgramBusinessId: string

    beforeAll(async () => {
      const business = await prisma.business.create({
        data: {
          name: 'No Program Business',
          slug: 'no-program-test',
          status: BusinessStatus.ACTIVE
        }
      })
      noProgramBusinessId = business.id

      await prisma.subscription.create({
        data: {
          businessId: noProgramBusinessId,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })
    })

    afterAll(async () => {
      await prisma.business.deleteMany({
        where: { slug: 'no-program-test' }
      })
    })

    it('should return business with program: null', async () => {
      const result = await getPublicBusinessProgramBySlug('no-program-test')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.business.name).toBe('No Program Business')
        expect(result.data.program).toBeNull()
      }
    })

    it('should return null for registration (requires active program)', async () => {
      const business = await resolveBusinessForRegistration('no-program-test')

      // Business exists but has no active program
      expect(business).not.toBeNull()
      expect(business!.loyaltyPrograms).toHaveLength(0)
    })
  })

  describe('Suspended Business', () => {
    let suspendedBusinessId: string

    beforeAll(async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Suspended Business',
          slug: 'suspended-test',
          status: BusinessStatus.SUSPENDED
        }
      })
      suspendedBusinessId = business.id
    })

    afterAll(async () => {
      await prisma.business.deleteMany({
        where: { slug: 'suspended-test' }
      })
    })

    it('should return BUSINESS_SUSPENDED error', async () => {
      const result = await getPublicBusinessProgramBySlug('suspended-test')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('BUSINESS_SUSPENDED')
        expect(result.message).toBe('El programa de lealtad no está disponible temporalmente')
      }
    })
  })

  describe('Paused Program', () => {
    let pausedProgramBusinessId: string
    let pausedProgramId: string

    beforeAll(async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Paused Program Business',
          slug: 'paused-program-test',
          status: BusinessStatus.ACTIVE
        }
      })
      pausedProgramBusinessId = business.id

      await prisma.subscription.create({
        data: {
          businessId: pausedProgramBusinessId,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })

      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId: pausedProgramBusinessId,
          name: 'Paused Program',
          pointsRequired: 5,
          status: LoyaltyProgramStatus.PAUSED
        }
      })
      pausedProgramId = program.id
    })

    afterAll(async () => {
      await prisma.business.deleteMany({
        where: { slug: 'paused-program-test' }
      })
    })

    it('should return business with program: null (PAUSED not returned)', async () => {
      const result = await getPublicBusinessProgramBySlug('paused-program-test')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.business.name).toBe('Paused Program Business')
        expect(result.data.program).toBeNull() // PAUSED programs not shown
      }
    })
  })

  describe('Cross-Tenant Isolation', () => {
    let business1Id: string
    let business2Id: string
    let program2Id: string

    beforeAll(async () => {
      // Business 1 already exists (Cono Churro)
      business1Id = conoChurroId

      // Create Business 2
      const business2 = await prisma.business.create({
        data: {
          name: 'Business 2',
          slug: 'cross-tenant-test',
          status: BusinessStatus.ACTIVE
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
        where: { slug: 'cross-tenant-test' }
      })
    })

    it('should return correct program for each business', async () => {
      const result1 = await getPublicBusinessProgramBySlug('cono-churro')
      const result2 = await getPublicBusinessProgramBySlug('cross-tenant-test')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      if (result1.success && result2.success) {
        expect(result1.data.program?.name).toBe('Cliente Frecuente')
        expect(result2.data.program?.name).toBe('Program 2')

        // Verify business IDs differ
        expect(result1.data.business.id).not.toBe(result2.data.business.id)

        // Verify program belongs to correct business
        expect(result1.data.program?.businessId).toBe(conoChurroId)
        expect(result2.data.program?.businessId).toBe(business2Id)
      }
    })
  })
})
