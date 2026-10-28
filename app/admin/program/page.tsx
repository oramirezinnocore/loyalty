import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { QRGenerator } from '@/components/qr-generator'
import { LoyaltyPosterGenerator } from '@/components/loyalty-poster-generator'
import { ProgramLifecycle } from './program-lifecycle'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { normalizeLogoUrl } from '@/lib/utils/logo-url'

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

  // Fetch ACTIVE program
  const activeProgram = await prisma.loyaltyProgram.findFirst({
    where: {
      businessId: business.id,
      status: 'ACTIVE'
    },
    include: {
      rewardDefinitions: {
        where: { isActive: true }
      },
      _count: {
        select: {
          memberships: true
        }
      }
    }
  })

  // Fetch historical programs (PAUSED or ARCHIVED)
  const historicalPrograms = await prisma.loyaltyProgram.findMany({
    where: {
      businessId: business.id,
      status: {
        in: ['PAUSED', 'ARCHIVED']
      }
    },
    include: {
      rewardDefinitions: {
        where: { isActive: true }
      },
      _count: {
        select: {
          memberships: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  const acquisitionUrl = `${process.env.NEXTAUTH_URL}/join/${business.slug}`

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      ARCHIVED: 'bg-gray-100 text-gray-800'
    }
    const labels: Record<string, string> = {
      ACTIVE: 'ACTIVO',
      PAUSED: 'PAUSADO',
      ARCHIVED: 'FINALIZADO'
    }
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

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
        {/* Current ACTIVE Program */}
        {activeProgram ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">{activeProgram.name}</CardTitle>
                    {statusBadge(activeProgram.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-700">{activeProgram.publicDescription}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Meta</label>
                      <p className="mt-1 text-2xl font-bold text-blue-600">{activeProgram.pointsRequired} compras</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Clientes inscritos</label>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{activeProgram._count.memberships}</p>
                    </div>
                  </div>

                  {activeProgram.rewardDefinitions.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">Recompensa</label>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="font-semibold text-orange-900">
                          {activeProgram.rewardDefinitions[0].name}
                        </p>
                        {activeProgram.rewardDefinitions[0].description && (
                          <p className="text-sm text-orange-700 mt-1">
                            {activeProgram.rewardDefinitions[0].description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <ProgramLifecycle
                      programId={activeProgram.id}
                      status={activeProgram.status}
                      hasMemberships={activeProgram._count.memberships > 0}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Code - Only for ACTIVE programs */}
            <Card>
              <CardHeader>
                <CardTitle>Material promocional</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-6">
                  Los clientes pueden escanear este código para unirse al programa
                </p>

                <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6 flex flex-col items-center">
                  <QRGenerator value={acquisitionUrl} size={256} />
                  <p className="mt-4 text-sm text-gray-600 text-center break-all">
                    {acquisitionUrl}
                  </p>
                </div>

                <LoyaltyPosterGenerator
                  data={{
                    businessName: business.name,
                    businessSlug: business.slug,
                    logoUrl: normalizeLogoUrl(business.logoUrl, business.id),
                    brandColor: business.brandColor || '#6B7280',
                    programType: activeProgram.programType,
                    goal: activeProgram.pointsRequired,
                    rewardName: activeProgram.rewardDefinitions[0]?.name || 'Recompensa especial',
                    publicDescription: activeProgram.publicDescription,
                    acquisitionUrl
                  }}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 text-lg mb-4">No hay programa de lealtad activo</p>
              <Link
                href="/admin/program/new"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Crear programa de lealtad
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Historical Programs */}
        {historicalPrograms.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Historial de programas</h2>
            <div className="space-y-3">
              {historicalPrograms.map((program) => (
                <Card key={program.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{program.name}</h3>
                          {statusBadge(program.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{program.publicDescription}</p>
                        <div className="text-sm text-gray-500">
                          <span>Meta: {program.pointsRequired} compras</span>
                          <span className="mx-2">•</span>
                          <span>Clientes: {program._count.memberships}</span>
                          {program.rewardDefinitions[0] && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Recompensa: {program.rewardDefinitions[0].name}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          Creado: {new Date(program.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="ml-4">
                        <ProgramLifecycle
                          programId={program.id}
                          status={program.status}
                          hasMemberships={program._count.memberships > 0}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Create New Program Button */}
        {(activeProgram || historicalPrograms.length > 0) && (
          <div className="pt-4 border-t">
            <Link href="/admin/program/new">
              <Button variant="outline" className="w-full">
                + Crear nuevo programa
              </Button>
            </Link>
            {activeProgram && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Nota: Pausa o finaliza el programa actual antes de activar otro
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
