'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { QRGenerator } from '@/components/qr-generator'
import GoogleWalletButton from './google-wallet-button'
import AppleWalletButton from './apple-wallet-button'

interface WalletData {
  membership: {
    id: string
    publicToken: string
    currentPoints: number
    lifetimePoints: number
    customer: {
      firstName: string
      lastName: string | null
    }
    loyaltyProgram: {
      name: string
      pointsRequired: number
      business: {
        name: string
        brandColor: string | null
        logoUrl: string | null
      }
      rewardDefinitions: Array<{
        name: string
        description: string | null
      }>
    }
    earnedRewards: Array<{
      id: string
      earnedAt: string
      rewardDefinition: {
        name: string
        description: string | null
      }
    }>
  }
}

export default function WalletPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Token inválido')
      setLoading(false)
      return
    }

    fetch(`/api/wallet/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setData(data)
        }
      })
      .catch(() => setError('Error al cargar tu monedero'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando tu monedero...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">{error || 'Monedero no encontrado'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { membership } = data
  const progress = membership.currentPoints
  const goal = membership.loyaltyProgram.pointsRequired
  const percentage = Math.min((progress / goal) * 100, 100)
  const brandColor = membership.loyaltyProgram.business.brandColor || '#F97316'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="text-white p-6"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)` }}
      >
        <div className="flex items-center gap-4">
          {membership.loyaltyProgram.business.logoUrl && !logoError ? (
            <img
              src={membership.loyaltyProgram.business.logoUrl}
              alt={membership.loyaltyProgram.business.name}
              className="w-16 h-16 object-contain bg-white rounded-lg p-2"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {membership.loyaltyProgram.business.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{membership.loyaltyProgram.business.name}</h1>
            <p className="text-sm opacity-90 mt-1">
              {membership.customer.firstName} {membership.customer.lastName || ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress Card */}
        <Card>
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold" style={{ color: brandColor }}>
                {progress}/{goal}
              </div>
              <p className="text-gray-600 text-sm mt-1">
                {goal - progress > 0
                  ? `${goal - progress} compras para tu próxima recompensa`
                  : '¡Meta alcanzada!'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: brandColor
                }}
              />
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                {membership.loyaltyProgram.name}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Available Rewards */}
        {membership.earnedRewards.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Recompensas disponibles</h3>
              {membership.earnedRewards.map(reward => (
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
                  <p className="text-xs text-green-600 mt-2">
                    Muestra este código al personal para canjear
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Customer QR */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 text-center">Tu código QR</h3>
            <div className="flex justify-center mb-3">
              <QRGenerator value={membership.publicToken} size={200} />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Muestra este código en cada compra para acumular puntos
            </p>
          </CardContent>
        </Card>

        {/* Wallet Buttons */}
        <GoogleWalletButton membershipToken={membership.publicToken} />
        <AppleWalletButton membershipToken={membership.publicToken} />
      </div>
    </div>
  )
}
