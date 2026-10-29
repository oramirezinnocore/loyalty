/**
 * Wallet Buttons Regression Test
 *
 * Prevents regression where digital wallet buttons (Apple/Google) are hidden
 * behind capability checks and replaced with "coming soon" placeholder.
 *
 * ROOT CAUSE OF REGRESSION (commit 9b9f555):
 * - Added wallet capabilities check to hide buttons if credentials not configured
 * - Intent was good (UX improvement) but caused production regression
 * - Buttons disappeared and were replaced with placeholder message
 *
 * EXPECTED BEHAVIOR:
 * - Wallet buttons ALWAYS render regardless of backend configuration
 * - Buttons handle "not configured" errors gracefully when clicked
 * - User can see wallet options even if credentials pending
 * - Better UX: shows features exist, handles config errors inline
 *
 * PREVENTION:
 * - Wallet page must render GoogleWalletButton unconditionally
 * - Wallet page must render AppleWalletButton unconditionally
 * - No capability-based hiding of wallet buttons
 * - Placeholder message should NEVER replace functional buttons
 */

describe('Wallet Buttons Regression', () => {
  const walletPagePath = 'app/wallet/[token]/page.tsx'

  it('wallet page always renders GoogleWalletButton without conditions', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Must have unconditional GoogleWalletButton
    expect(content).toMatch(/<GoogleWalletButton\s+membershipToken=\{membership\.publicToken\}\s*\/>/)

    // Extract section around GoogleWalletButton
    const buttonMatch = content.match(/<GoogleWalletButton[^>]*>/)
    expect(buttonMatch).toBeTruthy()

    const buttonIndex = content.indexOf(buttonMatch![0])
    const beforeButton = content.substring(Math.max(0, buttonIndex - 200), buttonIndex)

    // Must NOT be inside conditional render (capabilities check)
    expect(beforeButton).not.toMatch(/capabilities\.google\s*&&/)
    expect(beforeButton).not.toMatch(/\{capabilities\.google\s*\?/)
  })

  it('wallet page always renders AppleWalletButton without conditions', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Must have unconditional AppleWalletButton
    expect(content).toMatch(/<AppleWalletButton\s+membershipToken=\{membership\.publicToken\}\s*\/>/)

    // Extract section around AppleWalletButton
    const buttonMatch = content.match(/<AppleWalletButton[^>]*>/)
    expect(buttonMatch).toBeTruthy()

    const buttonIndex = content.indexOf(buttonMatch![0])
    const beforeButton = content.substring(Math.max(0, buttonIndex - 200), buttonIndex)

    // Must NOT be inside conditional render (capabilities check)
    expect(beforeButton).not.toMatch(/capabilities\.apple\s*&&/)
    expect(beforeButton).not.toMatch(/\{capabilities\.apple\s*\?/)
  })

  it('wallet page does not fetch capabilities endpoint', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Should NOT fetch capabilities (buttons render unconditionally)
    expect(content).not.toMatch(/\/api\/wallet\/capabilities/)
  })

  it('wallet page does not have capabilities state', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Should NOT have capabilities state (not needed)
    expect(content).not.toMatch(/useState.*capabilities/)
    expect(content).not.toMatch(/setCapabilities/)
  })

  it('placeholder message does not replace wallet buttons', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Placeholder message should NOT exist
    const placeholderText = 'Las integraciones de billetera digital estarán disponibles próximamente'
    expect(content).not.toContain(placeholderText)
  })

  it('wallet buttons are rendered after QR code section', () => {
    const fs = require('fs')
    const content = fs.readFileSync(walletPagePath, 'utf-8')

    // Find QR section
    const qrSectionRegex = /Tu código QR/
    const qrMatch = content.match(qrSectionRegex)
    expect(qrMatch).toBeTruthy()

    const qrIndex = content.indexOf(qrMatch![0])

    // Find wallet buttons
    const googleButtonRegex = /<GoogleWalletButton/
    const appleButtonRegex = /<AppleWalletButton/

    const googleButtonIndex = content.indexOf(content.match(googleButtonRegex)![0])
    const appleButtonIndex = content.indexOf(content.match(appleButtonRegex)![0])

    // Buttons should appear AFTER QR section
    expect(googleButtonIndex).toBeGreaterThan(qrIndex)
    expect(appleButtonIndex).toBeGreaterThan(qrIndex)
  })

  it('button components have error handling built-in', () => {
    const fs = require('fs')

    // Check GoogleWalletButton has error state
    const googleButtonPath = 'app/wallet/[token]/google-wallet-button.tsx'
    const googleContent = fs.readFileSync(googleButtonPath, 'utf-8')
    expect(googleContent).toContain('useState')
    expect(googleContent).toContain('error')
    expect(googleContent).toContain('setError')
    expect(googleContent).toMatch(/text-red-\d+/)

    // Check AppleWalletButton has error state
    const appleButtonPath = 'app/wallet/[token]/apple-wallet-button.tsx'
    const appleContent = fs.readFileSync(appleButtonPath, 'utf-8')
    expect(appleContent).toContain('useState')
    expect(appleContent).toContain('error')
    expect(appleContent).toContain('setError')
    expect(appleContent).toMatch(/text-red-\d+/)
  })
})
