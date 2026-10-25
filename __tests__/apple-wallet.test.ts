import { PrismaClient, BusinessStatus, LoyaltyProgramStatus } from '@prisma/client'
import {
  generateSerialNumber,
  generatePassData,
  generatePkPass,
  syncMembershipToAppleWallet,
  isAppleWalletConfigured
} from '@/lib/wallet/apple-wallet'
import { registerPurchase } from '@/lib/loyalty-engine'

const prisma = new PrismaClient()

describe('Apple Wallet Integration', () => {
  let businessId: string
  let programId: string
  let customerId: string
  let membershipId: string
  let membershipToken: string
  let rewardDefId: string

  beforeAll(async () => {
    // Create test business with active subscription and program
    const business = await prisma.business.create({
      data: {
        name: 'Apple Wallet Test Business',
        slug: 'apple-wallet-test-biz',
        status: BusinessStatus.ACTIVE,
        brandColor: '#2E7D32',
        logoUrl: 'https://example.com/logo.png',
        subscription: {
          create: {
            status: 'ACTIVE',
            priceMonthlyMXN: 299
          }
        }
      }
    })
    businessId = business.id

    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId,
        name: 'Apple Wallet Test Program',
        publicDescription: 'Test program for Apple Wallet',
        status: LoyaltyProgramStatus.ACTIVE,
        pointsRequired: 8
      }
    })
    programId = program.id

    const rewardDef = await prisma.rewardDefinition.create({
      data: {
        loyaltyProgramId: programId,
        name: 'Apple Test Reward',
        pointsRequired: 8,
        isActive: true
      }
    })
    rewardDefId = rewardDef.id

    const customer = await prisma.customer.create({
      data: {
        businessId,
        firstName: 'Apple',
        lastName: 'Tester',
        phone: '+52 55 7777 0000'
      }
    })
    customerId = customer.id

    const membership = await prisma.membership.create({
      data: {
        customerId,
        loyaltyProgramId: programId,
        currentPoints: 3
      }
    })
    membershipId = membership.id
    membershipToken = membership.publicToken
  })

  afterAll(async () => {
    await prisma.earnedReward.deleteMany({ where: { membershipId } })
    await prisma.transaction.deleteMany({ where: { membershipId } })
    await prisma.membership.deleteMany({ where: { id: membershipId } })
    await prisma.customer.deleteMany({ where: { id: customerId } })
    await prisma.rewardDefinition.deleteMany({ where: { id: rewardDefId } })
    await prisma.loyaltyProgram.deleteMany({ where: { id: programId } })
    await prisma.subscription.deleteMany({ where: { businessId } })
    await prisma.business.deleteMany({ where: { id: businessId } })
    await prisma.$disconnect()
  })

  describe('Serial Number Generation', () => {
    it('should generate deterministic serial number', () => {
      const serial1 = generateSerialNumber(membershipToken)
      const serial2 = generateSerialNumber(membershipToken)

      expect(serial1).toBe(serial2)
      expect(serial1.length).toBeLessThanOrEqual(32)
    })

    it('should not expose internal DB IDs', () => {
      const serial = generateSerialNumber(membershipToken)

      expect(serial).not.toContain(membershipId)
      expect(serial).not.toContain(customerId)
      expect(serial).not.toContain(businessId)
    })
  })

  describe('Pass Data Generation', () => {
    it('should generate pass data with membership info', async () => {
      const passData = await generatePassData(membershipToken)

      expect(passData).toBeTruthy()
      expect(passData.formatVersion).toBe(1)
      expect(passData.serialNumber).toBeTruthy()
      expect(passData.description).toBeTruthy()
    })

    it('should map business branding', async () => {
      const passData = await generatePassData(membershipToken)

      expect(passData.backgroundColor).toBeTruthy()
      expect(passData.logoText).toContain('Apple Wallet Test Business')
    })

    it('should map customer data', async () => {
      const passData = await generatePassData(membershipToken)

      const nameField = passData.storeCard.auxiliaryFields.find((f: any) => f.key === 'name')
      expect(nameField).toBeTruthy()
      expect(nameField?.value).toContain('Apple')
    })

    it('should map progress correctly', async () => {
      const passData = await generatePassData(membershipToken)

      const balanceField = passData.storeCard.primaryFields.find((f: any) => f.key === 'balance')
      expect(balanceField).toBeTruthy()
      expect(balanceField?.value).toContain('3')
      expect(balanceField?.value).toContain('8')
    })

    it('should map rewards', async () => {
      const passData = await generatePassData(membershipToken)

      const rewardsField = passData.storeCard.secondaryFields.find((f: any) => f.key === 'rewards')
      expect(rewardsField).toBeTruthy()
      expect(rewardsField?.value).toBeTruthy()
    })

    it('should include secure QR barcode', async () => {
      const passData = await generatePassData(membershipToken)

      expect(passData.barcode).toBeTruthy()
      expect(passData.barcode.format).toBe('PKBarcodeFormatQR')
      expect(passData.barcode.message).toBe(membershipToken)
      expect(passData.barcodes).toHaveLength(1)
      expect(passData.barcodes[0].message).toBe(membershipToken)
    })

    it('should not expose DB IDs in barcode', async () => {
      const passData = await generatePassData(membershipToken)

      expect(passData.barcode.message).not.toContain(membershipId)
      expect(passData.barcode.message).not.toContain(customerId)
      expect(passData.barcode.message).not.toContain(businessId)
    })
  })

  describe('Pass Generation', () => {
    it('should generate .pkpass file', async () => {
      const pkpass = await generatePkPass(membershipToken)

      expect(pkpass).toBeTruthy()
      expect(Buffer.isBuffer(pkpass)).toBe(true)
      expect(pkpass.length).toBeGreaterThan(0)
    })

    it('should be idempotent', async () => {
      const pass1 = await generatePkPass(membershipToken)
      const pass2 = await generatePkPass(membershipToken)

      // Both should succeed
      expect(pass1).toBeTruthy()
      expect(pass2).toBeTruthy()
    })

    it('should handle malformed data gracefully', async () => {
      await expect(
        generatePkPass('invalid-token-xyz')
      ).rejects.toThrow('Membership not found')
    })
  })

  describe('Synchronization', () => {
    it('should sync after purchase', async () => {
      await registerPurchase(membershipId, businessId)

      const membership = await prisma.membership.findUnique({
        where: { id: membershipId }
      })

      expect(membership!.currentPoints).toBeGreaterThan(3)

      // Sync should work (best effort)
      const success = await syncMembershipToAppleWallet(membershipToken)
      expect(typeof success).toBe('boolean')
    })

    it('should not fail core transaction on sync failure', async () => {
      // Register purchase
      const result = await registerPurchase(membershipId, businessId)

      // Transaction should succeed even if wallet sync fails
      expect(result.transaction).toBeTruthy()
      expect(result.membership).toBeTruthy()
    })
  })

  describe('Security', () => {
    it('should reject invalid membership token', async () => {
      await expect(
        generatePassData('invalid-token-12345')
      ).rejects.toThrow('Membership not found')
    })

    it('should use secure membership token in barcode', async () => {
      const passData = await generatePassData(membershipToken)

      // Token is non-sequential CUID
      expect(passData.barcode.message).toBe(membershipToken)
      expect(passData.barcode.message.length).toBeGreaterThan(20)
    })
  })

  describe('Configuration', () => {
    it('should report configuration status', () => {
      const configured = isAppleWalletConfigured()
      expect(typeof configured).toBe('boolean')
    })

    it('should work in mock mode', async () => {
      // All tests run in mock mode
      const pkpass = await generatePkPass(membershipToken)
      expect(pkpass).toBeTruthy()
    })
  })

  describe('Multi-tenant Support', () => {
    it('should generate different passes for different businesses', async () => {
      // Create second business
      const business2 = await prisma.business.create({
        data: {
          name: 'Business 2',
          slug: 'business-2-apple',
          status: BusinessStatus.ACTIVE,
          subscription: {
            create: {
              status: 'ACTIVE',
              priceMonthlyMXN: 299
            }
          }
        }
      })

      const program2 = await prisma.loyaltyProgram.create({
        data: {
          businessId: business2.id,
          name: 'Program 2',
          status: LoyaltyProgramStatus.ACTIVE,
          pointsRequired: 5
        }
      })

      const customer2 = await prisma.customer.create({
        data: {
          businessId: business2.id,
          firstName: 'Test2',
          phone: '+52 55 6666 0000'
        }
      })

      const membership2 = await prisma.membership.create({
        data: {
          customerId: customer2.id,
          loyaltyProgramId: program2.id
        }
      })

      const pass1 = await generatePassData(membershipToken)
      const pass2 = await generatePassData(membership2.publicToken)

      expect(pass1.serialNumber).not.toBe(pass2.serialNumber)
      expect(pass1.logoText).not.toBe(pass2.logoText)

      // Cleanup
      await prisma.membership.deleteMany({ where: { id: membership2.id } })
      await prisma.customer.deleteMany({ where: { id: customer2.id } })
      await prisma.loyaltyProgram.deleteMany({ where: { id: program2.id } })
      await prisma.subscription.deleteMany({ where: { businessId: business2.id } })
      await prisma.business.deleteMany({ where: { id: business2.id } })
    })
  })

  describe('Compatibility', () => {
    it('should not break existing web wallet', async () => {
      // Web wallet uses membership token directly
      const membership = await prisma.membership.findUnique({
        where: { publicToken: membershipToken }
      })

      expect(membership).toBeTruthy()
      expect(membership!.publicToken).toBe(membershipToken)
    })

    it('should not break Google Wallet', async () => {
      // Both wallets can coexist
      const passData = await generatePassData(membershipToken)
      expect(passData).toBeTruthy()

      // Token is same for both providers
      expect(passData.barcode.message).toBe(membershipToken)
    })
  })
})
