import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authorization'
import { registerPurchase } from '@/lib/loyalty-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, businessId, amount } = body

    if (!membershipId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify user has access to this business
    await requireBusinessAccess(businessId)

    // Register purchase
    const result = await registerPurchase(membershipId, businessId, amount)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Purchase registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Purchase registration failed' },
      { status: error.message?.includes('Unauthorized') ? 403 : 500 }
    )
  }
}
