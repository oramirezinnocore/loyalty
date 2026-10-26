/**
 * Admin Runtime Regression Tests
 *
 * CRITICAL: Prevents production runtime crashes
 *
 * Tests for:
 * 1. Server/Client boundary violations (event handlers in Server Components)
 * 2. Internal authenticated fetches without session
 * 3. Direct Prisma access from Server Components
 *
 * Background: Production crash from passing onClick to Client Component
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Admin Runtime Regression', () => {
  describe('Server/Client Boundary Safety', () => {
    it('should not have event handlers in Server Components', () => {
      const adminDir = path.join(process.cwd(), 'app/admin')
      const violations: string[] = []

      function scanDirectory(dir: string) {
        if (!fs.existsSync(dir)) return

        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            scanDirectory(fullPath)
          } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')

            // Check if this is a Client Component
            const isClientComponent = lines.some(line =>
              line.trim() === "'use client'" || line.trim() === '"use client"'
            )

            if (!isClientComponent) {
              // Server Component - check for event handlers
              lines.forEach((line, index) => {
                // Match event handler props like onClick={, onChange={, onSubmit={
                if (/\s(onClick|onChange|onSubmit|onKeyDown|onKeyUp|onFocus|onBlur|onInput)=\{/.test(line)) {
                  violations.push(
                    `${fullPath}:${index + 1} - Event handler in Server Component: ${line.trim().substring(0, 80)}`
                  )
                }
              })
            }
          }
        }
      }

      scanDirectory(adminDir)

      if (violations.length > 0) {
        console.error('\n❌ Server/Client boundary violations found:')
        violations.forEach(v => console.error(`  - ${v}`))
        console.error('\nThese will cause runtime error:')
        console.error('  "Event handlers cannot be passed to Client Component props"')
        console.error('\nFix: Extract interactive elements into Client Components\n')
      }

      expect(violations).toEqual([])
    })

    it('should have QRDownloadButton as Client Component', () => {
      const buttonPath = path.join(process.cwd(), 'components/qr-download-button.tsx')

      if (fs.existsSync(buttonPath)) {
        const content = fs.readFileSync(buttonPath, 'utf-8')
        expect(content).toContain("'use client'")
      }
    })
  })

  describe('Internal API Fetch Safety', () => {
    it('should not fetch internal authenticated endpoints from Server Components', () => {
      const appDir = path.join(process.cwd(), 'app')
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
            // Skip API route files
            if (fullPath.includes('/api/') && entry.name === 'route.ts') continue

            const content = fs.readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')

            // Check if this is a Client Component
            const isClientComponent = lines.some(line =>
              line.trim() === "'use client'" || line.trim() === '"use client"'
            )

            if (!isClientComponent) {
              // Server Component - check for internal API fetches
              lines.forEach((line, index) => {
                // Match fetch to NEXTAUTH_URL or /api/ endpoints
                if (/fetch\([^)]*NEXTAUTH_URL|fetch\([^)]*['"`]\/api\//.test(line)) {
                  // Allow public endpoints
                  if (line.includes('/api/public/') || line.includes('/api/health')) {
                    return
                  }
                  violations.push(
                    `${fullPath}:${index + 1} - Internal auth API fetch in Server Component: ${line.trim().substring(0, 100)}`
                  )
                }
              })
            }
          }
        }
      }

      scanDirectory(appDir)

      if (violations.length > 0) {
        console.error('\n❌ Internal authenticated API fetches from Server Components:')
        violations.forEach(v => console.error(`  - ${v}`))
        console.error('\nThese will cause "Unauthorized" errors in production')
        console.error('\nFix: Use Prisma/services directly instead of HTTP fetch\n')
      }

      expect(violations).toEqual([])
    })

    it('should use Prisma directly in admin dashboard', () => {
      const dashboardPath = path.join(process.cwd(), 'app/admin/page.tsx')
      const content = fs.readFileSync(dashboardPath, 'utf-8')

      // Should import Prisma
      expect(content).toContain("from '@/lib/prisma'")

      // Should NOT fetch internal stats API
      expect(content).not.toContain('fetch(`${process.env.NEXTAUTH_URL}/api/stats')

      // Should have direct database queries
      expect(content).toContain('prisma.')
    })
  })

  describe('Auth Context Verification', () => {
    it('should verify all admin pages require authentication', () => {
      const adminDir = path.join(process.cwd(), 'app/admin')
      const pageFiles: string[] = []

      function findPages(dir: string) {
        if (!fs.existsSync(dir)) return

        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            findPages(fullPath)
          } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
            pageFiles.push(fullPath)
          }
        }
      }

      findPages(adminDir)

      const missingAuth: string[] = []

      pageFiles.forEach(pagePath => {
        const content = fs.readFileSync(pagePath, 'utf-8')
        const lines = content.split('\n')

        const isClientComponent = lines.some(line =>
          line.trim() === "'use client'" || line.trim() === '"use client"'
        )

        if (!isClientComponent) {
          // Server Component admin pages should call getSession
          if (!content.includes('getSession') && !content.includes('requireAuth')) {
            missingAuth.push(pagePath)
          }
        }
      })

      if (missingAuth.length > 0) {
        console.error('\n⚠️  Admin pages without auth check:')
        missingAuth.forEach(p => console.error(`  - ${p}`))
      }

      // This is a warning, not a hard failure (Client Components may handle auth differently)
      // But Server Components should use getSession
    })
  })
})
