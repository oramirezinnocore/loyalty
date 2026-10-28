'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { X } from 'lucide-react'
import { getContrastTextColor } from '@/lib/utils/color'

interface BusinessData {
  business: {
    name: string
    slug: string
    brandColor: string | null
    logoUrl: string | null
    status: string
  }
  program: {
    name: string
    publicDescription: string | null
    pointsRequired: number
    programType: string
    termsAndConditions: string | null
    rewardDefinitions: Array<{
      name: string
      description: string | null
    }>
  } | null
}

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const businessSlug = params.businessSlug as string

  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    termsAccepted: false
  })

  useEffect(() => {
    // Next.js 16 Client Components must use useParams() hook, not params prop
    if (!businessSlug) {
      setDataError('Error al cargar el programa')
      setLoadingData(false)
      return
    }

    // Fetch business and program data from public API
    fetch(`/api/public/business/${businessSlug}/program`)
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
  }, [businessSlug])

  // Handle Escape key for modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTermsModal) {
        setShowTermsModal(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showTermsModal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Only require terms acceptance if terms exist
    const hasTerms = businessData?.program?.termsAndConditions
    if (hasTerms && !formData.termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug,
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
    const textColor = getContrastTextColor(brandColor)
    const logoUrl = businessData.business.logoUrl

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div
            className="p-8 rounded-t-lg"
            style={{
              background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
              color: textColor
            }}
          >
            <div className="text-center space-y-4">
              {logoUrl && !logoError ? (
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-white rounded-lg p-2 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt={businessData.business.name}
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: textColor }}>
                      {businessData.business.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <h1 className="text-2xl font-bold">{businessData.business.name}</h1>
            </div>
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
  const textColor = getContrastTextColor(brandColor)
  const logoUrl = businessData.business.logoUrl
  const reward = businessData.program.rewardDefinitions[0]
  const hasTerms = !!businessData.program.termsAndConditions

  // Generate description based on program type
  let programDescription = businessData.program.publicDescription
  if (!programDescription) {
    const typeLabel =
      businessData.program.programType === 'VISITS' ? 'visitas' :
      businessData.program.programType === 'PURCHASES' ? 'compras' :
      businessData.program.programType === 'STREAK' ? 'días consecutivos' : 'puntos'

    programDescription = `Completa ${businessData.program.pointsRequired} ${typeLabel} y recibe ${reward?.name || 'una recompensa'}`
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div
            className="p-8 rounded-t-lg"
            style={{
              background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
              color: textColor
            }}
          >
            <div className="text-center space-y-4">
              {logoUrl && !logoError ? (
                <div className="flex justify-center">
                  <div className="w-24 h-24 bg-white rounded-lg p-2 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt={businessData.business.name}
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-24 h-24 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-4xl font-bold" style={{ color: textColor }}>
                      {businessData.business.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{businessData.business.name}</h1>
                <p className="mt-2 text-sm opacity-90">
                  {programDescription}
                </p>
              </div>
            </div>
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

            {hasTerms && (
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
                  Acepto los{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    términos y condiciones
                  </button>
                </label>
              </div>
            )}

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
                background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
                color: textColor
              }}
              size="lg"
            >
              {loading ? 'Creando tu monedero...' : 'Unirme al programa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>

    {/* Terms Modal */}
    {showTermsModal && hasTerms && (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        onClick={() => setShowTermsModal(false)}
      >
        <div
          className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Términos y condiciones</h2>
            <button
              onClick={() => setShowTermsModal(false)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {businessData.program.termsAndConditions}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              onClick={() => setShowTermsModal(false)}
              variant="outline"
              className="w-full"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
