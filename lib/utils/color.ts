/**
 * Color Utility Functions
 *
 * Helpers for working with colors, contrast, and accessibility.
 */

/**
 * Convert hex color to RGB values
 *
 * @param hex - Hex color string (e.g., "#FF6B35" or "FF6B35")
 * @returns RGB object or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return null
  }

  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return { r, g, b }
}

/**
 * Calculate relative luminance of a color
 *
 * Uses WCAG formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html
 *
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Relative luminance (0-1)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const normalized = val / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Determine best contrasting text color for a background
 *
 * Uses WCAG relative luminance to determine whether white or dark text
 * provides better contrast on the given background color.
 *
 * @param backgroundColor - Hex color string (e.g., "#FF6B35")
 * @returns "#FFFFFF" for dark backgrounds, "#111827" for light backgrounds
 *
 * @example
 * getContrastTextColor("#FF6B35") // "#FFFFFF" (orange is dark enough for white text)
 * getContrastTextColor("#FFEB3B") // "#111827" (yellow is too light, needs dark text)
 */
export function getContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)

  // Fallback to white if invalid color
  if (!rgb) {
    return '#FFFFFF'
  }

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)

  // Threshold: 0.5 (midpoint)
  // Light backgrounds (luminance > 0.5) need dark text
  // Dark backgrounds (luminance <= 0.5) need white text
  return luminance > 0.5 ? '#111827' : '#FFFFFF'
}

/**
 * Validate hex color format
 *
 * @param color - Color string to validate
 * @returns true if valid hex color, false otherwise
 *
 * @example
 * isValidHexColor("#FF6B35") // true
 * isValidHexColor("FF6B35")  // true
 * isValidHexColor("#FFF")    // false (must be 6 digits)
 * isValidHexColor("invalid") // false
 */
export function isValidHexColor(color: string): boolean {
  const cleanHex = color.replace('#', '')
  return /^[0-9A-Fa-f]{6}$/.test(cleanHex)
}

/**
 * Normalize hex color to always include #
 *
 * @param color - Hex color with or without #
 * @returns Normalized hex color with #, or null if invalid
 *
 * @example
 * normalizeHexColor("FF6B35")  // "#FF6B35"
 * normalizeHexColor("#FF6B35") // "#FF6B35"
 * normalizeHexColor("invalid") // null
 */
export function normalizeHexColor(color: string): string | null {
  if (!isValidHexColor(color)) {
    return null
  }

  return color.startsWith('#') ? color : `#${color}`
}
