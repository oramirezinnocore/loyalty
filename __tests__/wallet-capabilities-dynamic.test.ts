/**
 * Wallet Capabilities Dynamic Configuration Test
 *
 * Verifies that /api/wallet/capabilities route forces runtime evaluation.
 * Regression test for static route caching bug.
 */

import { describe, it, expect } from '@jest/globals'

describe('Wallet Capabilities Route Configuration', () => {
  it('exports GET handler', async () => {
    const routeModule = await import('@/app/api/wallet/capabilities/route')

    expect(routeModule).toHaveProperty('GET')
    expect(typeof routeModule.GET).toBe('function')
  })

  it('imports headers() to force dynamic evaluation', async () => {
    // Read the route source to verify it uses headers()
    // This forces Next.js to evaluate the route at runtime, not build time
    const fs = await import('fs')
    const path = await import('path')

    const routePath = path.join(process.cwd(), 'app/api/wallet/capabilities/route.ts')
    const routeSource = fs.readFileSync(routePath, 'utf-8')

    // Verify headers() is imported
    expect(routeSource).toContain("import { headers } from 'next/headers'")

    // Verify headers() is called inside GET handler
    expect(routeSource).toContain('await headers()')
  })
})
