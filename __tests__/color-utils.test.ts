import { describe, it, expect } from '@jest/globals'
import { getContrastTextColor, isValidHexColor, normalizeHexColor } from '@/lib/utils/color'

describe('Color Utilities', () => {
  describe('getContrastTextColor', () => {
    it('returns white text for dark backgrounds', () => {
      expect(getContrastTextColor('#000000')).toBe('#FFFFFF') // Black
      expect(getContrastTextColor('#333333')).toBe('#FFFFFF') // Dark gray
      expect(getContrastTextColor('#FF6B35')).toBe('#FFFFFF') // Orange (Cono Churro)
      expect(getContrastTextColor('#1E40AF')).toBe('#FFFFFF') // Blue
    })

    it('returns dark text for light backgrounds', () => {
      expect(getContrastTextColor('#FFFFFF')).toBe('#111827') // White
      expect(getContrastTextColor('#F3F4F6')).toBe('#111827') // Light gray
      expect(getContrastTextColor('#FFEB3B')).toBe('#111827') // Yellow
      expect(getContrastTextColor('#E0F2FE')).toBe('#111827') // Light blue
    })

    it('handles hex colors without # prefix', () => {
      expect(getContrastTextColor('000000')).toBe('#FFFFFF')
      expect(getContrastTextColor('FFFFFF')).toBe('#111827')
    })

    it('returns white for invalid colors (fallback)', () => {
      expect(getContrastTextColor('invalid')).toBe('#FFFFFF')
      expect(getContrastTextColor('#GGG')).toBe('#FFFFFF')
      expect(getContrastTextColor('')).toBe('#FFFFFF')
    })
  })

  describe('isValidHexColor', () => {
    it('validates correct hex colors', () => {
      expect(isValidHexColor('#FF6B35')).toBe(true)
      expect(isValidHexColor('FF6B35')).toBe(true)
      expect(isValidHexColor('#000000')).toBe(true)
      expect(isValidHexColor('#FFFFFF')).toBe(true)
      expect(isValidHexColor('#abc123')).toBe(true)
    })

    it('rejects invalid hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(false) // Too short
      expect(isValidHexColor('#GGGGGG')).toBe(false) // Invalid chars
      expect(isValidHexColor('invalid')).toBe(false)
      expect(isValidHexColor('')).toBe(false)
      expect(isValidHexColor('#12345')).toBe(false) // Wrong length
    })
  })

  describe('normalizeHexColor', () => {
    it('adds # prefix if missing', () => {
      expect(normalizeHexColor('FF6B35')).toBe('#FF6B35')
      expect(normalizeHexColor('000000')).toBe('#000000')
    })

    it('preserves # prefix if present', () => {
      expect(normalizeHexColor('#FF6B35')).toBe('#FF6B35')
      expect(normalizeHexColor('#000000')).toBe('#000000')
    })

    it('returns null for invalid colors', () => {
      expect(normalizeHexColor('invalid')).toBe(null)
      expect(normalizeHexColor('#FFF')).toBe(null)
      expect(normalizeHexColor('')).toBe(null)
    })
  })
})
