import { google } from 'googleapis'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const isMockMode = process.env.GOOGLE_WALLET_PRIVATE_KEY === 'MOCK_PRIVATE_KEY'

// Google Wallet configuration
const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || ''
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL || ''
const PRIVATE_KEY = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n') || ''

// Deterministic class/object IDs for multi-tenant
export function generateClassId(businessId: string): string {
  // Create deterministic but non-sequential class ID
  // Format: issuerId.businessSlug_loyalty_class
  return `${ISSUER_ID}.${businessId}_loyalty_class`
}

export function generateObjectId(membershipToken: string): string {
  // Create deterministic object ID from secure membership token
  return `${ISSUER_ID}.${membershipToken}`
}

// Mock Google Wallet API
class MockGoogleWallet {
  async createClass(classData: any) {
    return {
      id: classData.id,
      classTemplateInfo: classData.classTemplateInfo,
      heroImage: classData.heroImage,
      programName: classData.programName
    }
  }

  async getClass(classId: string) {
    return {
      id: classId,
      classTemplateInfo: { cardTemplateOverride: { cardRowTemplateInfos: [] } }
    }
  }

  async createObject(objectData: any) {
    return {
      id: objectData.id,
      classId: objectData.classId,
      state: 'ACTIVE',
      barcode: objectData.barcode,
      accountName: objectData.accountName
    }
  }

  async updateObject(objectId: string, objectData: any) {
    return {
      id: objectId,
      ...objectData,
      state: 'ACTIVE'
    }
  }

  async getObject(objectId: string) {
    return {
      id: objectId,
      state: 'ACTIVE'
    }
  }
}

const mockWallet = new MockGoogleWallet()

// Initialize Google API client
let walletClient: any = null

if (!isMockMode && PRIVATE_KEY && SERVICE_ACCOUNT_EMAIL) {
  try {
    const credentials = {
      type: 'service_account',
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    })

    walletClient = google.walletobjects({
      version: 'v1',
      auth
    })
  } catch (error) {
    console.error('Google Wallet client initialization error:', error)
  }
}

// Create or update loyalty class for a business
export async function ensureLoyaltyClass(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      loyaltyPrograms: {
        where: { status: 'ACTIVE' },
        include: {
          rewardDefinitions: {
            where: { isActive: true }
          }
        },
        take: 1
      }
    }
  })

  if (!business || business.loyaltyPrograms.length === 0) {
    throw new Error('Business or active program not found')
  }

  const program = business.loyaltyPrograms[0]
  const classId = generateClassId(businessId)

  const classData = {
    id: classId,
    issuerName: 'IntusPath Loyalty',
    programName: program.name,
    programLogo: business.logoUrl
      ? {
          sourceUri: {
            uri: business.logoUrl
          }
        }
      : undefined,
    hexBackgroundColor: business.brandColor || '#FF6B35',
    reviewStatus: 'UNDER_REVIEW'
  }

  if (isMockMode || !walletClient) {
    return await mockWallet.createClass(classData)
  }

  try {
    // Try to get existing class
    await walletClient.loyaltyclass.get({ resourceId: classId })
    // Update if exists
    const response = await walletClient.loyaltyclass.update({
      resourceId: classId,
      requestBody: classData
    })
    return response.data
  } catch (error: any) {
    if (error.code === 404) {
      // Create if doesn't exist
      const response = await walletClient.loyaltyclass.insert({
        requestBody: classData
      })
      return response.data
    }
    throw error
  }
}

// Create or update loyalty object for a membership
export async function createOrUpdateLoyaltyObject(membershipToken: string) {
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
      }
    }
  })

  if (!membership) {
    throw new Error('Membership not found')
  }

  const business = membership.loyaltyProgram.business
  const program = membership.loyaltyProgram

  // Ensure class exists
  await ensureLoyaltyClass(business.id)

  const classId = generateClassId(business.id)
  const objectId = generateObjectId(membershipToken)

  const pointsLabel = `${membership.currentPoints}/${program.pointsRequired}`
  const rewardsLabel =
    membership.earnedRewards.length > 0
      ? `${membership.earnedRewards.length} recompensa(s) disponible(s)`
      : 'Sin recompensas'

  const objectData = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountName: `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim(),
    accountId: membershipToken.substring(0, 12),
    barcode: {
      type: 'QR_CODE',
      value: membershipToken,
      alternateText: membershipToken.substring(0, 12)
    },
    loyaltyPoints: {
      label: 'Progreso',
      balance: {
        string: pointsLabel
      }
    },
    secondaryLoyaltyPoints: {
      label: 'Recompensas',
      balance: {
        string: rewardsLabel
      }
    },
    textModulesData: [
      {
        header: 'Programa',
        body: program.publicDescription || program.name,
        id: 'program_desc'
      }
    ]
  }

  if (isMockMode || !walletClient) {
    return await mockWallet.createObject(objectData)
  }

  try {
    // Try to update existing
    const response = await walletClient.loyaltyobject.update({
      resourceId: objectId,
      requestBody: objectData
    })
    return response.data
  } catch (error: any) {
    if (error.code === 404) {
      // Create if doesn't exist
      const response = await walletClient.loyaltyobject.insert({
        requestBody: objectData
      })
      return response.data
    }
    throw error
  }
}

// Generate Save to Google Wallet JWT
export function generateSaveUrl(membershipToken: string): string {
  const objectId = generateObjectId(membershipToken)

  // Always use mock mode if private key is not properly configured
  if (isMockMode || !PRIVATE_KEY || PRIVATE_KEY === 'MOCK_PRIVATE_KEY') {
    // Generate a mock JWT for development
    const token = `mock_jwt_${objectId.replace(/\./g, '_')}`
    return `https://pay.google.com/gp/v/save/${token}`
  }

  const claims = {
    iss: SERVICE_ACCOUNT_EMAIL,
    aud: 'google',
    origins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'],
    typ: 'savetowallet',
    payload: {
      loyaltyObjects: [
        {
          id: objectId
        }
      ]
    }
  }

  const token = jwt.sign(claims, PRIVATE_KEY, { algorithm: 'RS256' })

  return `https://pay.google.com/gp/v/save/${token}`
}

// Synchronize membership state to Google Wallet
export async function syncMembershipToWallet(membershipToken: string): Promise<boolean> {
  try {
    await createOrUpdateLoyaltyObject(membershipToken)
    return true
  } catch (error) {
    console.error('Google Wallet sync error:', error)
    // Don't throw - sync failure should not break core operations
    return false
  }
}

// Check if Google Wallet is configured
export function isGoogleWalletConfigured(): boolean {
  if (isMockMode) {
    return true // Available in mock mode for development
  }

  return !!(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY && walletClient)
}
