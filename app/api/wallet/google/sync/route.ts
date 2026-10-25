import { NextRequest, NextResponse } from 'next/server'
import { syncMembershipToWallet } from '@/lib/wallet/google-wallet'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipToken } = body

    if (!membershipToken) {
      return NextResponse.json(
        { error: 'Missing membershipToken' },
        { status: 400 }
      )
    }

    // Sync to Google Wallet (best effort)
    const success = await syncMembershipToWallet(membershipToken)

    return NextResponse.json({ success })
  } catch (error: any) {
    console.error('Google Wallet sync error:', error)
    // Don't fail - sync is best effort
    return NextResponse.json({ success: false })
  }
}
