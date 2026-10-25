import { NextRequest, NextResponse } from 'next/server'
import { generatePkPass, isAppleWalletConfigured } from '@/lib/wallet/apple-wallet'
import { prisma } from '@/lib/prisma'
import { canPerformLoyaltyOperations } from '@/lib/billing-enforcement'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!isAppleWalletConfigured()) {
      return NextResponse.json(
        { error: 'Apple Wallet not configured' },
        { status: 503 }
      )
    }

    const { token: membershipToken } = await params

    if (!membershipToken) {
      return NextResponse.json(
        { error: 'Missing membership token' },
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
        },
        loyaltyProgram: true
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

    // Generate .pkpass file
    const pkpassBuffer = await generatePkPass(membershipToken)

    // Return as .pkpass download
    const businessSlug = membership.customer.business.slug
    const filename = `${businessSlug}-loyalty.pkpass`

    return new NextResponse(pkpassBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pkpassBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate pass' },
      { status: 500 }
    )
  }
}
