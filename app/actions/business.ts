'use server'

import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/authorization'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { BusinessStatus, SubscriptionStatus, UserRole } from '@prisma/client'

const BCRYPT_ROUNDS = 12
const DEFAULT_TRIAL_DAYS = 7
const DEFAULT_PRICE_MXN = 299

interface CreateBusinessInput {
  name: string
  slug: string
  adminName: string
  adminEmail: string
  adminPassword: string
  status?: BusinessStatus
  enableTrial?: boolean
}

interface CreateBusinessResult {
  success: boolean
  businessId?: string
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Generate URL-safe slug from business name
 * Used internally for slug validation
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove accents/diacritics
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Keep only alphanumeric and hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Limit length
    .substring(0, 100)
}

/**
 * Validate slug format
 */
function validateSlug(slug: string): string | null {
  if (!slug || slug.length === 0) {
    return 'Slug cannot be empty'
  }

  if (slug.length > 100) {
    return 'Slug must be 100 characters or less'
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens'
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return 'Slug cannot start or end with a hyphen'
  }

  if (slug.includes('--')) {
    return 'Slug cannot contain consecutive hyphens'
  }

  return null
}

/**
 * Validate password strength
 */
function validatePassword(password: string): string | null {
  if (!password || password.length < 12) {
    return 'Password must be at least 12 characters'
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasLetter || !hasNumber) {
    return 'Password must contain both letters and numbers'
  }

  return null
}

/**
 * Validate email format
 */
function validateEmail(email: string): string | null {
  if (!email || email.length === 0) {
    return 'Email is required'
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Invalid email format'
  }

  return null
}

/**
 * Create a new business with admin user and trial subscription
 *
 * ATOMIC OPERATION: Creates Business, User, BusinessUser, and Subscription
 * in a single transaction. If any step fails, entire operation rolls back.
 */
export async function createBusiness(
  input: CreateBusinessInput
): Promise<CreateBusinessResult> {
  try {
    // 1. Authorization check
    await requireSuperAdmin()

    // 2. Input validation
    const fieldErrors: Record<string, string> = {}

    if (!input.name || input.name.trim().length === 0) {
      fieldErrors.name = 'Business name is required'
    } else if (input.name.length > 200) {
      fieldErrors.name = 'Business name must be 200 characters or less'
    }

    const slugError = validateSlug(input.slug)
    if (slugError) {
      fieldErrors.slug = slugError
    }

    if (!input.adminName || input.adminName.trim().length === 0) {
      fieldErrors.adminName = 'Admin name is required'
    } else if (input.adminName.length > 200) {
      fieldErrors.adminName = 'Admin name must be 200 characters or less'
    }

    const emailError = validateEmail(input.adminEmail)
    if (emailError) {
      fieldErrors.adminEmail = emailError
    }

    const passwordError = validatePassword(input.adminPassword)
    if (passwordError) {
      fieldErrors.adminPassword = passwordError
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        success: false,
        fieldErrors
      }
    }

    // 3. Normalize inputs
    const normalizedEmail = input.adminEmail.toLowerCase().trim()
    const normalizedSlug = input.slug.toLowerCase().trim()

    // 4. Hash password (outside transaction - expensive operation)
    const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS)

    // 5. Atomic transaction: Create all entities or rollback
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate slug
      const existingBusinessBySlug = await tx.business.findUnique({
        where: { slug: normalizedSlug }
      })

      if (existingBusinessBySlug) {
        throw new Error('DUPLICATE_SLUG')
      }

      // Check for duplicate admin email
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail }
      })

      if (existingUser) {
        throw new Error('DUPLICATE_EMAIL')
      }

      // Create Business
      const business = await tx.business.create({
        data: {
          name: input.name.trim(),
          slug: normalizedSlug,
          status: input.status || BusinessStatus.ACTIVE
        }
      })

      // Create Admin User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: input.adminName.trim(),
          passwordHash,
          role: UserRole.BUSINESS_ADMIN
        }
      })

      // Create BusinessUser relationship
      await tx.businessUser.create({
        data: {
          businessId: business.id,
          userId: user.id
        }
      })

      // Create Subscription (Trial or Active)
      const trialEndDate = input.enableTrial !== false
        ? new Date(Date.now() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000)
        : null

      await tx.subscription.create({
        data: {
          businessId: business.id,
          status: input.enableTrial !== false
            ? SubscriptionStatus.TRIAL
            : SubscriptionStatus.ACTIVE,
          priceMonthlyMXN: DEFAULT_PRICE_MXN,
          trialEndsAt: trialEndDate
        }
      })

      return { businessId: business.id }
    })

    // 6. Revalidate cache
    revalidatePath('/super-admin')
    revalidatePath('/super-admin/businesses')

    return {
      success: true,
      businessId: result.businessId
    }
  } catch (error: any) {
    // Handle known errors
    if (error.message === 'DUPLICATE_SLUG') {
      return {
        success: false,
        fieldErrors: {
          slug: 'This slug is already taken'
        }
      }
    }

    if (error.message === 'DUPLICATE_EMAIL') {
      return {
        success: false,
        fieldErrors: {
          adminEmail: 'This email is already registered'
        }
      }
    }

    if (error.message === 'Forbidden: Super Admin access required') {
      return {
        success: false,
        error: 'Unauthorized: Super Admin access required'
      }
    }

    // Log unexpected errors
    console.error('Business creation failed:', error)

    return {
      success: false,
      error: 'Failed to create business. Please try again.'
    }
  }
}
