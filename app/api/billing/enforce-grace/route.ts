import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, getSession } from '@/lib/authorization'
import { enforceAllGracePeriods } from '@/lib/billing-enforcement'

export async function POST(request: NextRequest) {
  try {
    // Support two auth methods:
    // 1. Server-to-server with CRON_SECRET (for automated jobs)
    // 2. SUPER_ADMIN session (for manual triggers from admin panel)

    const cronSecret = request.headers.get('x-cron-secret')
    const expectedCronSecret = process.env.CRON_SECRET

    let authorized = false

    // Method 1: Check cron secret (server-to-server)
    if (cronSecret && expectedCronSecret) {
      if (cronSecret === expectedCronSecret) {
        authorized = true
        console.log('Grace enforcement triggered via cron secret')
      }
    }

    // Method 2: Check session (manual trigger)
    if (!authorized) {
      const session = await getSession()
      if (session?.user && (session.user as any).role === 'SUPER_ADMIN') {
        authorized = true
        console.log('Grace enforcement triggered by SUPER_ADMIN:', (session.user as any).id)
      }
    }

    if (!authorized) {
      console.error('Unauthorized grace enforcement attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const results = await enforceAllGracePeriods()

    return NextResponse.json({
      processed: results.length,
      results
    })
  } catch (error: any) {
    console.error('Grace period enforcement error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enforce grace periods' },
      { status: error.message?.includes('Forbidden') ? 403 : 500 }
    )
  }
}
