import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/authorization'
import { BusinessStatus } from '@prisma/client'

export async function GET() {
  try {
    await requireSuperAdmin()

    const [
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      totalCustomers
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { status: BusinessStatus.ACTIVE } }),
      prisma.business.count({ where: { status: BusinessStatus.SUSPENDED } }),
      prisma.customer.count()
    ])

    return NextResponse.json({
      stats: {
        totalBusinesses,
        activeBusinesses,
        suspendedBusinesses,
        totalCustomers
      }
    })
  } catch (error: any) {
    console.error('Super admin stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: 403 }
    )
  }
}
