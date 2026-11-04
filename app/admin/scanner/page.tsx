'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScannerPage() {
  const [businessId, setBusinessId] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [membership, setMembership] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const isInitializingRef = useRef(false)
  const qrCodeRegionId = 'qr-reader'

  useEffect(() => {
    // Get business ID from session/context
    fetch('/api/business')
      .then(async res => {
        if (res.status === 401) {
          // Session expired - redirect to login
          window.location.href = '/auth/signin'
          return null
        }
        if (!res.ok) {
          throw new Error('Error al cargar información del negocio')
        }
        return res.json()
      })
      .then(data => {
        if (data && data.businesses && data.businesses.length > 0) {
          setBusinessId(data.businesses[0].id)
        } else if (data && data.businesses && data.businesses.length === 0) {
          setError('No tienes acceso a ningún negocio. Contacta al administrador.')
        }
      })
      .catch(err => {
        console.error('Business fetch error:', err)
        setError('Error al cargar información del negocio. Por favor, recarga la página.')
      })
  }, [])

  // Cleanup camera on unmount or navigation
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error('Error stopping camera:', err)
      }
      html5QrCodeRef.current = null
    }
    isInitializingRef.current = false
    setCameraActive(false)
  }

  const startCamera = async () => {
    // Prevent double initialization
    if (isInitializingRef.current) {
      console.log('Camera initialization already in progress')
      return
    }

    isInitializingRef.current = true
    setCameraError('')
    setError('')

    try {
      // Verify DOM element exists and is ready
      const element = document.getElementById(qrCodeRegionId)
      if (!element) {
        throw new Error('No se pudo inicializar la cámara. Por favor, recarga la página.')
      }

      // Initialize Html5Qrcode instance
      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      html5QrCodeRef.current = html5QrCode

      // Detect iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

      // iOS Safari: Use facingMode instead of deviceId
      if (isIOS || isSafari) {
        console.log('iOS/Safari detected, using facingMode constraint')

        try {
          await html5QrCode.start(
            { facingMode: "environment" }, // Rear camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              onQRCodeScanned(decodedText)
            },
            (errorMessage) => {
              // QR scan error (expected during normal scanning)
            }
          )

          setCameraActive(true)
          isInitializingRef.current = false
          return
        } catch (facingModeError: any) {
          console.warn('facingMode failed, trying fallback:', facingModeError.name, facingModeError.message)

          // Fallback: try with "user" (front camera)
          try {
            await html5QrCode.start(
              { facingMode: "user" },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
              },
              (decodedText) => {
                onQRCodeScanned(decodedText)
              },
              (errorMessage) => {
                // QR scan error
              }
            )

            setCameraActive(true)
            isInitializingRef.current = false
            return
          } catch (userFacingError: any) {
            console.error('Both facingMode attempts failed:', userFacingError)
            throw facingModeError
          }
        }
      }

      // Desktop/Android: Use deviceId approach
      console.log('Desktop/Android detected, using deviceId approach')

      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        throw new Error('No se detectó ninguna cámara en este dispositivo.')
      }

      // Prefer rear camera
      let cameraId = devices[0].id
      const rearCamera = devices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('trasera')
      )
      if (rearCamera) {
        cameraId = rearCamera.id
      }

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          onQRCodeScanned(decodedText)
        },
        (errorMessage) => {
          // QR scan error
        }
      )

      setCameraActive(true)
      isInitializingRef.current = false
    } catch (err: any) {
      isInitializingRef.current = false

      console.error('Camera initialization error:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      })

      // User-friendly error messages
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setCameraError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.')
      } else if (err.name === 'NotFoundError' || err.message?.includes('detectó')) {
        setCameraError('No se detectó ninguna cámara en este dispositivo.')
      } else if (err.name === 'NotReadableError') {
        setCameraError('La cámara está siendo usada por otra aplicación. Cierra otras aplicaciones y vuelve a intentar.')
      } else if (err.name === 'OverconstrainedError') {
        setCameraError('La cámara no soporta la configuración requerida. Intenta con otro dispositivo.')
      } else if (err.name === 'NotSupportedError') {
        setCameraError('Tu navegador no soporta acceso a la cámara.')
      } else if (err.name === 'SecurityError') {
        setCameraError('Acceso a la cámara bloqueado por seguridad. Verifica que estés usando HTTPS.')
      } else {
        setCameraError('Error al activar la cámara. Usa el ingreso manual como alternativa.')
      }

      await stopCamera()
    }
  }

  const onQRCodeScanned = async (decodedText: string) => {
    // Stop camera immediately
    await stopCamera()

    // Extract token from QR code
    let token = decodedText

    if (decodedText.includes('/wallet/')) {
      const parts = decodedText.split('/wallet/')
      if (parts.length > 1) {
        token = parts[1].split('?')[0].split('#')[0]
      }
    }

    if (token.includes('://')) {
      const url = new URL(token)
      const pathParts = url.pathname.split('/')
      token = pathParts[pathParts.length - 1]
    }

    if (token && token.length >= 20) {
      await lookupCustomer(token)
    } else {
      setError('Código QR inválido. Intenta nuevamente.')
    }
  }

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

  const resetScanner = () => {
    setMembership(null)
    setManualToken('')
    setError('')
    setCameraError('')
    stopCamera()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Escáner de clientes</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {!membership ? (
          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* Title */}
              <div className="text-center mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
                  Escanea el código QR
                </h2>
                <p className="text-sm text-gray-600">
                  Usa la cámara o ingresa el código manualmente
                </p>
              </div>

              {/* QR Scanner Container - ALWAYS in DOM */}
              <div className="mb-4">
                {/* Camera Button or Active State */}
                {!cameraActive ? (
                  <Button
                    onClick={startCamera}
                    disabled={loading}
                    className="w-full py-6 text-base"
                    size="lg"
                  >
                    📷 Activar cámara
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-center text-gray-700 font-medium">
                      Apunta la cámara al código QR del cliente
                    </p>
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      Detener cámara
                    </Button>
                  </div>
                )}

                {/* QR Reader Container - ALWAYS RENDERED */}
                <div
                  id={qrCodeRegionId}
                  className={`mx-auto mt-4 border-2 rounded-lg overflow-hidden transition-all ${
                    cameraActive
                      ? 'border-blue-500 opacity-100'
                      : 'border-transparent opacity-0 h-0'
                  }`}
                  style={{ maxWidth: '400px' }}
                />

                {/* Camera Error */}
                {cameraError && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-300 text-yellow-900 px-4 py-3 rounded-lg">
                    <p className="font-semibold text-sm">Error de cámara</p>
                    <p className="text-sm mt-1">{cameraError}</p>
                  </div>
                )}
              </div>

              {/* Manual Entry */}
              {!cameraActive && (
                <div className="space-y-3">
                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-white text-gray-500 font-medium">
                        O ingresa el código manualmente
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de cliente
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingresa el código del cliente"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={() => lookupCustomer(manualToken)}
                    disabled={!manualToken || loading}
                    className="w-full py-6 text-base"
                    size="lg"
                  >
                    {loading ? 'Buscando...' : 'Buscar cliente'}
                  </Button>

                  {error && (
                    <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-lg">
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Customer Info */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      {membership.customer.firstName} {membership.customer.lastName || ''}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">{membership.customer.phone}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={resetScanner}
                    size="sm"
                  >
                    Nuevo
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-blue-700 mb-1">
                      {membership.currentPoints}/{membership.loyaltyProgram.pointsRequired}
                    </div>
                    <p className="text-sm sm:text-base text-gray-800 font-medium">
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
                <CardContent className="p-4 sm:p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Recompensas disponibles</h3>
                  {membership.earnedRewards.map((reward: any) => (
                    <div
                      key={reward.id}
                      className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2"
                    >
                      <p className="font-semibold text-green-900">
                        {reward.rewardDefinition.name}
                      </p>
                      {reward.rewardDefinition.description && (
                        <p className="text-sm text-green-800 mt-1">
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
                <CardContent className="p-4 sm:p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Últimas transacciones</h3>
                  <div className="space-y-2">
                    {membership.transactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{tx.description}</span>
                        <span className="text-sm font-semibold text-green-700">
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
              <CardContent className="p-4 sm:p-6">
                <Button
                  onClick={registerPurchase}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 py-6 text-base"
                  size="lg"
                >
                  {loading ? 'Registrando...' : 'Registrar compra'}
                </Button>

                {error && (
                  <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-lg mt-4">
                    <p className="text-sm font-medium">{error}</p>
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
