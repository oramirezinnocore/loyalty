import { NextResponse } from 'next/server'
import { getSession, getUserBusinesses } from '@/lib/authorization'

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businesses = await getUserBusinesses(user.id, user.role)

    return NextResponse.json({ businesses })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch businesses' },
      { status: 500 }
    )
  }
}
