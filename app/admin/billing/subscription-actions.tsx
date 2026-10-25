'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function SubscriptionActions({
  businessId,
  subscription
}: {
  businessId: string
  subscription: any
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const handleCreateSubscription = async () => {
    if (!email) {
      alert('Por favor ingresa tu email')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, payerEmail: email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear suscripción')
      }

      // In production, redirect to Mercado Pago
      if (data.initPoint && data.initPoint.includes('mercadopago')) {
        window.location.href = data.initPoint
      } else {
        // Mock mode - simulate success
        alert('Suscripción creada en modo de desarrollo')
        router.refresh()
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/subscription/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      })

      if (!response.ok) {
        throw new Error('Error al sincronizar')
      }

      alert('Estado sincronizado')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!subscription || !subscription.mpPreapprovalId) {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Activar Suscripción</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email del pagador</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateSubscription} disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Activar Suscripción'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Acciones</h3>
        <div className="space-y-2">
          <Button onClick={handleSync} disabled={loading} variant="outline" className="w-full">
            {loading ? 'Sincronizando...' : 'Sincronizar Estado'}
          </Button>

          {subscription.status === 'PAST_DUE' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Tu pago está pendiente. Por favor actualiza tu método de pago en Mercado Pago.
              </p>
            </div>
          )}

          {subscription.status === 'SUSPENDED' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                Tu suscripción está suspendida. Contacta a soporte para reactivarla.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
