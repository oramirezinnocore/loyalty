import { NextRequest, NextResponse } from 'next/server'
import { createOrUpdateLoyaltyObject, generateSaveUrl, isGoogleWalletConfigured } from '@/lib/wallet/google-wallet'
import { prisma } from '@/lib/prisma'
import { canPerformLoyaltyOperations } from '@/lib/billing-enforcement'

export async function POST(request: NextRequest) {
  try {
    if (!isGoogleWalletConfigured()) {
      return NextResponse.json(
        { error: 'Google Wallet not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { membershipToken } = body

    if (!membershipToken) {
      return NextResponse.json(
        { error: 'Missing membershipToken' },
        { status: 400 }
      )
    }

    // Verify membership exists and get business
    const membership = await prisma.membership.findUnique({
      where: { publicToken: membershipToken },
      include: {
        customer: {
          include: {
            business: true
          }
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      )
    }

    // Check if business can perform operations
    const canOperate = await canPerformLoyaltyOperations(membership.customer.businessId)
    if (!canOperate) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }

    // Create/update Google Wallet object
    const walletObject = await createOrUpdateLoyaltyObject(membershipToken)

    // Generate save URL
    const saveUrl = generateSaveUrl(membershipToken)

    return NextResponse.json({
      walletObject,
      saveUrl
    })
  } catch (error: any) {
    console.error('Google Wallet creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create wallet pass' },
      { status: 500 }
    )
  }
}
