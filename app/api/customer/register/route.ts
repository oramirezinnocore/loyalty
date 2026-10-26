import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatPhone } from '@/lib/utils'
import { canPerformLoyaltyOperations } from '@/lib/billing-enforcement'
import { resolveBusinessForRegistration } from '@/lib/services/public-program'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessSlug, firstName, lastName, phone, termsAccepted } = body

    if (!businessSlug || !firstName || !phone || !termsAccepted) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find business and ACTIVE loyalty program using shared service
    const business = await resolveBusinessForRegistration(businessSlug)

    // CRITICAL: Verify business exists
    if (!business) {
      return NextResponse.json(
        { error: 'Negocio no encontrado' },
        { status: 404 }
      )
    }

    // CRITICAL: Verify business is ACTIVE
    if (business.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'El programa de lealtad no está disponible temporalmente' },
        { status: 403 }
      )
    }

    // CRITICAL: Verify ACTIVE program exists
    if (business.loyaltyPrograms.length === 0) {
      return NextResponse.json(
        { error: 'No hay programa de lealtad activo' },
        { status: 400 }
      )
    }

    const program = business.loyaltyPrograms[0]

    // CRITICAL: Verify program has active reward definitions
    if (program.rewardDefinitions.length === 0) {
      return NextResponse.json(
        { error: 'Programa no configurado correctamente' },
        { status: 400 }
      )
    }

    // Check if business can perform loyalty operations (billing)
    const canOperate = await canPerformLoyaltyOperations(business.id)
    if (!canOperate) {
      return NextResponse.json(
        { error: 'El programa de lealtad no está disponible temporalmente' },
        { status: 503 }
      )
    }

    const normalizedPhone = formatPhone(phone)

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        businessId: business.id,
        phone: normalizedPhone
      },
      include: {
        memberships: {
          where: {
            loyaltyProgramId: program.id,
            isActive: true
          },
          take: 1
        }
      }
    })

    // If customer exists with membership, return existing
    if (existingCustomer && existingCustomer.memberships.length > 0) {
      return NextResponse.json({
        customer: existingCustomer,
        membership: existingCustomer.memberships[0],
        existing: true
      })
    }

    // Create customer if doesn't exist
    const customer = existingCustomer || await prisma.customer.create({
      data: {
        businessId: business.id,
        firstName,
        lastName: lastName || null,
        phone: normalizedPhone
      }
    })

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        customerId: customer.id,
        loyaltyProgramId: program.id,
        currentPoints: 0,
        lifetimePoints: 0
      }
    })

    return NextResponse.json({ customer, membership, existing: false })
  } catch (error) {
    console.error('Customer registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
