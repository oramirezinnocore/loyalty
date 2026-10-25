import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/authorization'
import { BusinessStatus } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()

    const { id } = await params

    const business = await prisma.business.update({
      where: { id },
      data: { status: BusinessStatus.ACTIVE }
    })

    return NextResponse.json({ business })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 403 }
    )
  }
}
