/**
 * Join Flow Runtime Tests
 *
 * CRITICAL: Prevents production "Negocio no encontrado" errors
 *
 * Verifies the complete public customer acquisition flow:
 * - API endpoint returns business + program data
 * - Join page can load business data
 * - Registration flow resolves business correctly
 *
 * Regression prevention for production bug where:
 * - Business "Cono Churro" existed
 * - Program was ACTIVE
 * - /join/cono-churro returned "Negocio no encontrado"
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient, LoyaltyProgramStatus, BusinessStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/public/business/[slug]/program/route'
import { POST } from '@/app/api/customer/register/route'

const prisma = new PrismaClient()

describe('Join Flow Runtime Integration', () => {
  let businessId: string
  let programId: string

  beforeAll(async () => {
    // Create production-like scenario
    const business = await prisma.business.create({
      data: {
        name: 'Test Join Flow Business',
        slug: 'test-join-flow',
        status: BusinessStatus.ACTIVE,
        brandColor: '#F97316'
      }
    })
    businessId = business.id

    await prisma.subscription.create({
      data: {
        businessId,
        status: 'ACTIVE',
        priceMonthlyMXN: 299
      }
    })

    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId,
        name: 'Test Program',
        publicDescription: 'Complete 5 purchases',
        pointsRequired: 5,
        status: LoyaltyProgramStatus.ACTIVE
      }
    })
    programId = program.id

    await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programId,
        name: 'Free Item',
        pointsRequired: 5,
        isActive: true
      }
    })
  })

  afterAll(async () => {
    await prisma.business.deleteMany({
      where: { slug: 'test-join-flow' }
    })
    await prisma.$disconnect()
  })

  describe('Public API Endpoint', () => {
    it('should return 200 with business and program data', async () => {
      const request = new NextRequest('http://localhost/api/public/business/test-join-flow/program')
      const params = Promise.resolve({ slug: 'test-join-flow' })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.business).toBeDefined()
      expect(data.business.name).toBe('Test Join Flow Business')
      expect(data.business.slug).toBe('test-join-flow')
      expect(data.program).not.toBeNull()
      expect(data.program.name).toBe('Test Program')
      expect(data.program.pointsRequired).toBe(5)
      expect(data.program.rewardDefinitions).toHaveLength(1)
    })

    it('should handle case-insensitive slugs', async () => {
      const request = new NextRequest('http://localhost/api/public/business/TEST-JOIN-FLOW/program')
      const params = Promise.resolve({ slug: 'TEST-JOIN-FLOW' })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.business.name).toBe('Test Join Flow Business')
    })

    it('should return 404 for unknown business', async () => {
      const request = new NextRequest('http://localhost/api/public/business/unknown-slug/program')
      const params = Promise.resolve({ slug: 'unknown-slug' })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Negocio no encontrado')
    })

    it('should return business with program: null when no active program', async () => {
      // Create business without program
      const noProgramBusiness = await prisma.business.create({
        data: {
          name: 'No Program Business',
          slug: 'no-program-runtime',
          status: BusinessStatus.ACTIVE
        }
      })

      await prisma.subscription.create({
        data: {
          businessId: noProgramBusiness.id,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })

      const request = new NextRequest('http://localhost/api/public/business/no-program-runtime/program')
      const params = Promise.resolve({ slug: 'no-program-runtime' })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.business.name).toBe('No Program Business')
      expect(data.program).toBeNull()

      // Cleanup
      await prisma.business.delete({ where: { id: noProgramBusiness.id } })
    })
  })

  describe('Customer Registration', () => {
    it('should successfully register customer with active program', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'test-join-flow',
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+52 55 1234 5678',
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
        where: { customerId: data.customer.id }
      })
      await prisma.customer.delete({
        where: { id: data.customer.id }
      })
    })

    it('should reject registration for unknown business', async () => {
      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'unknown-business',
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+52 55 9999 9999',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Negocio no encontrado')
    })

    it('should reject registration when no active program', async () => {
      // Create business without program
      const noProgramBusiness = await prisma.business.create({
        data: {
          name: 'No Program Registration Test',
          slug: 'no-program-registration',
          status: BusinessStatus.ACTIVE
        }
      })

      await prisma.subscription.create({
        data: {
          businessId: noProgramBusiness.id,
          status: 'ACTIVE',
          priceMonthlyMXN: 299
        }
      })

      const request = new NextRequest('http://localhost/api/customer/register', {
        method: 'POST',
        body: JSON.stringify({
          businessSlug: 'no-program-registration',
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+52 55 8888 8888',
          termsAccepted: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No hay programa de lealtad activo')

      // Cleanup
      await prisma.business.delete({ where: { id: noProgramBusiness.id } })
    })
  })

  describe('Slug Normalization', () => {
    it('should handle slugs with whitespace', async () => {
      const request = new NextRequest('http://localhost/api/public/business/ test-join-flow /program')
      const params = Promise.resolve({ slug: ' test-join-flow ' })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.business.name).toBe('Test Join Flow Business')
    })

    it('should handle mixed case slugs', async () => {
      const variations = ['Test-Join-Flow', 'TEST-join-FLOW', 'test-Join-Flow']

      for (const slug of variations) {
        const request = new NextRequest(`http://localhost/api/public/business/${slug}/program`)
        const params = Promise.resolve({ slug })

        const response = await GET(request, { params })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.business.name).toBe('Test Join Flow Business')
      }
    })
  })
})
