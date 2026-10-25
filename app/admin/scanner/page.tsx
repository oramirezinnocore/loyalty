'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ScannerPage() {
  const [businessId, setBusinessId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [membership, setMembership] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get business ID from session/context
    // For now, hardcode Cono Churro for demo
    fetch('/api/business').then(res => res.json()).then(data => {
      if (data.businesses && data.businesses.length > 0) {
        setBusinessId(data.businesses[0].id)
      }
    })
  }, [])

  const lookupCustomer = async (token: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/scanner/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, businessId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar cliente')
      }

      setMembership(data.membership)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const registerPurchase = async () => {
    if (!membership) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/transaction/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: membership.id,
          businessId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar compra')
      }

      // Refresh membership data
      await lookupCustomer(membership.publicToken)

      alert(data.reachedGoal
        ? '¡Felicidades! El cliente ha ganado una recompensa'
        : 'Compra registrada exitosamente'
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold">Escáner de clientes</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!membership ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  Escanea el código QR del cliente
                </h2>
                <p className="text-gray-600">
                  O ingresa el código manualmente para desarrollo
                </p>
              </div>

              {/* Manual Entry for Development */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Código de cliente
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ingresa el token del cliente"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                </div>

                <Button
                  onClick={() => lookupCustomer(manualToken)}
                  disabled={!manualToken || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Buscando...' : 'Buscar cliente'}
                </Button>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Customer Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {membership.customer.firstName} {membership.customer.lastName || ''}
                    </h2>
                    <p className="text-gray-600">{membership.customer.phone}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMembership(null)
                      setManualToken('')
                      setError('')
                    }}
                  >
                    Nuevo escaneo
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {membership.currentPoints}/{membership.loyaltyProgram.pointsRequired}
                    </div>
                    <p className="text-gray-700">
                      {membership.loyaltyProgram.pointsRequired - membership.currentPoints > 0
                        ? `Faltan ${membership.loyaltyProgram.pointsRequired - membership.currentPoints} compras para recompensa`
                        : '¡Meta alcanzada!'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Rewards */}
            {membership.earnedRewards && membership.earnedRewards.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Recompensas disponibles</h3>
                  {membership.earnedRewards.map((reward: any) => (
                    <div
                      key={reward.id}
                      className="bg-green-50 border border-green-200 rounded-lg p-4 mb-2"
                    >
                      <p className="font-semibold text-green-800">
                        {reward.rewardDefinition.name}
                      </p>
                      {reward.rewardDefinition.description && (
                        <p className="text-sm text-green-700 mt-1">
                          {reward.rewardDefinition.description}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Recent Transactions */}
            {membership.transactions && membership.transactions.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Últimas transacciones</h3>
                  <div className="space-y-2">
                    {membership.transactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <span className="text-sm">{tx.description}</span>
                        <span className="text-sm font-semibold text-green-600">
                          +{tx.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Register Purchase */}
            <Card>
              <CardContent className="p-6">
                <Button
                  onClick={registerPurchase}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {loading ? 'Registrando...' : 'Registrar compra'}
                </Button>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
