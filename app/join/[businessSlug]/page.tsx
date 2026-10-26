'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface BusinessData {
  business: {
    name: string
    slug: string
    brandColor: string | null
    status: string
  }
  program: {
    name: string
    publicDescription: string | null
    pointsRequired: number
    rewardDefinitions: Array<{
      name: string
      description: string | null
    }>
  } | null
}

export default function JoinPage({ params }: { params: { businessSlug: string } }) {
  const router = useRouter()
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    termsAccepted: false
  })

  useEffect(() => {
    // Fetch business and program data
    fetch(`/api/business/${params.businessSlug}/program`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setDataError(data.error)
        } else {
          setBusinessData(data)
        }
      })
      .catch(() => setDataError('Error al cargar el programa'))
      .finally(() => setLoadingData(false))
  }, [params.businessSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug: params.businessSlug,
          ...formData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrarse')
      }

      // Redirect to wallet
      router.push(`/wallet/${data.membership.publicToken}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  // Error state - business not found
  if (dataError || !businessData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">
              {dataError === 'Negocio no encontrado' ? 'Negocio no encontrado' :
               dataError === 'El programa de lealtad no está disponible temporalmente' ? 'Programa no disponible' :
               dataError === 'No hay programa activo configurado' ? 'Sin programa activo' :
               'Error'}
            </h2>
            <p className="text-gray-600">
              {dataError || 'No se pudo cargar la información del programa'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No active program state
  if (!businessData.program) {
    const brandColor = businessData.business.brandColor || '#6B7280'

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div
            className="text-white p-6 rounded-t-lg"
            style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)` }}
          >
            <h1 className="text-2xl font-bold text-center">{businessData.business.name}</h1>
          </div>
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">🎁</div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">
              Programa de lealtad
            </h2>
            <p className="text-gray-600">
              Este negocio aún no tiene un programa de lealtad activo.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Active program state - show registration form
  const brandColor = businessData.business.brandColor || '#F97316'
  const reward = businessData.program.rewardDefinitions[0]
  const programDescription = businessData.program.publicDescription ||
    `Completa ${businessData.program.pointsRequired} compras y recibe ${reward?.name || 'una recompensa'}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div
          className="text-white p-6 rounded-t-lg"
          style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)` }}
        >
          <h1 className="text-2xl font-bold text-center">{businessData.business.name}</h1>
          <p className="text-center mt-2 opacity-90">
            {programDescription}
          </p>
        </div>

        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">¡Únete a nuestro programa!</h2>
            <p className="text-gray-600">
              {programDescription}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Apellido</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Teléfono *</label>
              <input
                type="tel"
                required
                placeholder="+52 55 1234 5678"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="flex items-start">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-1 mr-2"
                checked={formData.termsAccepted}
                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                Acepto los términos y condiciones del programa de lealtad
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`
              }}
              size="lg"
            >
              {loading ? 'Creando tu monedero...' : 'Unirme al programa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
