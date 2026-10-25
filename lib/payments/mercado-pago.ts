import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { SubscriptionStatus } from '@prisma/client'

// Mercado Pago configuration
const isMockMode = process.env.MERCADO_PAGO_ACCESS_TOKEN === 'TEST-mock-access-token'

let mpClient: MercadoPagoConfig | null = null
let preApproval: PreApproval | null = null

if (!isMockMode && process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!
  })
  preApproval = new PreApproval(mpClient)
}

// Plan configuration
export const INTUS_LOYALTY_PLAN = {
  name: 'IntusPath Loyalty',
  price: 299,
  currency: 'MXN',
  frequency: 1,
  frequencyType: 'months' as const,
  trialDays: 7
}

// Mock Mercado Pago for development/testing
class MockMercadoPago {
  async createPreapproval(data: any) {
    const mockId = `mock-preapproval-${Date.now()}`
    return {
      id: mockId,
      init_point: `https://www.mercadopago.com.mx/subscriptions/${mockId}`,
      payer_email: data.payer_email,
      status: 'authorized',
      auto_recurring: {
        frequency: data.auto_recurring.frequency,
        frequency_type: data.auto_recurring.frequency_type,
        transaction_amount: data.auto_recurring.transaction_amount,
        currency_id: data.auto_recurring.currency_id
      }
    }
  }

  async getPreapproval(id: string) {
    return {
      id,
      status: 'authorized',
      auto_recurring: {
        transaction_amount: INTUS_LOYALTY_PLAN.price,
        currency_id: 'MXN'
      },
      next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  async updatePreapproval(id: string, data: any) {
    return {
      id,
      status: data.status || 'authorized'
    }
  }
}

const mockMP = new MockMercadoPago()

// Create subscription preapproval
export async function createSubscription(businessId: string, payerEmail: string) {
  // Check if subscription already exists and is active
  const existing = await prisma.subscription.findUnique({
    where: { businessId },
    include: { business: true }
  })

  if (existing && existing.mpPreapprovalId && existing.status === SubscriptionStatus.ACTIVE) {
    throw new Error('Business already has an active subscription')
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId }
  })

  if (!business) {
    throw new Error('Business not found')
  }

  // Create preapproval
  const preapprovalData = {
    reason: INTUS_LOYALTY_PLAN.name,
    payer_email: payerEmail,
    back_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing?success=true`,
    auto_recurring: {
      frequency: INTUS_LOYALTY_PLAN.frequency,
      frequency_type: INTUS_LOYALTY_PLAN.frequencyType,
      transaction_amount: INTUS_LOYALTY_PLAN.price,
      currency_id: INTUS_LOYALTY_PLAN.currency,
      start_date: new Date(Date.now() + INTUS_LOYALTY_PLAN.trialDays * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  let result: any

  if (isMockMode || !preApproval) {
    result = await mockMP.createPreapproval(preapprovalData)
  } else {
    result = await preApproval.create({ body: preapprovalData })
  }

  // Update subscription
  const now = new Date()
  const trialEnd = new Date(now.getTime() + INTUS_LOYALTY_PLAN.trialDays * 24 * 60 * 60 * 1000)

  const subscription = await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      status: SubscriptionStatus.TRIAL,
      priceMonthlyMXN: INTUS_LOYALTY_PLAN.price,
      mpPreapprovalId: result.id,
      mpPayerEmail: payerEmail,
      mpStatus: result.status,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd
    },
    update: {
      mpPreapprovalId: result.id,
      mpPayerEmail: payerEmail,
      mpStatus: result.status,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      status: SubscriptionStatus.TRIAL
    }
  })

  return {
    subscription,
    initPoint: result.init_point
  }
}

// Get subscription status from provider
export async function syncSubscriptionStatus(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription || !subscription.mpPreapprovalId) {
    throw new Error('Subscription not found or not linked to provider')
  }

  let providerData: any

  if (isMockMode || !preApproval) {
    providerData = await mockMP.getPreapproval(subscription.mpPreapprovalId)
  } else {
    providerData = await preApproval.get({ id: subscription.mpPreapprovalId })
  }

  // Map provider status to internal status
  const internalStatus = mapProviderStatus(providerData.status)

  const updates: any = {
    mpStatus: providerData.status
  }

  if (providerData.next_payment_date) {
    updates.nextBillingDate = new Date(providerData.next_payment_date)
  }

  if (internalStatus) {
    updates.status = internalStatus
  }

  return await prisma.subscription.update({
    where: { id: subscriptionId },
    data: updates
  })
}

// Map Mercado Pago status to internal status
export function mapProviderStatus(mpStatus: string): SubscriptionStatus | null {
  switch (mpStatus.toLowerCase()) {
    case 'authorized':
    case 'active':
      return SubscriptionStatus.ACTIVE
    case 'paused':
    case 'pending':
      return SubscriptionStatus.PAST_DUE
    case 'cancelled':
    case 'canceled':
      return SubscriptionStatus.CANCELED
    default:
      return null
  }
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription || !subscription.mpPreapprovalId) {
    throw new Error('Subscription not found or not linked to provider')
  }

  if (isMockMode || !preApproval) {
    await mockMP.updatePreapproval(subscription.mpPreapprovalId, { status: 'cancelled' })
  } else {
    await preApproval.update({
      id: subscription.mpPreapprovalId,
      body: { status: 'cancelled' }
    })
  }

  return await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      mpStatus: 'cancelled'
    }
  })
}

// Validate webhook signature
export function validateWebhookSignature(signature: string, data: string): boolean {
  if (isMockMode) {
    return true // Skip validation in mock mode
  }

  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!webhookSecret) {
    return false
  }

  // Implement actual MP signature validation
  // For now, basic check
  return signature === webhookSecret
}
