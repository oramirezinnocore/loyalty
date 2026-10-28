/**
 * Public Program Lookup Service
 *
 * Shared server-only service for fetching business and loyalty program data
 * for public customer acquisition flows.
 *
 * Used by:
 * - /api/public/business/[slug]/program (API route)
 * - /join/[businessSlug] (indirectly via API)
 * - /api/customer/register (business resolution)
 */

import { prisma } from '@/lib/prisma'
import { LoyaltyProgramStatus, BusinessStatus } from '@prisma/client'
import { normalizeLogoUrl } from '@/lib/utils/logo-url'

export interface PublicProgramData {
  business: {
    id: string
    name: string
    slug: string
    brandColor: string | null
    logoUrl: string | null
    status: BusinessStatus
  }
  program: {
    id: string
    businessId: string
    name: string
    publicDescription: string | null
    pointsRequired: number
    programType: string
    termsAndConditions: string | null
    rewardDefinitions: Array<{
      name: string
      description: string | null
    }>
  } | null
}

export type PublicProgramError =
  | 'BUSINESS_NOT_FOUND'
  | 'BUSINESS_SUSPENDED'
  | 'DATABASE_ERROR'

export type PublicProgramResult =
  | { success: true; data: PublicProgramData }
  | { success: false; error: PublicProgramError; message: string }

/**
 * Get public business and program data by slug
 *
 * Returns business even if no active program exists (allows proper UI state)
 *
 * @param slug - Business slug (case-sensitive, must match database exactly)
 * @returns Result with business/program data or error
 */
export async function getPublicBusinessProgramBySlug(
  slug: string
): Promise<PublicProgramResult> {
  try {
    // Normalize slug: trim and lowercase for consistent lookup
    const normalizedSlug = slug.trim().toLowerCase()

    // Find business by slug
    const business = await prisma.business.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        brandColor: true,
        logoUrl: true,
        status: true
      }
    })

    if (!business) {
      return {
        success: false,
        error: 'BUSINESS_NOT_FOUND',
        message: 'Negocio no encontrado'
      }
    }

    if (business.status !== BusinessStatus.ACTIVE) {
      return {
        success: false,
        error: 'BUSINESS_SUSPENDED',
        message: 'El programa de lealtad no está disponible temporalmente'
      }
    }

    // Find ACTIVE program for this business
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        businessId: business.id,
        status: LoyaltyProgramStatus.ACTIVE
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        publicDescription: true,
        pointsRequired: true,
        programType: true,
        termsAndConditions: true,
        rewardDefinitions: {
          where: { isActive: true },
          select: {
            name: true,
            description: true
          }
        }
      }
    })

    // Success - return business with program (or null if no active program)
    // Normalize logo URL to ensure it's always a public API URL
    const normalizedLogoUrl = normalizeLogoUrl(business.logoUrl, business.id)

    return {
      success: true,
      data: {
        business: {
          ...business,
          logoUrl: normalizedLogoUrl
        },
        program: program || null
      }
    }
  } catch (error) {
    console.error('Public program lookup error:', error)
    return {
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Error al cargar el programa'
    }
  }
}

/**
 * Resolve business by slug for customer registration
 *
 * Stricter than public lookup - requires ACTIVE business AND ACTIVE program
 *
 * @param slug - Business slug
 * @returns Business with active program or null
 */
export async function resolveBusinessForRegistration(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase()

  const business = await prisma.business.findUnique({
    where: { slug: normalizedSlug },
    include: {
      loyaltyPrograms: {
        where: { status: LoyaltyProgramStatus.ACTIVE },
        include: {
          rewardDefinitions: {
            where: { isActive: true }
          }
        },
        take: 1
      }
    }
  })

  return business
}
