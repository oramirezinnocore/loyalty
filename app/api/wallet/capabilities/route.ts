import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { isAppleWalletConfigured } from '@/lib/wallet/apple-wallet'
import { isGoogleWalletConfigured } from '@/lib/wallet/google-wallet'

/**
 * Wallet Capabilities Endpoint
 *
 * Returns which wallet integrations are currently configured and available.
 * Used by wallet page to show only available buttons.
 *
 * IMPORTANT: This route MUST execute at runtime to read environment variables.
 * Accessing headers() forces dynamic evaluation and prevents build-time caching.
 */
export async function GET() {
  // Force dynamic evaluation by accessing request headers
  // This prevents Next.js from caching the response at build time
  // when environment variables are not yet available
  await headers()

  try {
    const capabilities = {
      apple: isAppleWalletConfigured(),
      google: isGoogleWalletConfigured()
    }

    return NextResponse.json({ capabilities })
  } catch (error) {
    console.error('Wallet capabilities check error:', error)
    return NextResponse.json(
      {
        capabilities: {
          apple: false,
          google: false
        }
      },
      { status: 500 }
    )
  }
}
