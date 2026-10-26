'use server'

import { requireBusinessAccess } from '@/lib/authorization'
import { uploadBusinessLogo } from '@/lib/services/logo-upload'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export interface UploadLogoResult {
  success: boolean
  logoUrl?: string
  error?: string
}

/**
 * Upload business logo
 *
 * Server action for authenticated BUSINESS_ADMIN logo upload
 * Enforces tenant isolation
 */
export async function uploadLogo(
  businessId: string,
  formData: FormData
): Promise<UploadLogoResult> {
  try {
    // Enforce tenant access
    await requireBusinessAccess(businessId)

    // Extract file from form data
    const file = formData.get('logo') as File

    if (!file) {
      return { success: false, error: 'No se seleccionó ningún archivo' }
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process upload
    const result = await uploadBusinessLogo(businessId, buffer, file.type)

    if (!result.success) {
      return result
    }

    // Update database with logo URL reference
    await prisma.business.update({
      where: { id: businessId },
      data: { logoUrl: result.logoUrl }
    })

    // Revalidate settings page
    revalidatePath('/admin/settings')
    revalidatePath(`/join`)
    revalidatePath(`/wallet`)

    return { success: true, logoUrl: result.logoUrl }
  } catch (error: any) {
    console.error('Upload logo action error:', error)

    if (error.message?.includes('Unauthorized')) {
      return { success: false, error: 'No autorizado' }
    }

    return { success: false, error: 'Error al subir logo' }
  }
}
