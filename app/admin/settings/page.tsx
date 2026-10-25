import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import SettingsForm from './settings-form'

export const instant = false

export default async function SettingsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user as any
  const businesses = await getUserBusinesses(user.id, user.role)

  if (businesses.length === 0) {
    redirect('/admin')
  }

  const business = businesses[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold">Configuración del negocio</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Marca y apariencia</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm business={business} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
