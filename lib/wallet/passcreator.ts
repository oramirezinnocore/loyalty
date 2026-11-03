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

// Read configuration at runtime - NOT at build time
function getPasscreatorApiKey(): string {
  return process.env.PASSCREATOR_API_KEY || ''
}

function getPasscreatorTemplateId(): string {
  return process.env.PASSCREATOR_TEMPLATE_ID || ''
}

/**
 * Get absolute logo URL for Passcreator
 * Passcreator requires publicly accessible HTTPS URLs
 */
function getAbsoluteLogoUrl(business: any): string | null {
  if (!business.logoUrl) {
    return null
  }

  // Already absolute URL - use as-is
  if (business.logoUrl.startsWith('http://') || business.logoUrl.startsWith('https://')) {
    return business.logoUrl
  }

  // Relative URL - construct absolute URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                  process.env.NEXTAUTH_URL ||
                  'https://loyalty.intuspath.com'

  // Remove leading slash if present to avoid double slashes
  const path = business.logoUrl.startsWith('/') ? business.logoUrl : `/${business.logoUrl}`

  return `${baseUrl}${path}`
}

/**
 * Get reward description for pass display
 * Uses the active reward definition from the program
 */
function getRewardDescription(program: any): string {
  // Get active reward definitions, sorted by points required (lowest first)
  const activeRewards = program.rewardDefinitions
    .filter((r: any) => r.isActive)
    .sort((a: any, b: any) => a.pointsRequired - b.pointsRequired)

  // Return name of first (lowest points) active reward
  if (activeRewards.length > 0) {
    return activeRewards[0].name
  }

  return 'Sin recompensas'
}

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
  const API_KEY = getPasscreatorApiKey()
  const TEMPLATE_ID = getPasscreatorTemplateId()
  return !!(API_KEY && TEMPLATE_ID && API_KEY !== 'DEMO_API_KEY')
}

/**
 * Create or update a pass in Passcreator for a membership
 * Uses membershipToken as userProvidedId for idempotency
 */
export async function createOrUpdatePass(membershipToken: string): Promise<string> {
  const API_KEY = getPasscreatorApiKey()
  const TEMPLATE_ID = getPasscreatorTemplateId()

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
  const absoluteLogoUrl = getAbsoluteLogoUrl(business)

  const payload = {
    data: {
      // Template identification
      templateId: TEMPLATE_ID,
      userProvidedId: membershipToken, // Use membership token as external ID
      enforceUniqueUserProvidedId: true,

      // System properties
      barcodeValue: membershipToken, // QR code value - DO NOT CHANGE
      storedValue: membership.currentPoints,
      ...(absoluteLogoUrl && { urlToLogo: absoluteLogoUrl }),

      // Dynamic field values - match template additionalProperties
      programName: program.name,
      progress: `${membership.currentPoints} / ${program.pointsRequired} compras`,
      rewardDescription: getRewardDescription(program),

      // Generic properties for metadata/debugging
      genericProperties: {
        'customer-name': `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim(),
        'business-id': business.id,
        'program-id': program.id
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
  const API_KEY = getPasscreatorApiKey()
  const absoluteLogoUrl = getAbsoluteLogoUrl(business)

  const payload = {
    data: {
      // System properties
      storedValue: membership.currentPoints,
      ...(absoluteLogoUrl && { urlToLogo: absoluteLogoUrl }),

      // Dynamic field values - match template additionalProperties
      programName: program.name,
      progress: `${membership.currentPoints} / ${program.pointsRequired} compras`,
      rewardDescription: getRewardDescription(program),

      // Generic properties for metadata
      genericProperties: {
        'customer-name': `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim(),
        'business-id': business.id,
        'program-id': program.id
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
