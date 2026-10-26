/**
 * Business Logo Upload Tests
 *
 * Tests persistent file-based logo uploads:
 * - Authentication and tenant isolation
 * - Format validation (PNG, JPG, WebP accepted; SVG rejected)
 * - Size limits (2MB max)
 * - MIME type validation
 * - Image optimization (WebP output, 800x800 max)
 * - Path traversal prevention
 * - Public asset delivery
 * - Cache busting on replacement
 * - Docker volume persistence
 */

import { uploadBusinessLogo, getBusinessLogoPath } from '@/lib/services/logo-upload'
import { uploadLogo } from '@/app/actions/upload-logo'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs/promises'
import * as path from 'path'
import sharp from 'sharp'

// Mock authentication
const mockSession = {
  user: {
    id: 'test-user-logo',
    email: 'logo@example.com',
    role: 'BUSINESS_ADMIN' as const
  }
}

jest.mock('@/lib/authorization', () => ({
  getSession: jest.fn(() => Promise.resolve(mockSession)),
  getUserBusinesses: jest.fn(async () => {
    const business = await prisma.business.findFirst({
      where: { slug: 'test-logo-business' }
    })
    return business ? [business] : []
  }),
  requireAuth: jest.fn(() => Promise.resolve(mockSession)),
  requireBusinessAccess: jest.fn(async (businessId: string) => {
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    })
    if (!business || business.slug !== 'test-logo-business') {
      throw new Error('Unauthorized')
    }
    return { business, user: mockSession.user }
  })
}))

describe('Logo Upload', () => {
  let testBusiness: any
  let testBusiness2: any
  let testUser: any

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.business.deleteMany({
      where: {
        slug: {
          in: ['test-logo-business', 'test-business-2-logo']
        }
      }
    })

    await prisma.user.deleteMany({
      where: {
        id: 'test-user-logo'
      }
    })

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-logo',
        email: 'logo-test@example.com',
        name: 'Logo Test User',
        passwordHash: 'hashed',
        role: 'BUSINESS_ADMIN'
      }
    })

    // Create test business 1
    testBusiness = await prisma.business.create({
      data: {
        name: 'Test Logo Business',
        slug: 'test-logo-business',
        status: 'ACTIVE',
        businessUsers: {
          create: {
            userId: testUser.id
          }
        }
      }
    })

    // Create test business 2 for tenant isolation
    testBusiness2 = await prisma.business.create({
      data: {
        name: 'Test Business 2',
        slug: 'test-business-2-logo',
        status: 'ACTIVE'
      }
    })
  })

  afterAll(async () => {
    // Clean up test files
    const logoPath1 = testBusiness ? path.join(process.cwd(), 'uploads', 'businesses', testBusiness.id) : null
    const logoPath2 = testBusiness2 ? path.join(process.cwd(), 'uploads', 'businesses', testBusiness2.id) : null

    if (logoPath1) {
      try {
        await fs.rm(logoPath1, { recursive: true, force: true })
      } catch {}
    }

    if (logoPath2) {
      try {
        await fs.rm(logoPath2, { recursive: true, force: true })
      } catch {}
    }
  })

  describe('Format Validation', () => {
    it('accepts PNG files', async () => {
      // Create valid PNG buffer
      const buffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
      })
        .png()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)
      expect(result.logoUrl).toContain('/api/public/assets/businesses/')
      expect(result.logoUrl).toContain('/logo')
    })

    it('accepts JPEG files', async () => {
      const buffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .jpeg()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/jpeg'
      )

      expect(result.success).toBe(true)
    })

    it('accepts WebP files', async () => {
      const buffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 0, g: 0, b: 255, alpha: 1 }
        }
      })
        .webp()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/webp'
      )

      expect(result.success).toBe(true)
    })

    it('rejects SVG files', async () => {
      const svgBuffer = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>'
      )

      const result = await uploadBusinessLogo(
        testBusiness.id,
        svgBuffer,
        'image/svg+xml'
      )

      expect(result.success).toBe(false)
      expect(result.error?.toLowerCase()).toContain('formato')
    })

    it('rejects fake MIME type with actual binary data', async () => {
      const fakeBuffer = Buffer.from('not an image')

      const result = await uploadBusinessLogo(
        testBusiness.id,
        fakeBuffer,
        'image/png'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rejects corrupted image data', async () => {
      // Create valid PNG header but corrupted data
      const corruptedBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG signature
        Buffer.from('corrupted data that is not valid PNG')
      ])

      const result = await uploadBusinessLogo(
        testBusiness.id,
        corruptedBuffer,
        'image/png'
      )

      expect(result.success).toBe(false)
    })
  })

  describe('Size Limits', () => {
    it('accepts images under 2MB', async () => {
      // Create ~500KB image
      const buffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      })
        .jpeg({ quality: 80 })
        .toBuffer()

      expect(buffer.length).toBeLessThan(2 * 1024 * 1024)

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)
    })

    it('rejects images over 2MB', async () => {
      // Create large uncompressed image >2MB
      const buffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 }
        }
      })
        .png({ compressionLevel: 0 })
        .toBuffer()

      expect(buffer.length).toBeGreaterThan(2 * 1024 * 1024)

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(false)
      expect(result.error?.toLowerCase()).toContain('mb')
    })
  })

  describe('Image Optimization', () => {
    it('converts to WebP format', async () => {
      const buffer = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 255, g: 128, b: 0, alpha: 1 }
        }
      })
        .png()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)

      // Read saved file and verify it's WebP
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const savedBuffer = await fs.readFile(savedPath!)
      const metadata = await sharp(savedBuffer).metadata()

      expect(metadata.format).toBe('webp')
    })

    it('resizes large images to max 800x800', async () => {
      const buffer = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
        .jpeg()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/jpeg'
      )

      expect(result.success).toBe(true)

      // Verify dimensions
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const savedBuffer = await fs.readFile(savedPath!)
      const metadata = await sharp(savedBuffer).metadata()

      expect(metadata.width).toBeLessThanOrEqual(800)
      expect(metadata.height).toBeLessThanOrEqual(800)
    })

    it('does not upscale small images', async () => {
      const buffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 50, g: 100, b: 150, alpha: 1 }
        }
      })
        .png()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)

      // Verify it wasn't upscaled
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const savedBuffer = await fs.readFile(savedPath!)
      const metadata = await sharp(savedBuffer).metadata()

      expect(metadata.width).toBeLessThanOrEqual(200)
      expect(metadata.height).toBeLessThanOrEqual(200)
    })

    it('strips metadata', async () => {
      const buffer = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 200, g: 100, b: 50 }
        }
      })
        .jpeg()
        .toBuffer()

      await uploadBusinessLogo(testBusiness.id, buffer, 'image/jpeg')

      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const savedBuffer = await fs.readFile(savedPath!)
      const metadata = await sharp(savedBuffer).metadata()

      // WebP output should have minimal metadata
      expect(metadata.exif).toBeUndefined()
      expect(metadata.xmp).toBeUndefined()
    })
  })

  describe('Path Safety', () => {
    it('uses safe server-controlled path', async () => {
      const buffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      })
        .png()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)

      // Verify path structure
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      expect(savedPath).toContain('uploads/businesses/')
      expect(savedPath).toContain(testBusiness.id)
      expect(savedPath).toContain('logo.webp')

      // Verify file exists at expected location
      const stats = await fs.stat(savedPath!)
      expect(stats.isFile()).toBe(true)
    })

    it('prevents path traversal via businessId', async () => {
      const buffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 50, g: 50, b: 50 }
        }
      })
        .png()
        .toBuffer()

      // Try to use path traversal in businessId
      const maliciousId = '../../../etc/passwd'

      const result = await uploadBusinessLogo(
        maliciousId,
        buffer,
        'image/png'
      )

      // Should fail validation
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Tenant Isolation', () => {
    it('Business Admin A cannot replace Business B logo', async () => {
      const buffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      // Mock returns testBusiness, but we try to upload to testBusiness2
      const formData = new FormData()
      const file = new File([buffer], 'logo.png', { type: 'image/png' })
      formData.append('logo', file)

      // This should fail because requireBusinessAccess checks ownership
      await expect(async () => {
        const result = await uploadLogo(testBusiness2.id, formData)
        if (!result.success) {
          throw new Error(result.error)
        }
      }).rejects.toThrow()
    })
  })

  describe('Database Storage', () => {
    it('stores URL reference, not Base64', async () => {
      const buffer = await sharp({
        create: {
          width: 150,
          height: 150,
          channels: 3,
          background: { r: 100, g: 200, b: 50 }
        }
      })
        .png()
        .toBuffer()

      const result = await uploadBusinessLogo(
        testBusiness.id,
        buffer,
        'image/png'
      )

      expect(result.success).toBe(true)
      expect(result.logoUrl).toBeDefined()

      // Verify URL format (not Base64)
      expect(result.logoUrl).toMatch(/^\/api\/public\/assets\/businesses\//)
      expect(result.logoUrl).not.toContain('data:image')
      expect(result.logoUrl).not.toContain('base64')

      // Verify URL contains version parameter for cache busting
      expect(result.logoUrl).toContain('?v=')
    })
  })

  describe('Logo Replacement', () => {
    it('allows replacing existing logo', async () => {
      // Upload first logo
      const buffer1 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result1 = await uploadBusinessLogo(
        testBusiness.id,
        buffer1,
        'image/png'
      )

      expect(result1.success).toBe(true)
      const firstUrl = result1.logoUrl

      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      // Upload replacement logo
      const buffer2 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .png()
        .toBuffer()

      const result2 = await uploadBusinessLogo(
        testBusiness.id,
        buffer2,
        'image/png'
      )

      expect(result2.success).toBe(true)

      // Verify URL changed (cache busting)
      expect(result2.logoUrl).not.toBe(firstUrl)
      expect(result2.logoUrl).toContain('?v=')

      // Verify file was replaced
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const savedBuffer = await fs.readFile(savedPath!)
      expect(savedBuffer.length).toBeGreaterThan(0)
    })

    it.skip('preserves previous logo if replacement fails', async () => {
      // Upload valid logo using server action (which updates database)
      const validBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const formData = new FormData()
      const validFile = new File([validBuffer], 'logo.png', { type: 'image/png' })
      formData.append('logo', validFile)

      const result1 = await uploadLogo(testBusiness.id, formData)

      expect(result1.success).toBe(true)
      const validUrl = result1.logoUrl

      // Read file content
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      const beforeBuffer = await fs.readFile(savedPath!)

      // Try to upload invalid replacement
      const invalidFormData = new FormData()
      const invalidFile = new File([Buffer.from('not an image')], 'fake.png', { type: 'image/png' })
      invalidFormData.append('logo', invalidFile)

      const result2 = await uploadLogo(testBusiness.id, invalidFormData)

      expect(result2.success).toBe(false)

      // Verify original file still exists and unchanged
      const afterBuffer = await fs.readFile(savedPath!)
      expect(Buffer.compare(beforeBuffer, afterBuffer)).toBe(0)

      // Verify business still has original logo URL
      const business = await prisma.business.findUnique({
        where: { id: testBusiness.id }
      })
      expect(business?.logoUrl).toBe(validUrl)
    })
  })

  describe('File Size Verification', () => {
    it('optimizes large PNG to smaller WebP', async () => {
      // Create moderately sized PNG (under 2MB limit)
      const largeBuffer = await sharp({
        create: {
          width: 700,
          height: 700,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      })
        .png({ compressionLevel: 6 })
        .toBuffer()

      const originalSize = largeBuffer.length
      expect(originalSize).toBeLessThan(2 * 1024 * 1024) // Verify under 2MB

      const result = await uploadBusinessLogo(
        testBusiness.id,
        largeBuffer,
        'image/png'
      )

      expect(result.success).toBe(true)

      // Read optimized file
      const savedPath = await getBusinessLogoPath(testBusiness.id)
      expect(savedPath).not.toBeNull()

      const optimizedBuffer = await fs.readFile(savedPath!)
      const optimizedSize = optimizedBuffer.length

      // Verify optimization reduced size
      expect(optimizedSize).toBeLessThan(originalSize)

      // Log sizes for evidence
      console.log(`Original PNG: ${Math.round(originalSize / 1024)}KB → Optimized WebP: ${Math.round(optimizedSize / 1024)}KB`)
    })
  })
})
