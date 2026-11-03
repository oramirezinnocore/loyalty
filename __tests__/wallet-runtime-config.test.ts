/**
 * Wallet Runtime Configuration Tests
 *
 * Regression tests proving that wallet configuration is read at RUNTIME,
 * not captured at build time or module import time.
 *
 * Context: In Docker production builds, environment variables don't exist
 * during `next build`. Module-level constants capture empty values at build time,
 * then ignore runtime environment variables. This test suite proves the fix works.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock environment before imports
const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = originalEnv
})

describe('Apple Wallet Runtime Configuration', () => {
  it('reads provider mode at runtime, not at import', async () => {
    // Import with NO environment variable set
    delete process.env.APPLE_WALLET_PROVIDER
    const module1 = await import('@/lib/wallet/apple-wallet')

    // Should default to 'native'
    expect(module1.getAppleWalletProvider()).toBe('native')

    // NOW set the environment variable AFTER import
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'

    // Re-call the getter - should read fresh value from process.env
    expect(module1.getAppleWalletProvider()).toBe('passcreator')
  })

  it('detects Passcreator configuration set after import', async () => {
    // Import with NO credentials
    delete process.env.PASSCREATOR_API_KEY
    delete process.env.PASSCREATOR_TEMPLATE_ID

    const { isPasscreatorConfigured } = await import('@/lib/wallet/passcreator')

    // Should report not configured
    expect(isPasscreatorConfigured()).toBe(false)

    // NOW set credentials AFTER import
    process.env.PASSCREATOR_API_KEY = 'test-api-key-12345'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    // Re-call - should read fresh values
    expect(isPasscreatorConfigured()).toBe(true)
  })

  it('detects Apple Wallet configured in passcreator mode set after import', async () => {
    // Simulate production environment to disable mock mode
    const originalNodeEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })

    // Import with NO configuration
    delete process.env.APPLE_WALLET_PROVIDER
    delete process.env.PASSCREATOR_API_KEY
    delete process.env.PASSCREATOR_TEMPLATE_ID
    delete process.env.APPLE_PASS_CERTIFICATE
    delete process.env.APPLE_PASS_PRIVATE_KEY
    delete process.env.APPLE_WWDR_CERTIFICATE

    const { isAppleWalletConfigured } = await import('@/lib/wallet/apple-wallet')

    // Should report not configured (native mode, no certificates, production)
    expect(isAppleWalletConfigured()).toBe(false)

    // NOW set passcreator mode AFTER import
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'
    process.env.PASSCREATOR_API_KEY = 'test-key'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    // Re-call - should detect passcreator configuration
    expect(isAppleWalletConfigured()).toBe(true)

    // Restore NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true })
  })
})

describe('Google Wallet Runtime Configuration', () => {
  it('reads credentials at runtime, not at import', async () => {
    // Import with NO credentials
    delete process.env.GOOGLE_WALLET_ISSUER_ID
    delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
    delete process.env.GOOGLE_WALLET_PRIVATE_KEY

    const { isGoogleWalletConfigured } = await import('@/lib/wallet/google-wallet')

    // Should report not configured
    expect(isGoogleWalletConfigured()).toBe(false)

    // NOW set credentials AFTER import
    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000023228830'
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com'
    process.env.GOOGLE_WALLET_PRIVATE_KEY = 'MOCK_PRIVATE_KEY'

    // Re-call - should read fresh values
    expect(isGoogleWalletConfigured()).toBe(true)
  })

  it('generates class ID with issuer set after import', async () => {
    // Import with NO issuer
    delete process.env.GOOGLE_WALLET_ISSUER_ID

    const { generateClassId } = await import('@/lib/wallet/google-wallet')

    // NOW set issuer AFTER import
    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000023228830'

    // Should use runtime value
    const classId = generateClassId('test-business')
    expect(classId).toBe('3388000000023228830.test-business_loyalty_class')
  })

  it('generates object ID with issuer set after import', async () => {
    // Import with NO issuer
    delete process.env.GOOGLE_WALLET_ISSUER_ID

    const { generateObjectId } = await import('@/lib/wallet/google-wallet')

    // NOW set issuer AFTER import
    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000023228830'

    // Should use runtime value
    const objectId = generateObjectId('clrxtoken123')
    expect(objectId).toBe('3388000000023228830.clrxtoken123')
  })
})

describe('Wallet Capabilities Endpoint Integration', () => {
  it('capabilities endpoint reflects runtime configuration', async () => {
    // Simulate Docker production scenario: production environment
    const originalNodeEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })

    // Simulate Docker production scenario:
    // 1. Module imported with NO environment variables (during build)
    delete process.env.GOOGLE_WALLET_ISSUER_ID
    delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
    delete process.env.GOOGLE_WALLET_PRIVATE_KEY
    delete process.env.APPLE_WALLET_PROVIDER
    delete process.env.PASSCREATOR_API_KEY
    delete process.env.PASSCREATOR_TEMPLATE_ID
    delete process.env.APPLE_PASS_CERTIFICATE
    delete process.env.APPLE_PASS_PRIVATE_KEY
    delete process.env.APPLE_WWDR_CERTIFICATE

    const googleWallet = await import('@/lib/wallet/google-wallet')
    const appleWallet = await import('@/lib/wallet/apple-wallet')

    // Both should report not configured in production without credentials
    expect(googleWallet.isGoogleWalletConfigured()).toBe(false)
    expect(appleWallet.isAppleWalletConfigured()).toBe(false)

    // 2. Container starts, environment variables NOW available at runtime
    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000023228830'
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = 'loyalty@project.iam.gserviceaccount.com'
    process.env.GOOGLE_WALLET_PRIVATE_KEY = 'MOCK_PRIVATE_KEY'
    process.env.APPLE_WALLET_PROVIDER = 'passcreator'
    process.env.PASSCREATOR_API_KEY = 'production-key'
    process.env.PASSCREATOR_TEMPLATE_ID = '04b0a1b5-7317-417c-add3-e6762472cb59'

    // 3. Capabilities endpoint queries configuration
    // Should NOW return true for both
    expect(googleWallet.isGoogleWalletConfigured()).toBe(true)
    expect(appleWallet.isAppleWalletConfigured()).toBe(true)

    // Restore NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true })
  })
})
