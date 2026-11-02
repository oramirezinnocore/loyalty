import { NextRequest, NextResponse } from 'next/server'
import { generatePkPass, isAppleWalletConfigured, APPLE_WALLET_PROVIDER } from '@/lib/wallet/apple-wallet'
import { createOrUpdatePass } from '@/lib/wallet/passcreator'
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

    // Provider mode: passcreator
    if (APPLE_WALLET_PROVIDER === 'passcreator') {
      // Get iPhoneUri from Passcreator and redirect to .pkpass download
      const iPhoneUri = await createOrUpdatePass(membershipToken)

      // Redirect to Passcreator-hosted .pkpass file
      return NextResponse.redirect(iPhoneUri, 302)
    }

    // Provider mode: native
    // Generate .pkpass file using Apple Developer certificates
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
