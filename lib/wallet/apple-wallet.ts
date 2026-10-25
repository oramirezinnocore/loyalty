import { prisma } from '@/lib/prisma'
import * as archiverModule from 'archiver'
import crypto from 'crypto'
import { Readable } from 'stream'
import forge from 'node-forge'

// Handle ESM/CJS interop for archiver
const archiver = (archiverModule as any).default || archiverModule

// Apple Wallet configuration
const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER || ''
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_IDENTIFIER || ''
const PASS_CERTIFICATE = process.env.APPLE_PASS_CERTIFICATE?.replace(/\\n/g, '\n') || ''
const PRIVATE_KEY = process.env.APPLE_PASS_PRIVATE_KEY?.replace(/\\n/g, '\n') || ''
const WWDR_CERTIFICATE = process.env.APPLE_WWDR_CERTIFICATE?.replace(/\\n/g, '\n') || ''

// Mock mode: explicit mock value OR (development/test AND no real certificates)
const isMockMode =
  process.env.APPLE_PASS_CERTIFICATE === 'MOCK_CERTIFICATE' ||
  (process.env.NODE_ENV !== 'production' &&
   (!PASS_CERTIFICATE || !PRIVATE_KEY || !WWDR_CERTIFICATE))

// Generate deterministic serial number from membership token
export function generateSerialNumber(membershipToken: string): string {
  // Create deterministic but secure serial number
  const hash = crypto.createHash('sha256').update(membershipToken).digest('hex')
  return hash.substring(0, 32)
}

// Generate pass data for a membership
export async function generatePassData(membershipToken: string) {
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

  const serialNumber = generateSerialNumber(membershipToken)

  // Primary color from business branding
  const backgroundColor = business.brandColor || '#FF6B35'
  const foregroundColor = '#FFFFFF'
  const labelColor = '#FFFFFF'

  // Progress display
  const currentPoints = membership.currentPoints
  const goalPoints = program.pointsRequired
  const progressLabel = `${currentPoints} de ${goalPoints}`

  // Rewards display
  const rewardsLabel = membership.earnedRewards.length > 0
    ? `${membership.earnedRewards.length} disponible${membership.earnedRewards.length > 1 ? 's' : ''}`
    : 'Sin recompensas'

  const passData = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_IDENTIFIER,
    serialNumber,
    teamIdentifier: TEAM_IDENTIFIER,
    organizationName: 'IntusPath',
    description: program.name,
    logoText: business.name,
    foregroundColor,
    backgroundColor,
    labelColor,
    storeCard: {
      primaryFields: [
        {
          key: 'balance',
          label: 'Progreso',
          value: progressLabel
        }
      ],
      secondaryFields: [
        {
          key: 'rewards',
          label: 'Recompensas',
          value: rewardsLabel
        }
      ],
      auxiliaryFields: [
        {
          key: 'name',
          label: 'Miembro',
          value: `${membership.customer.firstName} ${membership.customer.lastName || ''}`.trim()
        }
      ],
      backFields: [
        {
          key: 'program',
          label: 'Programa',
          value: program.publicDescription || program.name
        },
        {
          key: 'terms',
          label: 'Términos',
          value: 'Válido para uso en establecimiento. No acumulable con otras promociones.'
        }
      ]
    },
    barcode: {
      message: membershipToken,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: serialNumber.substring(0, 12)
    },
    barcodes: [
      {
        message: membershipToken,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: serialNumber.substring(0, 12)
      }
    ]
  }

  return passData
}

// Create manifest for signing
function createManifest(files: { [key: string]: Buffer }): string {
  const manifest: { [key: string]: string } = {}

  for (const [filename, content] of Object.entries(files)) {
    const hash = crypto.createHash('sha1').update(content).digest('hex')
    manifest[filename] = hash
  }

  return JSON.stringify(manifest)
}

// Sign manifest with PKCS#7 (required by Apple Wallet)
function signManifest(manifest: string): Buffer {
  // Production: Require proper certificates
  if (process.env.NODE_ENV === 'production' && (!PASS_CERTIFICATE || !PRIVATE_KEY || !WWDR_CERTIFICATE)) {
    throw new Error('Apple Wallet certificates not configured for production')
  }

  if (isMockMode) {
    // Return mock signature for development/testing only
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Apple Wallet: Using mock signature (development only)')
    }
    return Buffer.from('MOCK_SIGNATURE')
  }

  try {
    // Parse certificates
    const passCert = forge.pki.certificateFromPem(PASS_CERTIFICATE)
    const wwdrCert = forge.pki.certificateFromPem(WWDR_CERTIFICATE)
    const privateKey = forge.pki.privateKeyFromPem(PRIVATE_KEY)

    // Create PKCS#7 signed data
    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(manifest, 'utf8')

    p7.addCertificate(passCert)
    p7.addCertificate(wwdrCert)

    p7.addSigner({
      key: privateKey,
      certificate: passCert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
          // value will be automatically calculated
        }
      ]
    })

    // Sign in detached mode (signature separate from content)
    p7.sign({ detached: true })

    // Convert to DER format
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
    return Buffer.from(der, 'binary')
  } catch (error) {
    console.error('PKCS#7 signing error:', error)
    throw new Error('Failed to sign pass with Apple certificates')
  }
}

// Generate .pkpass file
export async function generatePkPass(membershipToken: string): Promise<Buffer> {
  const passData = await generatePassData(membershipToken)

  // Files to include in .pkpass
  const files: { [key: string]: Buffer } = {
    'pass.json': Buffer.from(JSON.stringify(passData, null, 2))
  }

  // Create manifest
  const manifest = createManifest(files)
  files['manifest.json'] = Buffer.from(manifest)

  // Sign manifest
  const signature = signManifest(manifest)
  files['signature'] = signature

  // Create .pkpass archive
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    // Add all files to archive
    for (const [filename, content] of Object.entries(files)) {
      archive.append(content, { name: filename })
    }

    archive.finalize()
  })
}

// Sync membership to Apple Wallet (best effort)
export async function syncMembershipToAppleWallet(membershipToken: string): Promise<boolean> {
  try {
    // In production, this would trigger APNs push notification to update pass
    // For now, pass can be regenerated on demand
    // Store device registration data in database if implementing full update flow

    console.log(`Apple Wallet sync requested for ${membershipToken}`)
    return true
  } catch (error) {
    console.error('Apple Wallet sync error:', error)
    return false
  }
}

// Check if Apple Wallet is configured
export function isAppleWalletConfigured(): boolean {
  if (isMockMode) {
    return true // Available in mock mode
  }

  return !!(
    PASS_TYPE_IDENTIFIER &&
    TEAM_IDENTIFIER &&
    PASS_CERTIFICATE &&
    PRIVATE_KEY
  )
}
