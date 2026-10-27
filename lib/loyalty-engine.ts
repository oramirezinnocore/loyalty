import { prisma } from './prisma'
import { EarnedRewardStatus, TransactionType, LoyaltyProgramStatus, ProgramType } from '@prisma/client'
import { canPerformLoyaltyOperations } from './billing-enforcement'
import { syncMembershipToWallet } from './wallet/google-wallet'
import { syncMembershipToAppleWallet } from './wallet/apple-wallet'

export async function registerPurchase(membershipId: string, businessId: string, amount?: number) {
  // Check if business can perform loyalty operations
  const canOperate = await canPerformLoyaltyOperations(businessId)
  if (!canOperate) {
    throw new Error('Business cannot perform loyalty operations due to billing status')
  }

  // Verify membership belongs to business
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      customer: true,
      loyaltyProgram: {
        include: {
          rewardDefinitions: {
            where: { isActive: true },
            orderBy: { pointsRequired: 'asc' },
            take: 1
          }
        }
      }
    }
  })

  if (!membership || membership.customer.businessId !== businessId) {
    throw new Error('Membership not found or unauthorized')
  }

  const program = membership.loyaltyProgram

  // PAUSED/ARCHIVED programs cannot earn new points
  if (program.status !== 'ACTIVE') {
    throw new Error('El programa de lealtad no está activo. No se pueden registrar compras.')
  }

  const goal = program.pointsRequired
  const currentPoints = membership.currentPoints

  // Determine transaction type and description based on program type
  const getTransactionTypeAndDescription = (programType: ProgramType) => {
    switch (programType) {
      case ProgramType.VISITS:
        return {
          type: TransactionType.VISIT,
          description: 'Visita registrada'
        }
      case ProgramType.PURCHASES:
        return {
          type: TransactionType.PURCHASE,
          description: 'Compra registrada'
        }
      case ProgramType.STREAK:
        // For now, STREAK uses VISIT type - streak logic to be implemented
        return {
          type: TransactionType.VISIT,
          description: 'Visita consecutiva registrada'
        }
      case ProgramType.POINTS:
        // POINTS not yet implemented
        throw new Error('Programa de puntos no disponible aún')
      default:
        return {
          type: TransactionType.PURCHASE,
          description: 'Actividad registrada'
        }
    }
  }

  const { type, description } = getTransactionTypeAndDescription(program.programType)

  // Create transaction and update membership atomically
  const result = await prisma.$transaction(async (tx) => {
    // Create transaction
    const transaction = await tx.transaction.create({
      data: {
        membershipId,
        type,
        points: 1,
        amount: amount ?? null,
        description
      }
    })

    const newPoints = currentPoints + 1
    const reachedGoal = newPoints >= goal

    // Update membership
    const updatedMembership = await tx.membership.update({
      where: { id: membershipId },
      data: {
        currentPoints: reachedGoal ? 0 : newPoints, // Reset to 0 if goal reached
        lifetimePoints: { increment: 1 },
        lastActivityAt: new Date()
      }
    })

    let earnedReward = null

    // If goal reached, create earned reward
    if (reachedGoal && program.rewardDefinitions.length > 0) {
      const rewardDef = program.rewardDefinitions[0]

      earnedReward = await tx.earnedReward.create({
        data: {
          membershipId,
          rewardDefinitionId: rewardDef.id,
          status: EarnedRewardStatus.AVAILABLE
        }
      })
    }

    return {
      transaction,
      membership: updatedMembership,
      earnedReward,
      reachedGoal
    }
  })

  // Sync to wallets (best effort, don't fail transaction)
  const token = result.membership.publicToken
  syncMembershipToWallet(token).catch(err =>
    console.error('Google Wallet sync failed:', err)
  )
  syncMembershipToAppleWallet(token).catch(err =>
    console.error('Apple Wallet sync failed:', err)
  )

  return result
}

export async function redeemReward(earnedRewardId: string, businessId: string, redeemedById?: string) {
  // Check if business can perform loyalty operations
  const canOperate = await canPerformLoyaltyOperations(businessId)
  if (!canOperate) {
    throw new Error('Business cannot perform loyalty operations due to billing status')
  }

  // Verify reward belongs to business
  const earnedReward = await prisma.earnedReward.findUnique({
    where: { id: earnedRewardId },
    include: {
      membership: {
        include: {
          customer: true,
          loyaltyProgram: true
        }
      },
      redemption: true
    }
  })

  if (!earnedReward) {
    throw new Error('Reward not found')
  }

  if (earnedReward.membership.customer.businessId !== businessId) {
    throw new Error('Unauthorized')
  }

  if (earnedReward.status !== EarnedRewardStatus.AVAILABLE) {
    throw new Error('Reward is not available for redemption')
  }

  if (earnedReward.redemption) {
    throw new Error('Reward already redeemed')
  }

  // Check program status
  const programStatus = earnedReward.membership.loyaltyProgram.status

  // ARCHIVED programs cannot redeem (historical data only)
  if (programStatus === LoyaltyProgramStatus.ARCHIVED) {
    throw new Error('El programa ha finalizado. No se pueden canjear recompensas.')
  }

  // ACTIVE and PAUSED: allow redemption of AVAILABLE rewards earned before pause

  // Redeem atomically
  const result = await prisma.$transaction(async (tx) => {
    // Update earned reward status
    const updated = await tx.earnedReward.update({
      where: { id: earnedRewardId },
      data: {
        status: EarnedRewardStatus.REDEEMED,
        redeemedAt: new Date()
      }
    })

    // Create redemption record
    const redemption = await tx.redemption.create({
      data: {
        earnedRewardId,
        redeemedById,
        redeemedAt: new Date()
      }
    })

    return { earnedReward: updated, redemption }
  })

  // Get membership token for sync
  const membershipForSync = await prisma.membership.findUnique({
    where: { id: earnedReward.membershipId },
    select: { publicToken: true }
  })

  if (membershipForSync) {
    // Sync to wallets (best effort)
    const token = membershipForSync.publicToken
    syncMembershipToWallet(token).catch(err =>
      console.error('Google Wallet sync failed:', err)
    )
    syncMembershipToAppleWallet(token).catch(err =>
      console.error('Apple Wallet sync failed:', err)
    )
  }

  return result
}
