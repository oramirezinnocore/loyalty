import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authorization'
import { syncSubscriptionStatus } from '@/lib/payments/mercado-pago'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId } = body

    if (!businessId) {
      return NextResponse.json(
        { error: 'Missing businessId' },
        { status: 400 }
      )
    }

    // Verify user has access
    await requireBusinessAccess(businessId)

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Sync status
    const updated = await syncSubscriptionStatus(subscription.id)

    return NextResponse.json({ subscription: updated })
  } catch (error: any) {
    console.error('Subscription sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    )
  }
}
