/**
 * Logo URL Utilities
 *
 * Helper functions for constructing public logo URLs
 * Ensures consistent URL format across all pages (Join, Wallet, Settings, etc.)
 */

/**
 * Get public logo URL for a business
 *
 * Constructs the public API URL for serving business logos.
 * This is the single source of truth for logo URLs in the frontend.
 *
 * The endpoint /api/public/assets/businesses/[businessId]/logo will:
 * - Return the logo if it exists (200 + image/webp)
 * - Return 404 if no logo exists
 *
 * @param businessId - Business ID
 * @param hasLogo - Whether business has a logo (from Business.logoUrl != null)
 * @returns Public logo URL or null if no logo
 *
 * @example
 * getPublicLogoUrl('cm123...', true) // "/api/public/assets/businesses/cm123.../logo"
 * getPublicLogoUrl('cm123...', false) // null
 */
export function getPublicLogoUrl(
  businessId: string,
  hasLogo: boolean = true
): string | null {
  if (!hasLogo) {
    return null
  }

  // Construct public API URL
  // Note: We don't include ?v= here because we'll handle that in the component
  // to avoid caching issues when logo is updated
  return `/api/public/assets/businesses/${businessId}/logo`
}

/**
 * Get logo URL with cache busting version
 *
 * Adds a version parameter to force cache refresh when logo is updated.
 * Use this when you know the logo exists and want to ensure fresh content.
 *
 * @param businessId - Business ID
 * @param version - Version timestamp (typically Date.now() or updatedAt)
 * @returns Public logo URL with version parameter
 *
 * @example
 * getVersionedLogoUrl('cm123...', Date.now())
 * // "/api/public/assets/businesses/cm123.../logo?v=1699999999999"
 */
export function getVersionedLogoUrl(
  businessId: string,
  version?: number | Date
): string {
  const baseUrl = `/api/public/assets/businesses/${businessId}/logo`

  if (!version) {
    return baseUrl
  }

  const versionParam = typeof version === 'number' ? version : version.getTime()
  return `${baseUrl}?v=${versionParam}`
}

/**
 * Normalize legacy logo URL to public API URL
 *
 * Converts old filesystem paths or malformed URLs to proper public API URLs.
 * Use this when working with Business.logoUrl from the database which might
 * contain legacy values.
 *
 * @param logoUrl - Raw logoUrl from Business.logoUrl field
 * @param businessId - Business ID to construct correct URL
 * @returns Normalized public logo URL or null
 *
 * @example
 * normalizeLogo URL('uploads/businesses/cm123.../logo.webp', 'cm123...')
 * // "/api/public/assets/businesses/cm123.../logo"
 *
 * normalizeLogoUrl('/api/public/assets/businesses/cm123.../logo', 'cm123...')
 * // "/api/public/assets/businesses/cm123.../logo" (already correct)
 *
 * normalizeLogoUrl(null, 'cm123...') // null
 */
export function normalizeLogoUrl(
  logoUrl: string | null,
  businessId: string
): string | null {
  // No logo
  if (!logoUrl) {
    return null
  }

  // Already a public API URL (with or without version param)
  if (logoUrl.startsWith('/api/public/assets/businesses/')) {
    // Strip version param for consistency
    return logoUrl.split('?')[0]
  }

  // Legacy filesystem path or other format - construct public URL
  // The existence will be verified by the endpoint itself
  return `/api/public/assets/businesses/${businessId}/logo`
}
