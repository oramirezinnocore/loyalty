import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authorization'
import { redeemReward } from '@/lib/loyalty-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireBusinessAccess('')
    const user = session.user as any

    const body = await request.json()
    const { earnedRewardId, businessId } = body

    if (!earnedRewardId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify user has access to this business
    await requireBusinessAccess(businessId)

    // Redeem reward
    const result = await redeemReward(earnedRewardId, businessId, user.id)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Reward redemption error:', error)
    return NextResponse.json(
      { error: error.message || 'Redemption failed' },
      { status: error.message?.includes('Unauthorized') ? 403 : 500 }
    )
  }
}
