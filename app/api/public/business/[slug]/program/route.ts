import { NextRequest, NextResponse } from 'next/server'
import { getPublicBusinessProgramBySlug } from '@/lib/services/public-program'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const result = await getPublicBusinessProgramBySlug(slug)

  if (!result.success) {
    const statusCode = result.error === 'BUSINESS_NOT_FOUND' ? 404 :
                       result.error === 'BUSINESS_SUSPENDED' ? 403 : 500

    return NextResponse.json(
      { error: result.message },
      { status: statusCode }
    )
  }

  return NextResponse.json(result.data)
}
