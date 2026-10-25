import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapProviderStatus } from '@/lib/payments/mercado-pago'
import { SubscriptionStatus, BusinessStatus } from '@prisma/client'
import { validateMercadoPagoWebhook } from '@/lib/webhook-security'

export async function POST(request: NextRequest) {
  try {
    // Validate webhook signature
    const signature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')

    const body = await request.json()
    const dataId = body.data?.id || body.id

    if (!validateMercadoPagoWebhook(signature, xRequestId, dataId)) {
      console.error('Webhook signature validation failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Basic validation
    if (!body || !body.type) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    // Check for duplicate event
    const eventId = body.id || body.data?.id || `${body.type}-${Date.now()}`

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: String(eventId) }
    })

    if (existingEvent && existingEvent.processed) {
      // Already processed, return success
      return NextResponse.json({ status: 'already_processed' })
    }

    // Store webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: 'mercado_pago',
        eventId: String(eventId),
        eventType: body.type,
        payload: body,
        processed: false
      }
    })

    // Handle different event types
    let subscription = null

    if (body.type === 'subscription' || body.type === 'preapproval') {
      const preapprovalId = body.data?.id

      if (preapprovalId) {
        subscription = await prisma.subscription.findUnique({
          where: { mpPreapprovalId: String(preapprovalId) }
        })

        if (subscription) {
          const status = body.data?.status || body.status

          if (status) {
            const internalStatus = mapProviderStatus(status)

            if (internalStatus) {
              const updates: any = {
                mpStatus: status,
                status: internalStatus
              }

              // Handle specific transitions
              if (internalStatus === SubscriptionStatus.ACTIVE) {
                updates.lastPaymentDate = new Date()
                updates.gracePeriodEndsAt = null

                // Reactivate business if suspended
                await prisma.business.update({
                  where: { id: subscription.businessId },
                  data: { status: BusinessStatus.ACTIVE }
                })
              } else if (internalStatus === SubscriptionStatus.PAST_DUE) {
                // Set grace period
                const gracePeriodDays = parseInt(
                  process.env.BILLING_GRACE_PERIOD_DAYS || '3',
                  10
                )
                updates.gracePeriodEndsAt = new Date(
                  Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000
                )
              } else if (internalStatus === SubscriptionStatus.CANCELED) {
                updates.canceledAt = new Date()
              }

              await prisma.subscription.update({
                where: { id: subscription.id },
                data: updates
              })
            }
          }
        }
      }
    }

    // Mark event as processed
    await prisma.webhookEvent.update({
      where: { eventId: String(eventId) },
      data: {
        processed: true,
        processedAt: new Date()
      }
    })

    return NextResponse.json({ status: 'processed' })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
