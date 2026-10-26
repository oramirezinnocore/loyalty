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

    // Find active program
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        business: { slug },
        status: 'ACTIVE'
      },
      select: {
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

    if (!program) {
      return NextResponse.json(
        { error: 'No hay programa activo configurado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      business,
      program
    })
  } catch (error: any) {
    console.error('Program lookup error:', error)
    return NextResponse.json(
      { error: 'Error al cargar el programa' },
      { status: 500 }
    )
  }
}
