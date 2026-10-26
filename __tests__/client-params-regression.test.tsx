/**
 * Client Component Params Regression Tests
 *
 * CRITICAL: Prevents Next.js 16 Client Component params bugs
 *
 * In Next.js 15+, Client Components CANNOT receive dynamic route params as props.
 * They must use the useParams() hook from next/navigation instead.
 *
 * Production bug:
 * - /join/cono-churro showed "Negocio no encontrado"
 * - API endpoint /api/public/business/cono-churro/program returned correct data (200)
 * - Root cause: Client Component received params as props (Server Component pattern)
 * - params.businessSlug was undefined/unresolved
 * - Fetch was /api/public/business/undefined/program → 404
 * - Page interpreted 404 as "Negocio no encontrado"
 *
 * This test ensures all Client Components use useParams() correctly.
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Client Component Params Regression', () => {
  it('should use useParams() in Client Components with dynamic routes', () => {
    const violations: string[] = []

    function scanDirectory(dir: string) {
      if (!fs.existsSync(dir)) return
      if (dir.includes('node_modules') || dir.includes('.next')) return

      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          scanDirectory(fullPath)
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          // Check if this is a dynamic route (has [param] in path)
          if (!fullPath.includes('[') || !fullPath.includes(']')) continue

          const content = fs.readFileSync(fullPath, 'utf-8')
          const lines = content.split('\n')

          // Check if this is a Client Component
          const isClientComponent = lines.some(line =>
            line.trim() === "'use client'" || line.trim() === '"use client"'
          )

          if (!isClientComponent) continue

          // Check if it imports useParams
          const hasUseParamsImport = content.includes('useParams')

          // Check if component receives params as props (Server Component pattern)
          const hasParamsProps = /export\s+default\s+function\s+\w+\s*\(\s*{\s*params\s*}/.test(content)

          if (hasParamsProps && !hasUseParamsImport) {
            violations.push(
              `${fullPath} - Client Component with dynamic route receives params as props but doesn't import useParams()`
            )
          }

          // Check for params.something usage without useParams
          const usesParamsDirect = /params\.(businessSlug|token|id|slug)/.test(content)
          if (usesParamsDirect && !hasUseParamsImport) {
            violations.push(
              `${fullPath} - Uses params.X but doesn't import useParams() from 'next/navigation'`
            )
          }
        }
      }
    }

    scanDirectory(path.join(process.cwd(), 'app'))

    if (violations.length > 0) {
      console.error('\n❌ Client Component params violations:')
      violations.forEach(v => console.error(`  - ${v}`))
      console.error('\nNext.js 15+ Client Components must use useParams() hook:')
      console.error('  import { useParams } from "next/navigation"')
      console.error('  const params = useParams()')
      console.error('  const slug = params.slug as string')
      console.error('\nParams as props only work in Server Components.\n')
    }

    expect(violations).toEqual([])
  })

  it('should have useParams in join page', () => {
    const joinPath = path.join(process.cwd(), 'app/join/[businessSlug]/page.tsx')
    const content = fs.readFileSync(joinPath, 'utf-8')

    expect(content).toContain("'use client'")
    expect(content).toContain('useParams')
    expect(content).toContain('const params = useParams()')

    // Should NOT have params as props
    expect(content).not.toMatch(/export\s+default\s+function\s+\w+\s*\(\s*{\s*params\s*}/)
  })

  it('should have useParams in wallet page', () => {
    const walletPath = path.join(process.cwd(), 'app/wallet/[token]/page.tsx')
    const content = fs.readFileSync(walletPath, 'utf-8')

    expect(content).toContain("'use client'")
    expect(content).toContain('useParams')
    expect(content).toContain('const params = useParams()')

    // Should NOT have params as props
    expect(content).not.toMatch(/export\s+default\s+function\s+\w+\s*\(\s*{\s*params\s*}/)
  })

  it('should verify join page constructs correct fetch URL', () => {
    const joinPath = path.join(process.cwd(), 'app/join/[businessSlug]/page.tsx')
    const content = fs.readFileSync(joinPath, 'utf-8')

    // Should use businessSlug variable from useParams
    expect(content).toContain('const businessSlug = params.businessSlug as string')
    expect(content).toContain('fetch(`/api/public/business/${businessSlug}/program`)')

    // Should NOT use params.businessSlug directly in fetch
    expect(content).not.toContain('${params.businessSlug}')
  })

  it('should verify wallet page constructs correct fetch URL', () => {
    const walletPath = path.join(process.cwd(), 'app/wallet/[token]/page.tsx')
    const content = fs.readFileSync(walletPath, 'utf-8')

    // Should use token variable from useParams
    expect(content).toContain('const token = params.token as string')
    expect(content).toContain('fetch(`/api/wallet/${token}`)')

    // Should NOT use params.token directly in fetch
    expect(content).not.toContain('${params.token}')
  })

  it('should have guard for undefined params', () => {
    const joinPath = path.join(process.cwd(), 'app/join/[businessSlug]/page.tsx')
    const content = fs.readFileSync(joinPath, 'utf-8')

    // Should check if param exists before using
    expect(content).toContain('if (!businessSlug)')
  })
})
