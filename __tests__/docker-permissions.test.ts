/**
 * Docker Container Permissions Test
 *
 * CRITICAL: Prevents production runtime crashes from filesystem permissions
 *
 * Verifies:
 * 1. Next.js runtime directories are writable by nextjs user (UID 1001)
 * 2. .next/server/route-cache can be created
 * 3. Container runs as non-root
 *
 * Background: Production crash from:
 *   EACCES: permission denied, mkdir '/app/.next/server/route-cache'
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Docker Permissions Configuration', () => {
  it('should configure writable .next directories in Dockerfile', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
    const content = fs.readFileSync(dockerfilePath, 'utf-8')

    // Should create .next directories
    expect(content).toMatch(/mkdir.*\.next/)

    // Should set ownership to nextjs user
    expect(content).toMatch(/chown.*nextjs:nodejs.*\.next/)

    // Should create server directory (where route-cache lives)
    expect(content).toMatch(/\.next\/server/)
  })

  it('should run container as non-root nextjs user', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
    const content = fs.readFileSync(dockerfilePath, 'utf-8')

    // Should create nextjs user with UID 1001
    expect(content).toContain('adduser --system --uid 1001 nextjs')

    // Should switch to nextjs user before CMD
    const lines = content.split('\n')
    const userLine = lines.findIndex(line => line.trim() === 'USER nextjs')
    const cmdLine = lines.findIndex(line => line.trim().startsWith('CMD'))

    expect(userLine).toBeGreaterThan(-1)
    expect(cmdLine).toBeGreaterThan(userLine)
  })

  it('should not run as root in production', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
    const content = fs.readFileSync(dockerfilePath, 'utf-8')

    // Final USER directive should be nextjs, not root
    const lines = content.split('\n')
    const lastUserLine = lines.filter(line => line.trim().startsWith('USER ')).pop()

    expect(lastUserLine).toBe('USER nextjs')
  })

  it('should not use chmod 777 (security anti-pattern)', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
    const content = fs.readFileSync(dockerfilePath, 'utf-8')

    // Should never chmod 777 anything
    expect(content).not.toContain('chmod 777')
    expect(content).not.toContain('chmod -R 777')
  })

  it('should use proper COPY --chown for ownership', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
    const content = fs.readFileSync(dockerfilePath, 'utf-8')

    // At least one file should use --chown
    expect(content).toMatch(/COPY --from=builder --chown=nextjs:nodejs/)
  })
})
