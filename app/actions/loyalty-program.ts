'use server'

import { prisma } from '@/lib/prisma'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { revalidatePath } from 'next/cache'
import { LoyaltyProgramStatus } from '@prisma/client'

interface CreateProgramInput {
  name: string
  description?: string
  publicDescription?: string
  pointsRequired: number
  rewardName: string
  rewardDescription?: string
  status?: LoyaltyProgramStatus
}

interface CreateProgramResult {
  success: boolean
  programId?: string
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Create loyalty program with reward definition
 * ATOMIC: Creates program + reward in single transaction
 * TENANT-SAFE: Derives businessId from authenticated user
 */
export async function createLoyaltyProgram(
  input: CreateProgramInput
): Promise<CreateProgramResult> {
  try {
    // 1. Authentication & Authorization
    const session = await getSession()
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized: Authentication required'
      }
    }

    const user = session.user as any
    const businesses = await getUserBusinesses(user.id, user.role)

    if (businesses.length === 0) {
      return {
        success: false,
        error: 'No business access'
      }
    }

    // Get businessId from user's business (tenant-safe)
    const businessId = businesses[0].id

    // 2. Input validation
    const fieldErrors: Record<string, string> = {}

    if (!input.name || input.name.trim().length === 0) {
      fieldErrors.name = 'El nombre del programa es requerido'
    } else if (input.name.length > 200) {
      fieldErrors.name = 'El nombre debe tener menos de 200 caracteres'
    }

    if (!input.pointsRequired || input.pointsRequired < 1) {
      fieldErrors.pointsRequired = 'La meta debe ser al menos 1'
    } else if (input.pointsRequired > 100) {
      fieldErrors.pointsRequired = 'La meta no puede exceder 100'
    }

    if (!input.rewardName || input.rewardName.trim().length === 0) {
      fieldErrors.rewardName = 'El nombre de la recompensa es requerido'
    } else if (input.rewardName.length > 200) {
      fieldErrors.rewardName = 'El nombre de la recompensa debe tener menos de 200 caracteres'
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        success: false,
        fieldErrors
      }
    }

    // 3. Check for existing ACTIVE program
    if (input.status === LoyaltyProgramStatus.ACTIVE) {
      const existingActiveProgram = await prisma.loyaltyProgram.findFirst({
        where: {
          businessId,
          status: LoyaltyProgramStatus.ACTIVE
        }
      })

      if (existingActiveProgram) {
        return {
          success: false,
          fieldErrors: {
            status: 'Ya existe un programa activo. Pausa el programa actual primero.'
          }
        }
      }
    }

    // 4. Atomic transaction: Create program + reward definition
    const result = await prisma.$transaction(async (tx) => {
      // Create loyalty program
      const program = await tx.loyaltyProgram.create({
        data: {
          businessId,
          name: input.name.trim(),
          description: input.description?.trim(),
          publicDescription: input.publicDescription?.trim(),
          pointsRequired: input.pointsRequired,
          status: input.status || LoyaltyProgramStatus.DRAFT
        }
      })

      // Create reward definition
      await tx.rewardDefinition.create({
        data: {
          loyaltyProgramId: program.id,
          name: input.rewardName.trim(),
          description: input.rewardDescription?.trim(),
          pointsRequired: input.pointsRequired,
          isActive: true
        }
      })

      return { programId: program.id }
    })

    // 5. Revalidate cache
    revalidatePath('/admin/program')
    revalidatePath('/admin')

    return {
      success: true,
      programId: result.programId
    }
  } catch (error: any) {
    console.error('Program creation failed:', error)

    return {
      success: false,
      error: 'Error al crear el programa. Intenta de nuevo.'
    }
  }
}

/**
 * Update loyalty program status
 * TENANT-SAFE: Verifies business ownership
 * Enforces lifecycle transitions:
 * - ACTIVE -> PAUSED
 * - ACTIVE -> ARCHIVED
 * - PAUSED -> ACTIVE
 * - PAUSED -> ARCHIVED
 * - ARCHIVED is terminal (cannot transition to any state)
 */
export async function updateProgramStatus(
  programId: string,
  newStatus: LoyaltyProgramStatus
): Promise<CreateProgramResult> {
  try {
    // 1. Authentication & Authorization
    const session = await getSession()
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized: Authentication required'
      }
    }

    const user = session.user as any
    const businesses = await getUserBusinesses(user.id, user.role)

    if (businesses.length === 0) {
      return {
        success: false,
        error: 'No business access'
      }
    }

    const businessId = businesses[0].id

    // 2. Verify program ownership
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        id: programId,
        businessId // Tenant isolation
      }
    })

    if (!program) {
      return {
        success: false,
        error: 'Programa no encontrado'
      }
    }

    // 3. Validate status transition
    if (program.status === newStatus) {
      return {
        success: false,
        error: 'El programa ya tiene este estado'
      }
    }

    // 4. ARCHIVED is terminal - cannot be changed
    if (program.status === LoyaltyProgramStatus.ARCHIVED) {
      return {
        success: false,
        error: 'No se puede cambiar el estado de un programa finalizado'
      }
    }

    // 5. Validate allowed transitions
    const validTransitions: Record<LoyaltyProgramStatus, LoyaltyProgramStatus[]> = {
      [LoyaltyProgramStatus.DRAFT]: [LoyaltyProgramStatus.ACTIVE, LoyaltyProgramStatus.PAUSED],
      [LoyaltyProgramStatus.ACTIVE]: [LoyaltyProgramStatus.PAUSED, LoyaltyProgramStatus.ARCHIVED],
      [LoyaltyProgramStatus.PAUSED]: [LoyaltyProgramStatus.ACTIVE, LoyaltyProgramStatus.ARCHIVED],
      [LoyaltyProgramStatus.ARCHIVED]: [] // Terminal
    }

    if (!validTransitions[program.status].includes(newStatus)) {
      return {
        success: false,
        error: `No se puede cambiar de ${program.status} a ${newStatus}`
      }
    }

    // 6. Check for existing ACTIVE program when activating
    if (newStatus === LoyaltyProgramStatus.ACTIVE) {
      const existingActiveProgram = await prisma.loyaltyProgram.findFirst({
        where: {
          businessId,
          status: LoyaltyProgramStatus.ACTIVE,
          id: { not: programId } // Exclude current program
        }
      })

      if (existingActiveProgram) {
        return {
          success: false,
          error: 'Ya existe un programa activo. Pausa el programa actual primero.'
        }
      }
    }

    // 7. Update status
    await prisma.loyaltyProgram.update({
      where: { id: programId },
      data: { status: newStatus }
    })

    // 8. Revalidate cache
    revalidatePath('/admin/program')
    revalidatePath('/admin')
    revalidatePath(`/join/${businesses[0].slug}`)

    return {
      success: true,
      programId
    }
  } catch (error: any) {
    console.error('Program status update failed:', error)

    return {
      success: false,
      error: 'Error al actualizar el estado del programa'
    }
  }
}

/**
 * Update loyalty program details
 * TENANT-SAFE: Verifies business ownership
 * ARCHIVED programs cannot be edited
 */
export async function updateLoyaltyProgram(
  programId: string,
  input: Partial<CreateProgramInput>
): Promise<CreateProgramResult> {
  try {
    // 1. Authentication & Authorization
    const session = await getSession()
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized: Authentication required'
      }
    }

    const user = session.user as any
    const businesses = await getUserBusinesses(user.id, user.role)

    if (businesses.length === 0) {
      return {
        success: false,
        error: 'No business access'
      }
    }

    const businessId = businesses[0].id

    // 2. Verify program ownership
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        id: programId,
        businessId // Tenant isolation
      },
      include: {
        rewardDefinitions: {
          where: { isActive: true }
        }
      }
    })

    if (!program) {
      return {
        success: false,
        error: 'Programa no encontrado'
      }
    }

    // 3. Block editing ARCHIVED programs
    if (program.status === LoyaltyProgramStatus.ARCHIVED) {
      return {
        success: false,
        error: 'No se puede editar un programa finalizado'
      }
    }

    // 4. Input validation
    const fieldErrors: Record<string, string> = {}

    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        fieldErrors.name = 'El nombre del programa es requerido'
      } else if (input.name.length > 200) {
        fieldErrors.name = 'El nombre debe tener menos de 200 caracteres'
      }
    }

    if (input.pointsRequired !== undefined) {
      if (!input.pointsRequired || input.pointsRequired < 1) {
        fieldErrors.pointsRequired = 'La meta debe ser al menos 1'
      } else if (input.pointsRequired > 100) {
        fieldErrors.pointsRequired = 'La meta no puede exceder 100'
      }
    }

    if (input.rewardName !== undefined) {
      if (!input.rewardName || input.rewardName.trim().length === 0) {
        fieldErrors.rewardName = 'El nombre de la recompensa es requerido'
      } else if (input.rewardName.length > 200) {
        fieldErrors.rewardName = 'El nombre de la recompensa debe tener menos de 200 caracteres'
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        success: false,
        fieldErrors
      }
    }

    // 5. Atomic transaction: Update program + reward
    await prisma.$transaction(async (tx) => {
      // Update program
      const updateData: any = {}
      if (input.name) updateData.name = input.name.trim()
      if (input.description !== undefined) updateData.description = input.description?.trim()
      if (input.publicDescription !== undefined) updateData.publicDescription = input.publicDescription?.trim()
      if (input.pointsRequired) updateData.pointsRequired = input.pointsRequired

      await tx.loyaltyProgram.update({
        where: { id: programId },
        data: updateData
      })

      // Update reward definition if needed
      if (input.rewardName || input.rewardDescription !== undefined || input.pointsRequired) {
        const reward = program.rewardDefinitions[0]
        if (reward) {
          const rewardUpdateData: any = {}
          if (input.rewardName) rewardUpdateData.name = input.rewardName.trim()
          if (input.rewardDescription !== undefined) rewardUpdateData.description = input.rewardDescription?.trim()
          if (input.pointsRequired) rewardUpdateData.pointsRequired = input.pointsRequired

          await tx.rewardDefinition.update({
            where: { id: reward.id },
            data: rewardUpdateData
          })
        }
      }
    })

    // 6. Revalidate cache
    revalidatePath('/admin/program')
    revalidatePath(`/admin/program/${programId}/edit`)
    revalidatePath('/admin')
    revalidatePath(`/join/${businesses[0].slug}`)

    return {
      success: true,
      programId
    }
  } catch (error: any) {
    console.error('Program update failed:', error)

    return {
      success: false,
      error: 'Error al actualizar el programa'
    }
  }
}

/**
 * Delete loyalty program (hard delete)
 * ONLY allowed if program has NO activity (memberships, transactions, rewards)
 * TENANT-SAFE: Verifies business ownership
 */
export async function deleteLoyaltyProgram(
  programId: string
): Promise<CreateProgramResult> {
  try {
    // 1. Authentication & Authorization
    const session = await getSession()
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized: Authentication required'
      }
    }

    const user = session.user as any
    const businesses = await getUserBusinesses(user.id, user.role)

    if (businesses.length === 0) {
      return {
        success: false,
        error: 'No business access'
      }
    }

    const businessId = businesses[0].id

    // 2. Verify program ownership
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        id: programId,
        businessId // Tenant isolation
      },
      include: {
        memberships: true,
        _count: {
          select: {
            memberships: true
          }
        }
      }
    })

    if (!program) {
      return {
        success: false,
        error: 'Programa no encontrado'
      }
    }

    // 3. Check for activity - verify NO historical data exists
    const membershipCount = program._count.memberships

    if (membershipCount > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un programa con clientes registrados. Finaliza el programa en su lugar.'
      }
    }

    // Check for transactions (via memberships)
    const transactionCount = await prisma.transaction.count({
      where: {
        membership: {
          loyaltyProgramId: programId
        }
      }
    })

    if (transactionCount > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un programa con transacciones. Finaliza el programa en su lugar.'
      }
    }

    // Check for earned rewards
    const earnedRewardCount = await prisma.earnedReward.count({
      where: {
        membership: {
          loyaltyProgramId: programId
        }
      }
    })

    if (earnedRewardCount > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un programa con recompensas ganadas. Finaliza el programa en su lugar.'
      }
    }

    // Check for redemptions (via earned rewards)
    const redemptionCount = await prisma.redemption.count({
      where: {
        earnedReward: {
          membership: {
            loyaltyProgramId: programId
          }
        }
      }
    })

    if (redemptionCount > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un programa con canjes realizados. Finaliza el programa en su lugar.'
      }
    }

    // 4. Delete program (CASCADE will delete reward definitions)
    await prisma.loyaltyProgram.delete({
      where: { id: programId }
    })

    // 5. Revalidate cache
    revalidatePath('/admin/program')
    revalidatePath('/admin')

    return {
      success: true
    }
  } catch (error: any) {
    console.error('Program deletion failed:', error)

    return {
      success: false,
      error: 'Error al eliminar el programa'
    }
  }
}
