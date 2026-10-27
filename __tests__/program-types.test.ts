/**
 * Program Types Tests
 *
 * Tests different program types (VISITS, PURCHASES, STREAK)
 * and their UI/UX behavior in the new program builder
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { ProgramType, LoyaltyProgramStatus } from '@prisma/client'

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Program Types', () => {
  let testBusinessId: string
  let testUserId: string

  beforeAll(async () => {
    // Clean up existing test data
    await prisma.business.deleteMany({
      where: { slug: 'test-program-types' }
    })

    await prisma.user.deleteMany({
      where: { id: 'test-user-types' }
    })

    // Create test user
    const user = await prisma.user.create({
      data: {
        id: 'test-user-types',
        email: 'test-types@example.com',
        name: 'Test User Types',
        passwordHash: 'hash',
        role: 'BUSINESS_ADMIN'
      }
    })
    testUserId = user.id

    // Create test business
    const business = await prisma.business.create({
      data: {
        name: 'Test Program Types Business',
        slug: 'test-program-types',
        status: 'ACTIVE'
      }
    })
    testBusinessId = business.id

    // Create business user relationship
    await prisma.businessUser.create({
      data: {
        businessId: testBusinessId,
        userId: testUserId
      }
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.businessUser.deleteMany({
      where: { businessId: testBusinessId }
    })
    await prisma.loyaltyProgram.deleteMany({
      where: { businessId: testBusinessId }
    })
    await prisma.business.delete({
      where: { id: testBusinessId }
    })
    await prisma.user.delete({
      where: { id: testUserId }
    })
  })

  it('creates a VISITS program with correct type', async () => {
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Cliente Frecuente - Visitas',
        publicDescription: 'Completa 5 visitas y recibe un regalo',
        programType: ProgramType.VISITS,
        pointsRequired: 5,
        reward: '1 café gratis',
        rewardDescription: 'Válido en tienda física',
        status: LoyaltyProgramStatus.DRAFT
      },
      include: {
        rewardDefinitions: true
      }
    })

    expect(program.programType).toBe(ProgramType.VISITS)
    expect(program.pointsRequired).toBe(5)
    expect(program.reward).toBe('1 café gratis')
    expect(program.status).toBe(LoyaltyProgramStatus.DRAFT)

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program.id } })
  })

  it('creates a PURCHASES program with correct type', async () => {
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Cliente Frecuente - Compras',
        publicDescription: 'Completa 10 compras y recibe un descuento',
        programType: ProgramType.PURCHASES,
        pointsRequired: 10,
        reward: '20% de descuento',
        rewardDescription: 'Aplicable en tu próxima compra',
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    expect(program.programType).toBe(ProgramType.PURCHASES)
    expect(program.pointsRequired).toBe(10)
    expect(program.reward).toBe('20% de descuento')

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program.id } })
  })

  it('creates a STREAK program with correct type', async () => {
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Racha Diaria',
        publicDescription: 'Visítanos 7 días consecutivos y gana',
        programType: ProgramType.STREAK,
        pointsRequired: 7,
        reward: 'Sorpresa especial',
        rewardDescription: 'Un regalo por tu dedicación',
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    expect(program.programType).toBe(ProgramType.STREAK)
    expect(program.pointsRequired).toBe(7)

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program.id } })
  })

  it('validates programType is required', async () => {
    await expect(
      prisma.loyaltyProgram.create({
        data: {
          businessId: testBusinessId,
          name: 'Test',
          publicDescription: 'Test',
          // @ts-expect-error Testing missing programType
          programType: undefined,
          pointsRequired: 5,
          reward: 'Test reward',
          status: LoyaltyProgramStatus.DRAFT
        }
      })
    ).rejects.toThrow()
  })

  it('stores additional rules correctly', async () => {
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Programa con Reglas',
        publicDescription: 'Programa con términos y vencimiento',
        programType: ProgramType.VISITS,
        pointsRequired: 5,
        reward: 'Premio',
        termsAndConditions: 'Válido solo en tienda física. No acumulable.',
        expirationDays: 365,
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    expect(program.termsAndConditions).toBe('Válido solo en tienda física. No acumulable.')
    expect(program.expirationDays).toBe(365)

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program.id } })
  })

  it('backward compatibility: existing programs default to VISITS', async () => {
    // This test verifies that the migration set default correctly
    // All existing programs should have programType = VISITS after migration

    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Legacy Program Test',
        publicDescription: 'Test',
        // Not specifying programType - should default to VISITS
        pointsRequired: 5,
        reward: 'Test',
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    expect(program.programType).toBe(ProgramType.VISITS)

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program.id } })
  })

  it('respects unique ACTIVE program constraint', async () => {
    const program1 = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'First Active Program',
        publicDescription: 'First',
        programType: ProgramType.VISITS,
        pointsRequired: 5,
        reward: 'First reward',
        status: LoyaltyProgramStatus.ACTIVE
      }
    })

    // Attempt to create second ACTIVE program should fail
    // (This is enforced by unique partial index from previous migration)
    await expect(
      prisma.loyaltyProgram.create({
        data: {
          businessId: testBusinessId,
          name: 'Second Active Program',
          publicDescription: 'Second',
          programType: ProgramType.PURCHASES,
          pointsRequired: 10,
          reward: 'Second reward',
          status: LoyaltyProgramStatus.ACTIVE
        }
      })
    ).rejects.toThrow()

    // Cleanup
    await prisma.loyaltyProgram.delete({ where: { id: program1.id } })
  })

  it('allows multiple DRAFT programs', async () => {
    const program1 = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Draft Program 1',
        publicDescription: 'First draft',
        programType: ProgramType.VISITS,
        pointsRequired: 5,
        reward: 'Reward 1',
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    const program2 = await prisma.loyaltyProgram.create({
      data: {
        businessId: testBusinessId,
        name: 'Draft Program 2',
        publicDescription: 'Second draft',
        programType: ProgramType.PURCHASES,
        pointsRequired: 10,
        reward: 'Reward 2',
        status: LoyaltyProgramStatus.DRAFT
      }
    })

    expect(program1.status).toBe(LoyaltyProgramStatus.DRAFT)
    expect(program2.status).toBe(LoyaltyProgramStatus.DRAFT)

    // Cleanup
    await prisma.loyaltyProgram.deleteMany({
      where: {
        id: { in: [program1.id, program2.id] }
      }
    })
  })
})
