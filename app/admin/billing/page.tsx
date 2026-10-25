import { redirect } from 'next/navigation'
import { getSession, getUserBusinesses } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { INTUS_LOYALTY_PLAN } from '@/lib/payments/mercado-pago'
import SubscriptionActions from './subscription-actions'

export const instant = false

export default async function BillingPage() {
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

  const subscription = await prisma.subscription.findUnique({
    where: { businessId: business.id }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold">Facturación y Suscripción</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold">{INTUS_LOYALTY_PLAN.name}</h3>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  ${INTUS_LOYALTY_PLAN.price} {INTUS_LOYALTY_PLAN.currency}
                  <span className="text-lg text-gray-600 font-normal"> / mes</span>
                </p>
              </div>

              {subscription ? (
                <>
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Estado de Suscripción</p>
                        <p className="font-semibold">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                              subscription.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : subscription.status === 'TRIAL'
                                ? 'bg-blue-100 text-blue-800'
                                : subscription.status === 'PAST_DUE'
                                ? 'bg-yellow-100 text-yellow-800'
                                : subscription.status === 'SUSPENDED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {subscription.status}
                          </span>
                        </p>
                      </div>

                      {subscription.nextBillingDate && (
                        <div>
                          <p className="text-sm text-gray-600">Próximo Cobro</p>
                          <p className="font-semibold">{formatDate(subscription.nextBillingDate)}</p>
                        </div>
                      )}

                      {subscription.trialEndsAt && subscription.status === 'TRIAL' && (
                        <div>
                          <p className="text-sm text-gray-600">Fin de Prueba</p>
                          <p className="font-semibold">{formatDate(subscription.trialEndsAt)}</p>
                        </div>
                      )}

                      {subscription.gracePeriodEndsAt && subscription.status === 'PAST_DUE' && (
                        <div>
                          <p className="text-sm text-gray-600">Período de Gracia Termina</p>
                          <p className="font-semibold text-red-600">
                            {formatDate(subscription.gracePeriodEndsAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {subscription.mpPreapprovalId && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600">ID de Suscripción</p>
                      <p className="text-sm font-mono">{subscription.mpPreapprovalId}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="border-t pt-4">
                  <p className="text-gray-600">No hay suscripción activa</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <SubscriptionActions businessId={business.id} subscription={subscription} />

        {/* Information */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Información</h3>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>Tu suscripción se renovará automáticamente cada mes</li>
              <li>Período de prueba: 7 días gratis</li>
              <li>Período de gracia por pagos atrasados: 3 días</li>
              <li>Puedes cancelar en cualquier momento</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
