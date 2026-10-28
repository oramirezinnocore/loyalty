import { describe, it, expect } from '@jest/globals'
import {
  getPublicLogoUrl,
  getVersionedLogoUrl,
  normalizeLogoUrl
} from '@/lib/utils/logo-url'

describe('Logo URL Utilities', () => {
  const businessId = 'cm123abc456def789'

  describe('getPublicLogoUrl', () => {
    it('returns public API URL when business has logo', () => {
      const url = getPublicLogoUrl(businessId, true)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })

    it('returns null when business has no logo', () => {
      const url = getPublicLogoUrl(businessId, false)
      expect(url).toBe(null)
    })

    it('defaults to hasLogo=true if not provided', () => {
      const url = getPublicLogoUrl(businessId)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })
  })

  describe('getVersionedLogoUrl', () => {
    it('returns URL with version parameter (number)', () => {
      const version = 1699999999999
      const url = getVersionedLogoUrl(businessId, version)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo?v=${version}`)
    })

    it('returns URL with version parameter (Date)', () => {
      const date = new Date('2023-11-15T00:00:00.000Z')
      const url = getVersionedLogoUrl(businessId, date)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo?v=${date.getTime()}`)
    })

    it('returns URL without version when not provided', () => {
      const url = getVersionedLogoUrl(businessId)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })
  })

  describe('normalizeLogoUrl', () => {
    it('returns null for null input', () => {
      const url = normalizeLogoUrl(null, businessId)
      expect(url).toBe(null)
    })

    it('preserves correct public API URL', () => {
      const correctUrl = `/api/public/assets/businesses/${businessId}/logo`
      const url = normalizeLogoUrl(correctUrl, businessId)
      expect(url).toBe(correctUrl)
    })

    it('preserves version parameter from correct URL (cache busting)', () => {
      const urlWithVersion = `/api/public/assets/businesses/${businessId}/logo?v=123456789`
      const url = normalizeLogoUrl(urlWithVersion, businessId)
      expect(url).toBe(urlWithVersion) // Preserve version for cache busting
    })

    it('converts legacy filesystem path to public URL', () => {
      const legacyPath = `uploads/businesses/${businessId}/logo.webp`
      const url = normalizeLogoUrl(legacyPath, businessId)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })

    it('converts absolute filesystem path to public URL', () => {
      const legacyPath = `/app/uploads/businesses/${businessId}/logo.webp`
      const url = normalizeLogoUrl(legacyPath, businessId)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })

    it('handles malformed URLs', () => {
      const malformedUrl = 'invalid-url'
      const url = normalizeLogoUrl(malformedUrl, businessId)
      expect(url).toBe(`/api/public/assets/businesses/${businessId}/logo`)
    })

    it('does not expose filesystem paths in output', () => {
      const legacyPath = '/app/uploads/businesses/cm123/logo.webp'
      const url = normalizeLogoUrl(legacyPath, businessId)

      // Ensure output never contains filesystem paths
      expect(url).not.toContain('/app/uploads')
      expect(url).not.toContain('uploads/businesses')
      expect(url).not.toContain('.webp')

      // Ensure it's a public API URL
      expect(url?.startsWith('/api/public')).toBe(true)
    })
  })
})
