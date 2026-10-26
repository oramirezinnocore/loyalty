import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { QRGenerator, downloadQR } from '@/components/qr-generator'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const instant = false

export default async function ProgramPage() {
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
  const program = await prisma.loyaltyProgram.findFirst({
    where: {
      businessId: business.id,
      status: 'ACTIVE'
    },
    include: {
      rewardDefinitions: {
        where: { isActive: true }
      }
    }
  })

  const acquisitionUrl = `${process.env.NEXTAUTH_URL}/join/${business.slug}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold">Programa de lealtad</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {program ? (
          <>
            {/* Program Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles del programa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <p className="mt-1 text-lg">{program.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Descripción pública</label>
                    <p className="mt-1">{program.publicDescription}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Meta</label>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{program.pointsRequired} compras</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Estado</label>
                      <p className="mt-1">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          {program.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  {program.rewardDefinitions.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Recompensa</label>
                      <div className="mt-1 bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="font-semibold text-orange-900">
                          {program.rewardDefinitions[0].name}
                        </p>
                        {program.rewardDefinitions[0].description && (
                          <p className="text-sm text-orange-700 mt-1">
                            {program.rewardDefinitions[0].description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Acquisition QR */}
            <Card>
              <CardHeader>
                <CardTitle>Código QR de registro</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Los clientes pueden escanear este código para unirse al programa
                </p>

                <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-4 flex flex-col items-center">
                  <QRGenerator value={acquisitionUrl} size={256} />
                  <p className="mt-4 text-sm text-gray-600 text-center break-all">
                    {acquisitionUrl}
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      (window as any).downloadQR?.(acquisitionUrl, `${business.slug}-registro.png`)
                    }
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Descargar QR
                </button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 text-lg mb-4">No hay programa de lealtad configurado</p>
              <Link
                href="/admin/program/new"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Crear programa de lealtad
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
