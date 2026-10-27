/**
 * Loyalty Program Lifecycle Tests
 *
 * Tests complete program lifecycle management:
 * - State transitions (DRAFT -> ACTIVE -> PAUSED -> ARCHIVED)
 * - One ACTIVE program invariant
 * - Edit restrictions
 * - Delete rules
 * - Public join behavior
 * - Tenant isolation
 * - Historical data integrity
 */

import { prisma } from '@/lib/prisma'
import { LoyaltyProgramStatus } from '@prisma/client'
import {
  createLoyaltyProgram,
  updateProgramStatus,
  updateLoyaltyProgram,
  deleteLoyaltyProgram
} from '@/app/actions/loyalty-program'
import { getPublicBusinessProgramBySlug } from '@/lib/services/public-program'

// Mock authentication
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'BUSINESS_ADMIN' as const
  }
}

jest.mock('@/lib/authorization', () => ({
  getSession: jest.fn(() => Promise.resolve(mockSession)),
  getUserBusinesses: jest.fn(async () => {
    const business = await prisma.business.findFirst({
      where: { name: 'Test Business Lifecycle' }
    })
    return business ? [business] : []
  }),
  requireAuth: jest.fn(() => Promise.resolve(mockSession)),
  requireBusinessAccess: jest.fn(async (businessId: string) => {
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    })
    if (!business) throw new Error('Business not found')
    return { business, user: mockSession.user }
  })
}))

// Mock Next.js revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Loyalty Program Lifecycle', () => {
  let testBusiness: any
  let testBusiness2: any
  let testUser: any

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.business.deleteMany({
      where: {
        slug: {
          in: ['test-lifecycle', 'test-business-2']
        }
      }
    })

    await prisma.user.deleteMany({
      where: {
        id: 'test-user-id'
      }
    })

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-id',
        email: 'lifecycle-test@example.com',
        name: 'Lifecycle Test User',
        passwordHash: 'hashed',
        role: 'BUSINESS_ADMIN'
      }
    })

    // Create test business 1
    testBusiness = await prisma.business.create({
      data: {
        name: 'Test Business Lifecycle',
        slug: 'test-lifecycle',
        status: 'ACTIVE',
        businessUsers: {
          create: {
            userId: testUser.id
          }
        }
      }
    })

    // Create test business 2 for tenant isolation tests
    testBusiness2 = await prisma.business.create({
      data: {
        name: 'Test Business 2',
        slug: 'test-business-2',
        status: 'ACTIVE'
      }
    })
  })

  beforeEach(async () => {
    // Clean up programs before each test
    await prisma.loyaltyProgram.deleteMany({
      where: {
        businessId: {
          in: [testBusiness.id, testBusiness2.id]
        }
      }
    })
  })

  describe('Program Creation', () => {
    it('creates program with DRAFT status by default', async () => {
      const result = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test description',
        pointsRequired: 5,
        reward: 'Test Reward'
      })

      expect(result.success).toBe(true)
      expect(result.programId).toBeDefined()

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: result.programId }
      })

      expect(program?.status).toBe(LoyaltyProgramStatus.DRAFT)
    })

    it('creates program with ACTIVE status if specified', async () => {
      const result = await createLoyaltyProgram({
        name: 'Active Program',
        publicDescription: 'Active description',
        pointsRequired: 5,
        reward: 'Active Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: result.programId }
      })

      expect(program?.status).toBe(LoyaltyProgramStatus.ACTIVE)
    })

    it('prevents creating second ACTIVE program', async () => {
      // Create first ACTIVE program
      await createLoyaltyProgram({
        name: 'First Active',
        publicDescription: 'First',
        pointsRequired: 5,
        reward: 'First Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Try to create second ACTIVE program
      const result = await createLoyaltyProgram({
        name: 'Second Active',
        publicDescription: 'Second',
        pointsRequired: 5,
        reward: 'Second Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors?.status).toContain('Ya existe un programa activo')
    })

    it('allows creating PAUSED program when ACTIVE exists', async () => {
      // Create ACTIVE program
      await createLoyaltyProgram({
        name: 'Active Program',
        publicDescription: 'Active',
        pointsRequired: 5,
        reward: 'Active Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create PAUSED program
      const result = await createLoyaltyProgram({
        name: 'Paused Program',
        publicDescription: 'Paused',
        pointsRequired: 5,
        reward: 'Paused Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Status Transitions', () => {
    it('transitions ACTIVE -> PAUSED', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.PAUSED
      )

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: createResult.programId }
      })

      expect(program?.status).toBe(LoyaltyProgramStatus.PAUSED)
    })

    it('transitions PAUSED -> ACTIVE', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ACTIVE
      )

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: createResult.programId }
      })

      expect(program?.status).toBe(LoyaltyProgramStatus.ACTIVE)
    })

    it('transitions ACTIVE -> ARCHIVED', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: createResult.programId }
      })

      expect(program?.status).toBe(LoyaltyProgramStatus.ARCHIVED)
    })

    it('transitions PAUSED -> ARCHIVED', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      expect(result.success).toBe(true)
    })

    it('prevents ARCHIVED -> ACTIVE transition', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ACTIVE
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('finalizado')
    })

    it('prevents ARCHIVED -> PAUSED transition', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      const result = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.PAUSED
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('finalizado')
    })

    it('prevents activating program when another ACTIVE exists', async () => {
      // Create first ACTIVE program
      const first = await createLoyaltyProgram({
        name: 'First Program',
        publicDescription: 'First',
        pointsRequired: 5,
        reward: 'First Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create PAUSED program
      const second = await createLoyaltyProgram({
        name: 'Second Program',
        publicDescription: 'Second',
        pointsRequired: 5,
        reward: 'Second Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      // Try to activate second program
      const result = await updateProgramStatus(
        second.programId!,
        LoyaltyProgramStatus.ACTIVE
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Ya existe un programa activo')
    })

    it('allows activating program after pausing previous ACTIVE', async () => {
      // Create first ACTIVE program
      const first = await createLoyaltyProgram({
        name: 'First Program',
        publicDescription: 'First',
        pointsRequired: 5,
        reward: 'First Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create second PAUSED program
      const second = await createLoyaltyProgram({
        name: 'Second Program',
        publicDescription: 'Second',
        pointsRequired: 5,
        reward: 'Second Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      // Pause first program
      await updateProgramStatus(first.programId!, LoyaltyProgramStatus.PAUSED)

      // Activate second program
      const result = await updateProgramStatus(
        second.programId!,
        LoyaltyProgramStatus.ACTIVE
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Edit Program', () => {
    it('allows editing ACTIVE program', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Original Name',
        publicDescription: 'Original description',
        pointsRequired: 5,
        reward: 'Original Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const result = await updateLoyaltyProgram(createResult.programId!, {
        name: 'Updated Name',
        publicDescription: 'Updated description'
      })

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: createResult.programId }
      })

      expect(program?.name).toBe('Updated Name')
      expect(program?.publicDescription).toBe('Updated description')
    })

    it('allows editing PAUSED program', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Original Name',
        publicDescription: 'Original description',
        pointsRequired: 5,
        reward: 'Original Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      const result = await updateLoyaltyProgram(createResult.programId!, {
        name: 'Updated Name'
      })

      expect(result.success).toBe(true)
    })

    it('prevents editing ARCHIVED program', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Original Name',
        publicDescription: 'Original description',
        pointsRequired: 5,
        reward: 'Original Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      const result = await updateLoyaltyProgram(createResult.programId!, {
        name: 'Updated Name'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('finalizado')
    })
  })

  describe('Delete Program', () => {
    it('allows deleting program with no activity', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward'
      })

      const result = await deleteLoyaltyProgram(createResult.programId!)

      expect(result.success).toBe(true)

      const program = await prisma.loyaltyProgram.findUnique({
        where: { id: createResult.programId }
      })

      expect(program).toBeNull()
    })

    it('prevents deleting program with memberships', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create customer and membership
      const customer = await prisma.customer.create({
        data: {
          businessId: testBusiness.id,
          firstName: 'Test',
          phone: '+1234567890'
        }
      })

      await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: createResult.programId!
        }
      })

      const result = await deleteLoyaltyProgram(createResult.programId!)

      expect(result.success).toBe(false)
      expect(result.error).toContain('clientes registrados')
    })

    it('prevents deleting program with transactions', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create customer, membership, and transaction
      const customer = await prisma.customer.create({
        data: {
          businessId: testBusiness.id,
          firstName: 'Test',
          phone: '+1234567890'
        }
      })

      const membership = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: createResult.programId!
        }
      })

      await prisma.transaction.create({
        data: {
          membershipId: membership.id,
          type: 'PURCHASE',
          points: 1
        }
      })

      const result = await deleteLoyaltyProgram(createResult.programId!)

      expect(result.success).toBe(false)
      // Note: Transaction existence is protected via membership check
      // (transactions require memberships, so membership check fires first)
      expect(result.error).toContain('clientes registrados')
    })
  })

  describe('Public Join Behavior', () => {
    it('returns program when ACTIVE', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test description',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const result = await getPublicBusinessProgramBySlug('test-lifecycle')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.program).not.toBeNull()
        expect(result.data.program?.name).toBe('Test Program')
      }
    })

    it('returns null program when PAUSED', async () => {
      await createLoyaltyProgram({
        name: 'Paused Program',
        publicDescription: 'Paused',
        pointsRequired: 5,
        reward: 'Paused Reward',
        status: LoyaltyProgramStatus.PAUSED
      })

      const result = await getPublicBusinessProgramBySlug('test-lifecycle')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.program).toBeNull()
      }
    })

    it('returns null program when ARCHIVED', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const updateResult = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )

      // Verify update succeeded
      expect(updateResult.success).toBe(true)

      const result = await getPublicBusinessProgramBySlug('test-lifecycle')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.program).toBeNull()
      }
    })
  })

  describe('Tenant Isolation', () => {
    it('prevents Business A from editing Business B program', async () => {
      // Create program for Business 2
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness2.id,
          name: 'Business 2 Program',
          pointsRequired: 5,
          status: LoyaltyProgramStatus.ACTIVE,
          rewardDefinitions: {
            create: {
              name: 'Business 2 Reward',
              pointsRequired: 5
            }
          }
        }
      })

      // Try to edit from Business 1 context (mocked session)
      const result = await updateLoyaltyProgram(program.id, {
        name: 'Hacked Name'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('no encontrado')
    })

    it('prevents Business A from changing Business B program status', async () => {
      // Create program for Business 2
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness2.id,
          name: 'Business 2 Program',
          pointsRequired: 5,
          status: LoyaltyProgramStatus.ACTIVE,
          rewardDefinitions: {
            create: {
              name: 'Business 2 Reward',
              pointsRequired: 5
            }
          }
        }
      })

      // Try to change status from Business 1 context
      const result = await updateProgramStatus(
        program.id,
        LoyaltyProgramStatus.PAUSED
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('no encontrado')
    })

    it('prevents Business A from deleting Business B program', async () => {
      // Create program for Business 2
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId: testBusiness2.id,
          name: 'Business 2 Program',
          pointsRequired: 5,
          status: LoyaltyProgramStatus.ACTIVE,
          rewardDefinitions: {
            create: {
              name: 'Business 2 Reward',
              pointsRequired: 5
            }
          }
        }
      })

      // Try to delete from Business 1 context
      const result = await deleteLoyaltyProgram(program.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('no encontrado')
    })
  })

  describe('Historical Data Integrity', () => {
    it('preserves memberships when program is archived', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create customer and membership
      const customer = await prisma.customer.create({
        data: {
          businessId: testBusiness.id,
          firstName: 'Test',
          phone: '+1234567890'
        }
      })

      const membership = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: createResult.programId!,
          currentPoints: 3
        }
      })

      // Archive program
      const archiveResult = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )
      expect(archiveResult.success).toBe(true)

      // Verify membership still exists with correct data
      const verifyMembership = await prisma.membership.findUnique({
        where: { id: membership.id }
      })

      expect(verifyMembership).not.toBeNull()
      expect(verifyMembership?.currentPoints).toBe(3)
      expect(verifyMembership?.loyaltyProgramId).toBe(createResult.programId)
    })

    it('preserves transactions when program is archived', async () => {
      const createResult = await createLoyaltyProgram({
        name: 'Test Program',
        publicDescription: 'Test',
        pointsRequired: 5,
        reward: 'Test Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Create customer, membership, and transaction
      const customer = await prisma.customer.create({
        data: {
          businessId: testBusiness.id,
          firstName: 'Test',
          phone: '+1234567890'
        }
      })

      const membership = await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: createResult.programId!
        }
      })

      const transaction = await prisma.transaction.create({
        data: {
          membershipId: membership.id,
          type: 'PURCHASE',
          points: 1
        }
      })

      // Archive program
      const archiveResult = await updateProgramStatus(
        createResult.programId!,
        LoyaltyProgramStatus.ARCHIVED
      )
      expect(archiveResult.success).toBe(true)

      // Verify transaction still exists
      const verifyTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id }
      })

      expect(verifyTransaction).not.toBeNull()
      expect(verifyTransaction?.points).toBe(1)
    })

    it('creates new program without affecting old program data', async () => {
      // Create first program with data
      const first = await createLoyaltyProgram({
        name: 'First Program',
        publicDescription: 'First',
        pointsRequired: 5,
        reward: 'First Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      const customer = await prisma.customer.create({
        data: {
          businessId: testBusiness.id,
          firstName: 'Test',
          phone: '+1234567890'
        }
      })

      await prisma.membership.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: first.programId!,
          currentPoints: 3
        }
      })

      // Archive first program
      const archiveResult = await updateProgramStatus(first.programId!, LoyaltyProgramStatus.ARCHIVED)
      expect(archiveResult.success).toBe(true)

      // Create second program
      const second = await createLoyaltyProgram({
        name: 'Second Program',
        publicDescription: 'Second',
        pointsRequired: 10,
        reward: 'Second Reward',
        status: LoyaltyProgramStatus.ACTIVE
      })

      // Verify first program data is intact
      const firstProgram = await prisma.loyaltyProgram.findUnique({
        where: { id: first.programId },
        include: {
          memberships: true
        }
      })

      expect(firstProgram?.status).toBe(LoyaltyProgramStatus.ARCHIVED)
      expect(firstProgram?.memberships).toHaveLength(1)
      expect(firstProgram?.memberships[0].currentPoints).toBe(3)

      // Verify second program is separate
      const secondProgram = await prisma.loyaltyProgram.findUnique({
        where: { id: second.programId }
      })

      expect(secondProgram?.status).toBe(LoyaltyProgramStatus.ACTIVE)
      expect(secondProgram?.pointsRequired).toBe(10)
    })
  })
})
