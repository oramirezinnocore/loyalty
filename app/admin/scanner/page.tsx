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
    fetch('/api/business').then(res => res.json()).then(data => {
      if (data.businesses && data.businesses.length > 0) {
        setBusinessId(data.businesses[0].id)
      }
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
        throw new Error('Camera container element not found. Please refresh the page.')
      }

      // Initialize Html5Qrcode instance
      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      html5QrCodeRef.current = html5QrCode

      // Detect iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

      // iOS Safari: Use facingMode instead of deviceId
      // This is more reliable on iOS devices
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
              // Don't show these errors to user
            }
          )

          setCameraActive(true)
          isInitializingRef.current = false
          return
        } catch (facingModeError: any) {
          console.warn('facingMode failed, trying fallback:', facingModeError.name, facingModeError.message)

          // Fallback: try with "user" (front camera) if environment fails
          try {
            await html5QrCode.start(
              { facingMode: "user" }, // Front camera
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
          } catch (userFacingError: any) {
            console.error('Both facingMode attempts failed:', userFacingError)
            throw facingModeError // Throw original error for proper handling
          }
        }
      }

      // Desktop/Android: Use deviceId approach
      console.log('Desktop/Android detected, using deviceId approach')

      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        throw new Error('No se detectó ninguna cámara en este dispositivo')
      }

      // Prefer rear camera on mobile devices
      let cameraId = devices[0].id
      const rearCamera = devices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('trasera')
      )
      if (rearCamera) {
        cameraId = rearCamera.id
      }

      // Start scanning with deviceId
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
          // QR scan error (expected during normal scanning)
        }
      )

      setCameraActive(true)
      isInitializingRef.current = false
    } catch (err: any) {
      isInitializingRef.current = false

      // Log full error for debugging
      console.error('Camera initialization error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        constraint: err.constraint
      })

      // User-friendly error messages based on error type
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setCameraError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.')
      } else if (err.name === 'NotFoundError' || err.message?.includes('No se detectó')) {
        setCameraError('No se detectó ninguna cámara en este dispositivo. Usa el ingreso manual.')
      } else if (err.name === 'NotReadableError') {
        setCameraError('La cámara está siendo usada por otra aplicación. Cierra otras aplicaciones y vuelve a intentar.')
      } else if (err.name === 'OverconstrainedError') {
        setCameraError('La cámara no soporta la configuración requerida. Intenta con otro dispositivo o usa el ingreso manual.')
      } else if (err.name === 'NotSupportedError') {
        setCameraError('Tu navegador no soporta acceso a la cámara. Usa el ingreso manual.')
      } else if (err.name === 'SecurityError') {
        setCameraError('Acceso a la cámara bloqueado por seguridad. Verifica que estés usando HTTPS.')
      } else if (err.message?.includes('container element')) {
        setCameraError(err.message)
      } else {
        // Generic error with technical details for reporting
        setCameraError(`Error al activar la cámara (${err.name || 'Error'}). Usa el ingreso manual como alternativa.`)
      }

      await stopCamera()
    }
  }

  const onQRCodeScanned = async (decodedText: string) => {
    // Stop camera immediately to prevent duplicate scans
    await stopCamera()

    // Extract token from QR code
    // QR codes contain the full URL or just the token
    let token = decodedText

    // Handle full URL format (from wallet pages)
    if (decodedText.includes('/wallet/')) {
      const parts = decodedText.split('/wallet/')
      if (parts.length > 1) {
        token = parts[1].split('?')[0].split('#')[0]
      }
    }

    // Handle other URL formats
    if (token.includes('://')) {
      const url = new URL(token)
      const pathParts = url.pathname.split('/')
      token = pathParts[pathParts.length - 1]
    }

    // Validate token format (should be a CUID)
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

  const resetScanner = () => {
    setMembership(null)
    setManualToken('')
    setError('')
    setCameraError('')
    stopCamera()
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
                  Usa la cámara o ingresa el código manualmente
                </p>
              </div>

              {/* QR Scanner */}
              <div className="mb-6">
                {!cameraActive ? (
                  <Button
                    onClick={startCamera}
                    disabled={loading}
                    className="w-full mb-4"
                    size="lg"
                    variant="default"
                  >
                    📷 Activar cámara
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div
                      id={qrCodeRegionId}
                      className="mx-auto border-2 border-blue-500 rounded-lg overflow-hidden"
                      style={{ maxWidth: '500px' }}
                    />
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="w-full"
                    >
                      Cerrar cámara
                    </Button>
                    <p className="text-sm text-center text-gray-600">
                      Apunta la cámara al código QR del cliente
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mt-4">
                    <p className="font-semibold">Error de cámara:</p>
                    <p className="text-sm mt-1">{cameraError}</p>
                  </div>
                )}
              </div>

              {/* Manual Entry */}
              {!cameraActive && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">O ingresa el código manualmente</span>
                    </div>
                  </div>

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
              )}
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
                    onClick={resetScanner}
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
