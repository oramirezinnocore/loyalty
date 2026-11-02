/**
 * Passcreator Apple Wallet Integration
 *
 * Temporary demo integration using Passcreator API to generate Apple Wallet passes
 * without requiring Apple Developer Program membership or certificates.
 *
 * API Documentation: https://developer.passcreator.com/en/api/v3/pass
 */

import { prisma } from '@/lib/prisma'

const PASSCREATOR_API_BASE = 'https://app.passcreator.com/api/v3'
const API_KEY = process.env.PASSCREATOR_API_KEY || ''
const TEMPLATE_ID = process.env.PASSCREATOR_TEMPLATE_ID || ''

interface PasscreatorResponse {
  success: boolean
  description: string
  errors: string[]
  data: {
    identifier: string
    downloadPage: string
    barcodeValue: string
    iPhoneUri: string
    androidUri: string
  }
  statusCode: number
}

/**
 * Check if Passcreator is properly configured
 */
export function isPasscreatorConfigured(): boolean {
  return !!(API_KEY && TEMPLATE_ID && API_KEY !== 'DEMO_API_KEY')
}

/**
 * Create or update a pass in Passcreator for a membership
 * Uses membershipToken as userProvidedId for idempotency
 */
export async function createOrUpdatePass(membershipToken: string): Promise<string> {
  // Fetch membership with all required data
  const membership = await prisma.membership.findUnique({
    where: { publicToken: membershipToken },
    include: {
      customer: true,
      loyaltyProgram: {
        include: {
          business: true,
          rewardDefinitions: {
            where: { isActive: true }
          }
        }
      },
      earnedRewards: {
        where: { status: 'AVAILABLE' },
        include: {
          rewardDefinition: true
        }
      },
      walletPass: true
    }
  })

  if (!membership) {
    throw new Error('Membership not found')
  }

  const business = membership.loyaltyProgram.business
  const program = membership.loyaltyProgram

  // Check if pass already exists
  const existingPassId = membership.walletPass?.applePassId

  if (existingPassId) {
    // Update existing pass
    return await updatePass(existingPassId, membership, business, program)
  }

  // Create new pass
  const payload = {
    data: {
      templateId: TEMPLATE_ID,
      userProvidedId: membershipToken, // Use membership token as external ID
      barcodeValue: membershipToken, // QR code value
      enforceUniqueUserProvidedId: true,
      // Dynamic data - Passcreator template fields
      // Note: Field names depend on template configuration
      // These are standard Store Card fields
      storedValue: membership.currentPoints,
      // Generic properties for custom data
      genericProperties: {
        'customer-name': `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim(),
        'program-name': program.name,
        'program-description': program.publicDescription || '',
        'business-name': business.name,
        'progress': `${membership.currentPoints}/${program.pointsRequired}`,
        'rewards-available': membership.earnedRewards.length.toString()
      }
    }
  }

  try {
    const response = await fetch(`${PASSCREATOR_API_BASE}/pass?async=false`, {
      method: 'POST',
      headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Passcreator API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data: PasscreatorResponse = await response.json()

    if (!data.success) {
      throw new Error(`Pass creation failed: ${data.errors.join(', ')}`)
    }

    // Store pass ID in database
    await prisma.walletPass.upsert({
      where: { membershipId: membership.id },
      create: {
        membershipId: membership.id,
        applePassId: data.data.identifier,
        lastSyncedAt: new Date()
      },
      update: {
        applePassId: data.data.identifier,
        lastSyncedAt: new Date()
      }
    })

    return data.data.iPhoneUri
  } catch (error: any) {
    // Log error but sanitize sensitive data
    console.error('[Passcreator] Pass creation failed:', {
      membership: membershipToken.substring(0, 8),
      error: error.message
    })
    throw error
  }
}

/**
 * Update an existing pass in Passcreator
 */
async function updatePass(
  passIdentifier: string,
  membership: any,
  business: any,
  program: any
): Promise<string> {
  const payload = {
    data: {
      storedValue: membership.currentPoints,
      genericProperties: {
        'customer-name': `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim(),
        'program-name': program.name,
        'program-description': program.publicDescription || '',
        'business-name': business.name,
        'progress': `${membership.currentPoints}/${program.pointsRequired}`,
        'rewards-available': membership.earnedRewards.length.toString()
      }
    }
  }

  try {
    const response = await fetch(`${PASSCREATOR_API_BASE}/pass/${passIdentifier}?async=false`, {
      method: 'PATCH',
      headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Passcreator API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data: PasscreatorResponse = await response.json()

    if (!data.success) {
      throw new Error(`Pass update failed: ${data.errors.join(', ')}`)
    }

    // Update sync timestamp
    await prisma.walletPass.update({
      where: { membershipId: membership.id },
      data: { lastSyncedAt: new Date() }
    })

    return data.data.iPhoneUri
  } catch (error: any) {
    console.error('[Passcreator] Pass update failed:', {
      passId: passIdentifier.substring(0, 8),
      error: error.message
    })
    throw error
  }
}

/**
 * Synchronize membership state to Passcreator (best effort)
 */
export async function syncMembershipToPasscreator(membershipToken: string): Promise<boolean> {
  try {
    if (!isPasscreatorConfigured()) {
      return false
    }

    await createOrUpdatePass(membershipToken)
    return true
  } catch (error) {
    // Sync is best-effort - don't throw
    console.error('[Passcreator] Sync error:', error)
    return false
  }
}
