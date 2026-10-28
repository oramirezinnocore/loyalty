import { NextResponse } from 'next/server'
import { isAppleWalletConfigured } from '@/lib/wallet/apple-wallet'
import { isGoogleWalletConfigured } from '@/lib/wallet/google-wallet'

/**
 * Wallet Capabilities Endpoint
 *
 * Returns which wallet integrations are currently configured and available.
 * Used by wallet page to show only available buttons.
 */
export async function GET() {
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
