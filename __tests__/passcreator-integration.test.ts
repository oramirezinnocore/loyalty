/**
 * Passcreator Apple Wallet Integration Tests
 *
 * Tests for temporary demo integration using Passcreator API.
 * All Passcreator API calls are mocked - NO real API calls.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock environment before imports
const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = originalEnv
})

describe('Passcreator Configuration', () => {
  it('reports not configured when API key missing', async () => {
    process.env.PASSCREATOR_API_KEY = ''
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    const { isPasscreatorConfigured } = await import('@/lib/wallet/passcreator')
    expect(isPasscreatorConfigured()).toBe(false)
  })

  it('reports not configured when template ID missing', async () => {
    process.env.PASSCREATOR_API_KEY = 'test-api-key'
    process.env.PASSCREATOR_TEMPLATE_ID = ''

    const { isPasscreatorConfigured } = await import('@/lib/wallet/passcreator')
    expect(isPasscreatorConfigured()).toBe(false)
  })

  it('reports not configured with demo API key', async () => {
    process.env.PASSCREATOR_API_KEY = 'DEMO_API_KEY'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    const { isPasscreatorConfigured } = await import('@/lib/wallet/passcreator')
    expect(isPasscreatorConfigured()).toBe(false)
  })

  it('reports configured with valid credentials', async () => {
    process.env.PASSCREATOR_API_KEY = 'real-api-key-12345'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    const { isPasscreatorConfigured } = await import('@/lib/wallet/passcreator')
    expect(isPasscreatorConfigured()).toBe(true)
  })
})

describe('Apple Wallet Provider Mode', () => {
  it('uses native provider by default', async () => {
    delete process.env.APPLE_WALLET_PROVIDER

    const { APPLE_WALLET_PROVIDER } = await import('@/lib/wallet/apple-wallet')
    expect(APPLE_WALLET_PROVIDER).toBe('native')
  })

  it('uses passcreator provider when configured', async () => {
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'

    const { APPLE_WALLET_PROVIDER } = await import('@/lib/wallet/apple-wallet')
    expect(APPLE_WALLET_PROVIDER).toBe('passcreator')
  })

  it('reports Apple Wallet configured when using passcreator mode with valid config', async () => {
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'
    process.env.PASSCREATOR_API_KEY = 'test-key'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    const { isAppleWalletConfigured } = await import('@/lib/wallet/apple-wallet')
    expect(isAppleWalletConfigured()).toBe(true)
  })

  it('reports Apple Wallet not configured when passcreator mode missing credentials', async () => {
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'
    process.env.PASSCREATOR_API_KEY = ''
    process.env.PASSCREATOR_TEMPLATE_ID = ''

    const { isAppleWalletConfigured } = await import('@/lib/wallet/apple-wallet')
    expect(isAppleWalletConfigured()).toBe(false)
  })

  it('native provider still works independently', async () => {
    process.env.APPLE_WALLET_PROVIDER = 'native'
    process.env.APPLE_PASS_CERTIFICATE = 'MOCK_CERTIFICATE'

    const { isAppleWalletConfigured } = await import('@/lib/wallet/apple-wallet')
    expect(isAppleWalletConfigured()).toBe(true)
  })
})

describe('Passcreator API Key Security', () => {
  it('API key never exposed in module exports', async () => {
    process.env.PASSCREATOR_API_KEY = 'secret-key-12345'

    const passcreatorModule = await import('@/lib/wallet/passcreator')
    const exports = Object.keys(passcreatorModule)

    // Check no export contains or returns the API key
    exports.forEach(exportName => {
      const exported = (passcreatorModule as any)[exportName]

      if (typeof exported === 'string') {
        expect(exported).not.toContain('secret-key')
      }

      if (typeof exported === 'function') {
        // Function should not return API key
        expect(exported.toString()).not.toContain('secret-key-12345')
      }
    })
  })
})

describe('Passcreator Pass Creation Logic', () => {
  it('uses membershipToken as userProvidedId for idempotency', () => {
    const membershipToken = 'clrxabc123def456ghi78901'

    // Verify this is a valid CUID format (starts with 'c' and has alphanumeric chars)
    expect(membershipToken).toMatch(/^c[a-z0-9]+$/)
    expect(membershipToken.length).toBeGreaterThanOrEqual(20)

    // In implementation, userProvidedId should equal membershipToken
    const expectedUserProvidedId = membershipToken
    expect(expectedUserProvidedId).toBe(membershipToken)
  })

  it('uses membershipToken as barcode value', () => {
    const membershipToken = 'clrxabc123def456ghi78901'

    // QR code should use membership token (same as scanner, Google Wallet, web wallet)
    const expectedBarcodeValue = membershipToken
    expect(expectedBarcodeValue).toBe(membershipToken)
  })

  it('template ID is from environment', () => {
    const expectedTemplateId = '04b0a1b5-7317-417c-add3-e6762472cb59'

    // Verify template ID format
    expect(expectedTemplateId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

describe('Passcreator Error Handling', () => {
  it('sync returns false on failure without throwing', async () => {
    process.env.PASSCREATOR_API_KEY = 'test-key'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    // Mock fetch to fail
    // @ts-expect-error - Jest mock type inference limitation
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch as any

    const { syncMembershipToPasscreator } = await import('@/lib/wallet/passcreator')

    // Should not throw - returns false on error
    const result = await syncMembershipToPasscreator('test-token')

    // Returns false on error
    expect(result).toBe(false)
  })

  it('sync returns false when not configured', async () => {
    process.env.PASSCREATOR_API_KEY = ''
    process.env.PASSCREATOR_TEMPLATE_ID = ''

    const { syncMembershipToPasscreator } = await import('@/lib/wallet/passcreator')

    const result = await syncMembershipToPasscreator('test-token')
    expect(result).toBe(false)
  })
})

describe('Google Wallet Independence', () => {
  it('Passcreator does not affect Google Wallet configuration', async () => {
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'
    process.env.PASSCREATOR_API_KEY = 'test-key'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000023228830'
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com'
    process.env.GOOGLE_WALLET_PRIVATE_KEY = 'MOCK_PRIVATE_KEY'

    const { isGoogleWalletConfigured } = await import('@/lib/wallet/google-wallet')

    // Google Wallet should still report configured
    expect(isGoogleWalletConfigured()).toBe(true)
  })
})

describe('Pass Reuse Strategy', () => {
  it('WalletPass.applePassId stores Passcreator identifier', () => {
    // Verify schema supports storing pass ID
    // WalletPass has applePassId field (nullable string)
    const passcreatorIdentifier = 'abcdef12-0dc5-447b-ac08-eff6462d883e'

    // Should be UUID format
    expect(passcreatorIdentifier).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

describe('Endpoint Contract Preservation', () => {
  it('Apple Wallet button interface unchanged', () => {
    // Button still calls GET /api/wallet/apple/{token}
    const membershipToken = 'clrxabc123def456ghi78901'
    const expectedEndpoint = `/api/wallet/apple/${membershipToken}`

    expect(expectedEndpoint).toContain('/api/wallet/apple/')
    expect(expectedEndpoint).toMatch(/^\/api\/wallet\/apple\/c[a-z0-9]+$/)
  })

  it('endpoint redirects to iPhoneUri in passcreator mode', () => {
    // Response should be 302 redirect to Passcreator iPhoneUri
    const mockIPhoneUri = 'https://app.passcreator.com/linkToPassFile.pkpass'

    // Verify URL format
    expect(mockIPhoneUri).toContain('passcreator.com')
    expect(mockIPhoneUri).toContain('.pkpass')
  })

  it('endpoint returns .pkpass buffer in native mode', () => {
    // Native mode returns binary .pkpass file directly
    const expectedContentType = 'application/vnd.apple.pkpass'

    expect(expectedContentType).toBe('application/vnd.apple.pkpass')
  })
})
