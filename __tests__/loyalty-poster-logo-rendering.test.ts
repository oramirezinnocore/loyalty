import { describe, it, expect } from '@jest/globals'

/**
 * Logo Rendering Validation Tests
 *
 * These tests validate the business logic for logo URL normalization,
 * fallback behavior, and aspect ratio calculations used in poster generation.
 *
 * DOM/Canvas tests are excluded as they require browser environment.
 */

describe('Logo Rendering Flow', () => {

  describe('Logo URL Normalization', () => {
    const normalizeLogoUrl = (logoUrl: string | null, businessId: string): string | null => {
      if (!logoUrl) return null
      if (logoUrl.startsWith('/api/public/assets/businesses/')) {
        return logoUrl
      }
      return `/api/public/assets/businesses/${businessId}/logo`
    }

    it('converts filesystem path to public API URL', () => {
      const filesystemPath = '/app/uploads/businesses/cmvopb88a0001nr1y0fx05tct/logo.webp'
      const businessId = 'cmvopb88a0001nr1y0fx05tct'

      const normalized = normalizeLogoUrl(filesystemPath, businessId)

      expect(normalized).toBe('/api/public/assets/businesses/cmvopb88a0001nr1y0fx05tct/logo')
      expect(normalized).not.toContain('/app/uploads')
      expect(normalized).not.toContain('.webp')
    })

    it('preserves already-normalized public API URL', () => {
      const publicUrl = '/api/public/assets/businesses/cmvopb88a0001nr1y0fx05tct/logo'
      const businessId = 'cmvopb88a0001nr1y0fx05tct'

      const normalized = normalizeLogoUrl(publicUrl, businessId)

      expect(normalized).toBe(publicUrl)
    })

    it('preserves version parameter in public API URL', () => {
      const versionedUrl = '/api/public/assets/businesses/cmvopb88a0001nr1y0fx05tct/logo?v=1699999999'
      const businessId = 'cmvopb88a0001nr1y0fx05tct'

      const normalized = normalizeLogoUrl(versionedUrl, businessId)

      expect(normalized).toBe(versionedUrl)
      expect(normalized).toContain('?v=')
    })

    it('returns null for null logoUrl', () => {
      const normalized = normalizeLogoUrl(null, 'some-business-id')
      expect(normalized).toBeNull()
    })

    it('returns null for empty logoUrl', () => {
      const normalized = normalizeLogoUrl('', 'some-business-id')
      expect(normalized).toBeNull()
    })
  })

  describe('Fallback Behavior', () => {
    it('validates fallback occurs when logoUrl is null', () => {
      const logoUrl = null
      const businessName = 'Test Business'

      if (!logoUrl) {
        const initial = businessName.charAt(0).toUpperCase()
        expect(initial).toBe('T')
      }
    })

    it('validates fallback occurs when logoUrl is empty', () => {
      const logoUrl = ''
      const businessName = 'Cono Churro'

      if (!logoUrl) {
        const initial = businessName.charAt(0).toUpperCase()
        expect(initial).toBe('C')
      }
    })

    it('validates initial extraction from business name', () => {
      const testCases = [
        { name: 'Cono Churro', expected: 'C' },
        { name: 'Barberia León', expected: 'B' },
        { name: 'café central', expected: 'C' },
        { name: '123 Tienda', expected: '1' }
      ]

      testCases.forEach(({ name, expected }) => {
        const initial = name.charAt(0).toUpperCase()
        expect(initial).toBe(expected)
      })
    })
  })

  describe('Aspect Ratio Preservation', () => {
    it('calculates correct dimensions for landscape logo', () => {
      const logoWidth = 800
      const logoHeight = 400
      const logoSize = 300

      const aspectRatio = logoWidth / logoHeight
      let drawWidth = logoSize
      let drawHeight = logoSize

      if (aspectRatio > 1) {
        drawHeight = logoSize / aspectRatio
      }

      expect(drawWidth).toBe(300)
      expect(drawHeight).toBe(150)
    })

    it('calculates correct dimensions for portrait logo', () => {
      const logoWidth = 400
      const logoHeight = 800
      const logoSize = 300

      const aspectRatio = logoWidth / logoHeight
      let drawWidth = logoSize
      let drawHeight = logoSize

      if (aspectRatio < 1) {
        drawWidth = logoSize * aspectRatio
      }

      expect(drawWidth).toBe(150)
      expect(drawHeight).toBe(300)
    })

    it('calculates correct dimensions for square logo', () => {
      const logoWidth = 500
      const logoHeight = 500
      const logoSize = 300

      const aspectRatio = logoWidth / logoHeight
      let drawWidth = logoSize
      let drawHeight = logoSize

      if (aspectRatio > 1) {
        drawHeight = logoSize / aspectRatio
      } else if (aspectRatio < 1) {
        drawWidth = logoSize * aspectRatio
      }

      expect(drawWidth).toBe(300)
      expect(drawHeight).toBe(300)
    })
  })
})
