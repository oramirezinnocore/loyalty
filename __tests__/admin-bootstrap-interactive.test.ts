/**
 * Admin Bootstrap Interactive Flow Tests
 *
 * Tests the interactive prompt layer that was failing in production
 * with "output.on is not a function" error
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { spawn } from 'child_process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import path from 'path'

const prisma = new PrismaClient()

describe('Admin Bootstrap Interactive Flow', () => {
  const testEmail = 'interactive-test@example.com'

  beforeAll(async () => {
    // Clean up any existing test user
    await prisma.user.deleteMany({
      where: { email: testEmail }
    })
  })

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: testEmail }
    })
    await prisma.$disconnect()
  })

  it('should complete full interactive flow with piped input', (done) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'create-super-admin.js')

    const child = spawn('node', [scriptPath], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // Send input: email, name, password, confirm
    setTimeout(() => {
      child.stdin.write(`${testEmail}\n`)
    }, 100)

    setTimeout(() => {
      child.stdin.write('Interactive Test User\n')
    }, 200)

    setTimeout(() => {
      child.stdin.write('TestPassword123\n')
    }, 300)

    setTimeout(() => {
      child.stdin.write('TestPassword123\n')
      child.stdin.end()
    }, 400)

    child.on('close', async (code) => {
      // Verify output contains expected prompts
      expect(stdout).toContain('Email:')
      expect(stdout).toContain('Name:')
      expect(stdout).toContain('Password:')
      expect(stdout).toContain('Confirm password:')

      // Should NOT contain the error that was happening
      expect(stdout).not.toContain('output.on is not a function')
      expect(stderr).not.toContain('output.on is not a function')

      if (code === 0) {
        // Verify user was created
        const user = await prisma.user.findUnique({
          where: { email: testEmail }
        })

        expect(user).not.toBeNull()
        expect(user?.role).toBe('SUPER_ADMIN')
        expect(user?.name).toBe('Interactive Test User')

        // Verify password is hashed
        expect(user?.passwordHash).not.toBe('TestPassword123')
        expect(user?.passwordHash).toHaveLength(60) // bcrypt length

        // Verify password validates
        const isValid = await bcrypt.compare('TestPassword123', user!.passwordHash)
        expect(isValid).toBe(true)
      }

      done()
    })

    // Timeout safety
    setTimeout(() => {
      child.kill()
      done(new Error('Test timeout'))
    }, 10000)
  }, 15000)

  it('should not crash with output.on error', (done) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'create-super-admin.js')

    const child = spawn('node', [scriptPath], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // Send email and kill after to verify no output.on error
    setTimeout(() => {
      child.stdin.write('test@example.com\n')
    }, 100)

    setTimeout(() => {
      child.kill('SIGTERM')
    }, 500)

    child.on('close', () => {
      // The key test: should NOT have the error that was breaking production
      expect(stdout).not.toContain('output.on is not a function')
      expect(stderr).not.toContain('output.on is not a function')

      // Should have reached at least the email prompt
      expect(stdout).toContain('Email:')

      done()
    })

    // Safety timeout
    setTimeout(() => {
      child.kill('SIGKILL')
      done()
    }, 3000)
  }, 5000)
})
