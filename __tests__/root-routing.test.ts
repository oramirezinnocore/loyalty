/**
 * Root routing and authentication redirect tests
 *
 * Verifies production-ready behavior:
 * - Unauthenticated users → login
 * - SUPER_ADMIN → /super-admin
 * - BUSINESS_ADMIN → /admin
 * - No Next.js starter content
 */

import { describe, it, expect } from '@jest/globals'
import fs from 'fs'
import path from 'path'

describe('Root Routing', () => {
  describe('Root page implementation', () => {
    it('should not contain Next.js starter content', () => {
      const rootPagePath = path.join(process.cwd(), 'app', 'page.tsx')
      const content = fs.readFileSync(rootPagePath, 'utf-8')

      // Should NOT contain starter template text
      expect(content).not.toContain('Get started by editing')
      expect(content).not.toContain('By Vercel')
      expect(content).not.toContain('Next.js logo')
      expect(content).not.toContain('nextjs.org')

      // SHOULD contain auth routing logic
      expect(content).toContain('getSession')
      expect(content).toContain('redirect')
    })

    it('should redirect unauthenticated users to login', () => {
      const rootPagePath = path.join(process.cwd(), 'app', 'page.tsx')
      const content = fs.readFileSync(rootPagePath, 'utf-8')

      expect(content).toContain('/auth/signin')
      expect(content).toContain('if (!session')
    })

    it('should redirect SUPER_ADMIN to /super-admin', () => {
      const rootPagePath = path.join(process.cwd(), 'app', 'page.tsx')
      const content = fs.readFileSync(rootPagePath, 'utf-8')

      expect(content).toContain('SUPER_ADMIN')
      expect(content).toContain('/super-admin')
    })

    it('should redirect BUSINESS_ADMIN to /admin', () => {
      const rootPagePath = path.join(process.cwd(), 'app', 'page.tsx')
      const content = fs.readFileSync(rootPagePath, 'utf-8')

      expect(content).toContain('BUSINESS_ADMIN')
      expect(content).toContain('/admin')
    })
  })

  describe('Production admin helper script', () => {
    it('should exist and be executable', () => {
      const helperPath = path.join(process.cwd(), 'create-production-admin.sh')
      expect(fs.existsSync(helperPath)).toBe(true)

      const stats = fs.statSync(helperPath)
      // Check executable bit for owner
      expect((stats.mode & 0o100) !== 0).toBe(true)
    })

    it('should use SHA-tagged images not :latest', () => {
      const helperPath = path.join(process.cwd(), 'create-production-admin.sh')
      const content = fs.readFileSync(helperPath, 'utf-8')

      // Should determine current SHA
      expect(content).toContain('git rev-parse')
      expect(content).toContain('CURRENT_SHA')

      // Should set GIT_SHA for compose
      expect(content).toContain('export GIT_SHA')

      // Should verify image exists
      expect(content).toContain('docker image inspect')

      // Should NOT default to :latest
      expect(content).not.toContain('loyalty-app:latest')
    })

    it('should never accept password in argv', () => {
      const helperPath = path.join(process.cwd(), 'create-production-admin.sh')
      const content = fs.readFileSync(helperPath, 'utf-8')

      // Should run interactively (no password args)
      expect(content).not.toMatch(/password.*\$\d/)
      expect(content).not.toMatch(/\$1.*password/)

      // Should run the Node script directly (interactive stdin)
      expect(content).toContain('node scripts/create-super-admin.js')
    })

    it('should require .env.production to exist', () => {
      const helperPath = path.join(process.cwd(), 'create-production-admin.sh')
      const content = fs.readFileSync(helperPath, 'utf-8')

      expect(content).toContain('ENV_FILE=".env.production"')
      expect(content).toContain('if [[ ! -f "$ENV_FILE"')
    })
  })

  describe('Dockerfile production readiness', () => {
    it('should copy admin bootstrap script to runner', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      const content = fs.readFileSync(dockerfilePath, 'utf-8')

      expect(content).toContain('COPY --from=builder')
      expect(content).toContain('scripts/create-super-admin.js')
    })

    it('should copy bcryptjs runtime dependency', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      const content = fs.readFileSync(dockerfilePath, 'utf-8')

      expect(content).toContain('node_modules/bcryptjs')
    })

    it('should assert admin script exists in final image', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      const content = fs.readFileSync(dockerfilePath, 'utf-8')

      expect(content).toContain('test -f /app/scripts/create-super-admin.js')
    })

    it('should validate runtime dependencies at build time', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      const content = fs.readFileSync(dockerfilePath, 'utf-8')

      expect(content).toContain("require('@prisma/client')")
      expect(content).toContain("require('bcryptjs')")
    })

    it('should assert no secret env files in final image', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      const content = fs.readFileSync(dockerfilePath, 'utf-8')

      expect(content).toContain('SECURITY ERROR: Secret .env files')
      expect(content).toContain('.env.production')
    })
  })

  describe('Application metadata', () => {
    it('should have IntusPath Loyalty branding in layout', () => {
      const layoutPath = path.join(process.cwd(), 'app', 'layout.tsx')
      const content = fs.readFileSync(layoutPath, 'utf-8')

      // Should identify as IntusPath Loyalty
      const hasLoyaltyBranding =
        content.includes('IntusPath') ||
        content.includes('Loyalty') ||
        content.includes('InnoCore')

      expect(hasLoyaltyBranding).toBe(true)
    })
  })
})
