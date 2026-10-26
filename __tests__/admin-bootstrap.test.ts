import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Import functions from the script
const { normalizeEmail, validatePassword, isValidEmail } = require('../scripts/create-super-admin.js')

describe('Admin Bootstrap - Validation Functions', () => {
  describe('normalizeEmail', () => {
    it('converts to lowercase', () => {
      expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com')
    })

    it('trims whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com')
    })

    it('handles mixed case and spaces', () => {
      expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
    })
  })

  describe('isValidEmail', () => {
    it('accepts valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    it('accepts email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true)
    })

    it('rejects email without @', () => {
      expect(isValidEmail('testexample.com')).toBe(false)
    })

    it('rejects email without domain', () => {
      expect(isValidEmail('test@')).toBe(false)
    })

    it('rejects email without TLD', () => {
      expect(isValidEmail('test@example')).toBe(false)
    })

    it('rejects email with spaces', () => {
      expect(isValidEmail('test @example.com')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('accepts strong password', () => {
      expect(validatePassword('SecurePass123')).toBe(null)
    })

    it('accepts password with special characters', () => {
      expect(validatePassword('Secure@Pass123!')).toBe(null)
    })

    it('rejects password shorter than 12 characters', () => {
      const result = validatePassword('Short1')
      expect(result).toContain('at least 12 characters')
    })

    it('rejects password without letters', () => {
      const result = validatePassword('123456789012')
      expect(result).toContain('letters and numbers')
    })

    it('rejects password without numbers', () => {
      const result = validatePassword('SecurePassword')
      expect(result).toContain('letters and numbers')
    })

    it('accepts exactly 12 characters with letters and numbers', () => {
      expect(validatePassword('Password1234')).toBe(null)
    })
  })
})

describe('Admin Bootstrap - Database Operations', () => {
  const testEmail = 'bootstrap-test@example.com'
  const testName = 'Bootstrap Test User'
  const testPassword = 'TestPassword123'

  beforeEach(async () => {
    // Clean up test user if exists
    await prisma.user.deleteMany({
      where: { email: testEmail }
    })
  })

  afterEach(async () => {
    // Clean up after tests
    await prisma.user.deleteMany({
      where: { email: testEmail }
    })
  })

  it('creates SUPER_ADMIN with hashed password', async () => {
    const hashedPassword = await bcrypt.hash(testPassword, 12)

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: testName,
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    })

    expect(user.email).toBe(testEmail)
    expect(user.name).toBe(testName)
    expect(user.role).toBe('SUPER_ADMIN')
    expect(user.passwordHash).not.toBe(testPassword) // Never plaintext
    expect(user.passwordHash).toHaveLength(60) // bcrypt hash length

    // Verify password can be verified
    const isValid = await bcrypt.compare(testPassword, user.passwordHash)
    expect(isValid).toBe(true)
  })

  it('normalizes email on lookup', async () => {
    // Create with lowercase
    await prisma.user.create({
      data: {
        email: testEmail.toLowerCase(),
        name: testName,
        passwordHash: await bcrypt.hash(testPassword, 12),
        role: 'BUSINESS_ADMIN'
      }
    })

    // Lookup with uppercase should work after normalization
    const normalizedEmail = normalizeEmail(testEmail.toUpperCase())
    const found = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    expect(found).not.toBeNull()
    expect(found?.email).toBe(testEmail)
  })

  it('prevents duplicate email creation', async () => {
    // Create first user
    await prisma.user.create({
      data: {
        email: testEmail,
        name: testName,
        passwordHash: await bcrypt.hash(testPassword, 12),
        role: 'BUSINESS_ADMIN'
      }
    })

    // Attempt to create duplicate
    await expect(
      prisma.user.create({
        data: {
          email: testEmail,
          name: 'Another User',
          passwordHash: await bcrypt.hash('AnotherPass123', 12),
          role: 'SUPER_ADMIN'
        }
      })
    ).rejects.toThrow()
  })

  it('can promote existing user to SUPER_ADMIN', async () => {
    // Create as BUSINESS_ADMIN
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: testName,
        passwordHash: await bcrypt.hash(testPassword, 12),
        role: 'BUSINESS_ADMIN'
      }
    })

    expect(user.role).toBe('BUSINESS_ADMIN')

    // Promote to SUPER_ADMIN
    const promoted = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })

    expect(promoted.role).toBe('SUPER_ADMIN')
    expect(promoted.email).toBe(testEmail)
  })

  it('promotion preserves password', async () => {
    const hashedPassword = await bcrypt.hash(testPassword, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: testName,
        passwordHash: hashedPassword,
        role: 'BUSINESS_ADMIN'
      }
    })

    const originalPasswordHash = user.passwordHash

    // Promote (should not change password)
    const promoted = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })

    expect(promoted.passwordHash).toBe(originalPasswordHash)

    // Verify original password still works
    const isValid = await bcrypt.compare(testPassword, promoted.passwordHash)
    expect(isValid).toBe(true)
  })

  it('idempotent for existing SUPER_ADMIN', async () => {
    // Create SUPER_ADMIN
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: testName,
        passwordHash: await bcrypt.hash(testPassword, 12),
        role: 'SUPER_ADMIN'
      }
    })

    // Check if already SUPER_ADMIN
    const found = await prisma.user.findUnique({
      where: { email: testEmail }
    })

    expect(found?.role).toBe('SUPER_ADMIN')
    // In actual script, this exits successfully without changes
  })

  it('rejects weak password (< 12 chars)', () => {
    const result = validatePassword('Weak1')
    expect(result).not.toBeNull()
    expect(result).toContain('12 characters')
  })

  it('rejects password without numbers', () => {
    const result = validatePassword('OnlyLettersHere')
    expect(result).not.toBeNull()
    expect(result).toContain('letters and numbers')
  })
})
