import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authorization'
import { createSubscription } from '@/lib/payments/mercado-pago'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, payerEmail } = body

    if (!businessId || !payerEmail) {
      return NextResponse.json(
        { error: 'Missing businessId or payerEmail' },
        { status: 400 }
      )
    }

    // Verify user has access
    await requireBusinessAccess(businessId)

    // Create subscription
    const result = await createSubscription(businessId, payerEmail)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Subscription creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
