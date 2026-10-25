import { prisma } from './prisma'
import { BusinessStatus, SubscriptionStatus } from '@prisma/client'

const GRACE_PERIOD_DAYS = parseInt(process.env.BILLING_GRACE_PERIOD_DAYS || '3', 10)

// Check if business can perform loyalty operations
export async function canPerformLoyaltyOperations(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { subscription: true }
  })

  if (!business) {
    return false
  }

  // Suspended businesses cannot perform operations
  if (business.status === BusinessStatus.SUSPENDED) {
    return false
  }

  // Check subscription status
  if (!business.subscription) {
    return false
  }

  const sub = business.subscription

  // Allow operations during TRIAL, ACTIVE, and PAST_DUE (grace period)
  const allowedStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.TRIAL,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE
  ]
  return allowedStatuses.includes(sub.status)
}

// Enforce grace period and suspend if needed
export async function enforceGracePeriod(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { business: true }
  })

  if (!subscription) {
    return null
  }

  // Only process PAST_DUE subscriptions
  if (subscription.status !== SubscriptionStatus.PAST_DUE) {
    return subscription
  }

  const now = new Date()

  // If grace period not set, set it now
  if (!subscription.gracePeriodEndsAt) {
    const gracePeriodEnd = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { gracePeriodEndsAt: gracePeriodEnd }
    })
  }

  // Check if grace period has expired
  if (now > subscription.gracePeriodEndsAt) {
    // Suspend subscription and business
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.SUSPENDED }
      }),
      prisma.business.update({
        where: { id: subscription.businessId },
        data: { status: BusinessStatus.SUSPENDED }
      })
    ])

    return await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })
  }

  return subscription
}

// Run grace period enforcement for all PAST_DUE subscriptions
export async function enforceAllGracePeriods() {
  const pastDueSubscriptions = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.PAST_DUE }
  })

  const results = []

  for (const sub of pastDueSubscriptions) {
    const result = await enforceGracePeriod(sub.id)
    results.push(result)
  }

  return results
}

// Reactivate subscription
export async function reactivateSubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { business: true }
  })

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  // Update subscription and business
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        gracePeriodEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }),
    prisma.business.update({
      where: { id: subscription.businessId },
      data: { status: BusinessStatus.ACTIVE }
    })
  ])

  return await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { business: true }
  })
}

// Calculate MRR (Monthly Recurring Revenue)
export async function calculateMRR(): Promise<number> {
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE }
  })

  return activeSubscriptions.reduce((total, sub) => total + sub.priceMonthlyMXN, 0)
}

// Get subscription status counts
export async function getSubscriptionCounts() {
  const [trial, active, pastDue, canceled, suspended] = await Promise.all([
    prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.CANCELED } }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.SUSPENDED } })
  ])

  return { trial, active, pastDue, canceled, suspended }
}
