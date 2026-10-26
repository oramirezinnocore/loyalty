import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Find business by slug
    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        brandColor: true,
        status: true
      }
    })

    if (!business) {
      return NextResponse.json(
        { error: 'Negocio no encontrado' },
        { status: 404 }
      )
    }

    if (business.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'El programa de lealtad no está disponible temporalmente' },
        { status: 403 }
      )
    }

    // Find active program for THIS business
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        business: { slug },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        publicDescription: true,
        pointsRequired: true,
        rewardDefinitions: {
          where: { isActive: true },
          select: {
            name: true,
            description: true
          }
        }
      }
    })

    // Return business info even if no program (for proper UI state)
    return NextResponse.json({
      business,
      program: program || null
    })
  } catch (error: any) {
    console.error('Program lookup error:', error)
    return NextResponse.json(
      { error: 'Error al cargar el programa' },
      { status: 500 }
    )
  }
}
