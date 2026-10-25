import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, requireSuperAdmin } from '@/lib/authorization'
import { BusinessStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireBusinessAccess(id)

    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        loyaltyPrograms: {
          where: { status: 'ACTIVE' },
          include: {
            rewardDefinitions: {
              where: { isActive: true }
            }
          }
        },
        _count: {
          select: {
            customers: true
          }
        }
      }
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business' },
      { status: 403 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireBusinessAccess(id)

    const body = await request.json()
    const { name, brandColor, logoUrl, description } = body

    const business = await prisma.business.update({
      where: { id },
      data: {
        name: name || undefined,
        brandColor: brandColor || undefined,
        logoUrl: logoUrl || undefined,
        description: description || undefined
      }
    })

    return NextResponse.json({ business })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update business' },
      { status: 403 }
    )
  }
}
