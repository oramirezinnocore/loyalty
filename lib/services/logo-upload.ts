/**
 * Business Logo Upload Service
 *
 * Handles secure file uploads, validation, optimization, and storage
 * for business logos. NOT using Base64 in database or S3.
 *
 * Architecture:
 * - Upload: multipart/form-data → validation → optimization → persistent storage
 * - Storage: /app/uploads/businesses/{businessId}/logo.webp
 * - Database: stores public URL reference only
 * - Delivery: /api/public/assets/businesses/{businessId}/logo
 */

import sharp from 'sharp'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomBytes } from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DIMENSION = 800
const WEBP_QUALITY = 85

export interface LogoUploadResult {
  success: boolean
  logoUrl?: string
  error?: string
}

/**
 * Validate uploaded file
 */
async function validateUpload(buffer: Buffer, mimeType: string): Promise<string | null> {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return 'Formato no permitido. Use PNG, JPG o WebP'
  }

  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return `Archivo demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`
  }

  // Verify actual image content using sharp (detects fake MIME)
  try {
    const metadata = await sharp(buffer).metadata()

    // Verify format matches declared MIME
    const validFormats = ['jpeg', 'png', 'webp']
    if (!metadata.format || !validFormats.includes(metadata.format)) {
      return 'Archivo no es una imagen válida'
    }

    // Reject SVG (even if passed as other MIME)
    if (metadata.format === 'svg') {
      return 'SVG no permitido'
    }

  } catch (error) {
    return 'Archivo corrupto o no es una imagen válida'
  }

  return null
}

/**
 * Optimize image: resize, convert to WebP, strip metadata
 */
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true // Don't upscale small images
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

/**
 * Validate business ID format to prevent path traversal
 */
function validateBusinessId(businessId: string): boolean {
  // Must be a valid CUID (alphanumeric, starts with 'c', 25 chars)
  // This prevents path traversal attempts like "../../../etc/passwd"
  const cuidPattern = /^c[a-z0-9]{24}$/i
  return cuidPattern.test(businessId)
}

/**
 * Ensure uploads directory exists with correct permissions
 */
async function ensureUploadsDir(businessId: string): Promise<string> {
  // Validate businessId to prevent path traversal
  if (!validateBusinessId(businessId)) {
    throw new Error('Invalid business ID format')
  }

  const businessDir = path.join(UPLOADS_DIR, 'businesses', businessId)

  try {
    await fs.mkdir(businessDir, { recursive: true, mode: 0o755 })
  } catch (error) {
    console.error('Failed to create uploads directory:', error)
    throw new Error('Error al crear directorio de almacenamiento')
  }

  return businessDir
}

/**
 * Safely write optimized image with atomic replacement
 */
async function saveOptimizedLogo(
  businessId: string,
  optimizedBuffer: Buffer
): Promise<string> {
  const businessDir = await ensureUploadsDir(businessId)
  const finalPath = path.join(businessDir, 'logo.webp')

  // Write to temporary file first (atomic operation)
  const tempPath = path.join(businessDir, `logo.tmp.${randomBytes(8).toString('hex')}.webp`)

  try {
    await fs.writeFile(tempPath, optimizedBuffer, { mode: 0o644 })

    // Atomic rename/replace
    await fs.rename(tempPath, finalPath)

    return finalPath
  } catch (error) {
    // Cleanup temp file on failure
    try {
      await fs.unlink(tempPath)
    } catch {}

    console.error('Failed to save optimized logo:', error)
    throw new Error('Error al guardar logo optimizado')
  }
}

/**
 * Process and save business logo upload
 *
 * @param businessId - Business UUID
 * @param file - Uploaded file buffer
 * @param mimeType - Declared MIME type
 * @returns Public logo URL or error
 */
export async function uploadBusinessLogo(
  businessId: string,
  file: Buffer,
  mimeType: string
): Promise<LogoUploadResult> {
  try {
    // Validate
    const validationError = await validateUpload(file, mimeType)
    if (validationError) {
      return { success: false, error: validationError }
    }

    // Optimize
    const optimizedBuffer = await optimizeImage(file)

    // Save
    await saveOptimizedLogo(businessId, optimizedBuffer)

    // Generate cache-busted URL
    const version = Date.now()
    const logoUrl = `/api/public/assets/businesses/${businessId}/logo?v=${version}`

    return { success: true, logoUrl }
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return {
      success: false,
      error: error.message || 'Error al procesar la imagen'
    }
  }
}

/**
 * Get logo file path for business
 */
export async function getBusinessLogoPath(businessId: string): Promise<string | null> {
  const logoPath = path.join(UPLOADS_DIR, 'businesses', businessId, 'logo.webp')

  try {
    await fs.access(logoPath)
    return logoPath
  } catch {
    return null
  }
}

/**
 * Delete business logo
 */
export async function deleteBusinessLogo(businessId: string): Promise<void> {
  const logoPath = await getBusinessLogoPath(businessId)

  if (logoPath) {
    try {
      await fs.unlink(logoPath)
    } catch (error) {
      console.error('Failed to delete logo:', error)
    }
  }
}
