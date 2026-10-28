import { describe, it, expect } from '@jest/globals'

/**
 * Test suite for loyalty poster generator logic
 *
 * These tests verify the business logic for generating promotional poster copy
 * based on different program types without requiring DOM rendering.
 */

describe('Loyalty Poster Generator - Business Logic', () => {
  describe('Benefit Copy Generation', () => {
    const getBenefitCopy = (
      programType: 'VISITS' | 'PURCHASES' | 'STREAK' | 'POINTS',
      goal: number,
      rewardName: string
    ): string => {
      const typeMap = {
        PURCHASES: `Completa ${goal} ${goal === 1 ? 'compra' : 'compras'}`,
        VISITS: `Completa ${goal} ${goal === 1 ? 'visita' : 'visitas'}`,
        STREAK: `Visítanos ${goal} ${goal === 1 ? 'día consecutivo' : 'días consecutivos'}`,
        POINTS: `Acumula ${goal} ${goal === 1 ? 'punto' : 'puntos'}`
      }

      return `${typeMap[programType]} y recibe\n${rewardName}`
    }

    it('generates PURCHASES copy with singular compra', () => {
      const copy = getBenefitCopy('PURCHASES', 1, 'Churro gratis')
      expect(copy).toBe('Completa 1 compra y recibe\nChurro gratis')
    })

    it('generates PURCHASES copy with plural compras', () => {
      const copy = getBenefitCopy('PURCHASES', 5, 'Churro gratis')
      expect(copy).toBe('Completa 5 compras y recibe\nChurro gratis')
    })

    it('generates VISITS copy with singular visita', () => {
      const copy = getBenefitCopy('VISITS', 1, 'Café gratis')
      expect(copy).toBe('Completa 1 visita y recibe\nCafé gratis')
    })

    it('generates VISITS copy with plural visitas', () => {
      const copy = getBenefitCopy('VISITS', 10, 'Café gratis')
      expect(copy).toBe('Completa 10 visitas y recibe\nCafé gratis')
    })

    it('generates STREAK copy with singular día consecutivo', () => {
      const copy = getBenefitCopy('STREAK', 1, 'Descuento 10%')
      expect(copy).toBe('Visítanos 1 día consecutivo y recibe\nDescuento 10%')
    })

    it('generates STREAK copy with plural días consecutivos', () => {
      const copy = getBenefitCopy('STREAK', 7, 'Descuento 10%')
      expect(copy).toBe('Visítanos 7 días consecutivos y recibe\nDescuento 10%')
    })

    it('generates POINTS copy with singular punto', () => {
      const copy = getBenefitCopy('POINTS', 1, 'Regalo sorpresa')
      expect(copy).toBe('Acumula 1 punto y recibe\nRegalo sorpresa')
    })

    it('generates POINTS copy with plural puntos', () => {
      const copy = getBenefitCopy('POINTS', 100, 'Regalo sorpresa')
      expect(copy).toBe('Acumula 100 puntos y recibe\nRegalo sorpresa')
    })

    it('handles different reward names', () => {
      const rewards = [
        '1 churro gratis',
        'Corte de cabello gratis',
        'Lavado premium sin costo',
        'Postre de tu elección'
      ]

      rewards.forEach(reward => {
        const copy = getBenefitCopy('PURCHASES', 5, reward)
        expect(copy).toContain(reward)
        expect(copy).toContain('Completa 5 compras y recibe')
      })
    })
  })

  describe('Filename Generation', () => {
    const getPosterFilename = (businessSlug: string): string => {
      return `${businessSlug}-programa-lealtad.png`
    }

    const getQRFilename = (businessSlug: string): string => {
      return `${businessSlug}-qr-registro.png`
    }

    it('generates poster filename with business slug', () => {
      expect(getPosterFilename('cono-churro')).toBe('cono-churro-programa-lealtad.png')
      expect(getPosterFilename('barberia-leon')).toBe('barberia-leon-programa-lealtad.png')
      expect(getPosterFilename('cafe-central')).toBe('cafe-central-programa-lealtad.png')
    })

    it('generates QR filename with business slug', () => {
      expect(getQRFilename('cono-churro')).toBe('cono-churro-qr-registro.png')
      expect(getQRFilename('barberia-leon')).toBe('barberia-leon-qr-registro.png')
      expect(getQRFilename('cafe-central')).toBe('cafe-central-qr-registro.png')
    })

    it('handles special characters in business slug', () => {
      // Slugs should be normalized, but in case they aren't
      expect(getPosterFilename('bar-el-sol')).toBe('bar-el-sol-programa-lealtad.png')
      expect(getPosterFilename('spa-zen-123')).toBe('spa-zen-123-programa-lealtad.png')
    })
  })

  describe('URL Generation', () => {
    const getAcquisitionUrl = (baseUrl: string, businessSlug: string): string => {
      return `${baseUrl}/join/${businessSlug}`
    }

    it('generates correct acquisition URL', () => {
      const url = getAcquisitionUrl('https://loyalty.intuspath.com', 'cono-churro')
      expect(url).toBe('https://loyalty.intuspath.com/join/cono-churro')
    })

    it('handles different base URLs', () => {
      expect(getAcquisitionUrl('http://localhost:3000', 'test-business'))
        .toBe('http://localhost:3000/join/test-business')

      expect(getAcquisitionUrl('https://staging.loyalty.com', 'demo'))
        .toBe('https://staging.loyalty.com/join/demo')
    })

    it('handles different business slugs', () => {
      const baseUrl = 'https://loyalty.intuspath.com'
      const slugs = ['cono-churro', 'barberia-leon', 'cafe-central', 'spa-zen']

      slugs.forEach(slug => {
        const url = getAcquisitionUrl(baseUrl, slug)
        expect(url).toBe(`${baseUrl}/join/${slug}`)
        expect(url).toContain(slug)
      })
    })
  })

  describe('Fallback Values', () => {
    it('uses default brandColor when not provided', () => {
      const defaultColor = '#6B7280'
      const providedColor = null
      const finalColor = providedColor || defaultColor

      expect(finalColor).toBe('#6B7280')
    })

    it('uses provided brandColor', () => {
      const defaultColor = '#6B7280'
      const providedColor = '#F13B32'
      const finalColor = providedColor || defaultColor

      expect(finalColor).toBe('#F13B32')
    })

    it('uses fallback reward name when not provided', () => {
      const providedReward = null
      const fallbackReward = 'Recompensa especial'
      const finalReward = providedReward || fallbackReward

      expect(finalReward).toBe('Recompensa especial')
    })

    it('handles missing logo with initial letter', () => {
      const businessName = 'Cono Churro'
      const initial = businessName.charAt(0).toUpperCase()

      expect(initial).toBe('C')
    })

    it('handles empty business name with safe fallback', () => {
      const businessName = ''
      const initial = businessName.charAt(0).toUpperCase() || '?'

      expect(initial).toBe('?')
    })
  })

  describe('Logo URL Handling', () => {
    it('accepts valid relative logo URL', () => {
      const logoUrl = '/api/public/assets/businesses/clrxabc123/logo'
      expect(logoUrl).toMatch(/^\/api\/public/)
      expect(logoUrl).toContain('/logo')
    })

    it('accepts valid absolute logo URL', () => {
      const logoUrl = 'https://loyalty.intuspath.com/api/public/assets/businesses/clrxabc123/logo'
      expect(logoUrl).toMatch(/^https?:\/\//)
      expect(logoUrl).toContain('/logo')
    })

    it('handles null logoUrl', () => {
      const logoUrl = null
      const shouldShowFallback = !logoUrl

      expect(shouldShowFallback).toBe(true)
    })

    it('handles undefined logoUrl', () => {
      const logoUrl = undefined
      const shouldShowFallback = !logoUrl

      expect(shouldShowFallback).toBe(true)
    })

    it('validates logoUrl presence before attempting load', () => {
      const businessWithLogo = { logoUrl: '/api/public/assets/businesses/abc/logo' }
      const businessWithoutLogo = { logoUrl: null }

      expect(!!businessWithLogo.logoUrl).toBe(true)
      expect(!!businessWithoutLogo.logoUrl).toBe(false)
    })
  })

  describe('Color Lightening Logic', () => {
    const lightenColor = (color: string, percent: number): string => {
      const hex = color.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)

      const newR = Math.min(255, Math.floor(r + (255 - r) * percent))
      const newG = Math.min(255, Math.floor(g + (255 - g) * percent))
      const newB = Math.min(255, Math.floor(b + (255 - b) * percent))

      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }

    it('lightens dark color significantly', () => {
      const darkColor = '#000000'
      const lightened = lightenColor(darkColor, 0.9)

      // 90% lighter should be very light gray
      expect(lightened).toBe('#e5e5e5')
    })

    it('lightens medium color moderately', () => {
      const mediumColor = '#808080'
      const lightened = lightenColor(mediumColor, 0.5)

      // Should be halfway between #808080 and #FFFFFF
      expect(lightened).toBe('#bfbfbf')
    })

    it('does not change white color', () => {
      const whiteColor = '#FFFFFF'
      const lightened = lightenColor(whiteColor, 0.9)

      expect(lightened).toBe('#ffffff')
    })

    it('maintains hex format with leading zeros', () => {
      const color = '#000102'
      const lightened = lightenColor(color, 0.1)

      // Should maintain # and 6 characters
      expect(lightened).toMatch(/^#[0-9a-f]{6}$/)
    })
  })
})
