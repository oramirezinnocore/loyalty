import { NextRequest, NextResponse } from 'next/server'
import { getBusinessLogoPath } from '@/lib/services/logo-upload'
import * as fs from 'fs/promises'

/**
 * Public Logo Asset Endpoint
 *
 * Serves optimized business logos with caching
 * Prevents path traversal and arbitrary file access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params

    // Validate business ID format (CUID - matches Prisma @default(cuid()))
    // Format: 'c' + 24 alphanumeric characters (25 total)
    // This prevents path traversal attempts like "../../../etc/passwd"
    const cuidPattern = /^c[a-z0-9]{24}$/i
    if (!cuidPattern.test(businessId)) {
      return new NextResponse('Invalid business ID', { status: 400 })
    }

    // Get safe logo path (only resolves expected business logo location)
    const logoPath = await getBusinessLogoPath(businessId)

    if (!logoPath) {
      return new NextResponse('Logo not found', { status: 404 })
    }

    // Read file
    const fileBuffer = await fs.readFile(logoPath)

    // Return with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year (versioned URL)
        'Content-Length': fileBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Logo serve error:', error)
    return new NextResponse('Error serving logo', { status: 500 })
  }
}
