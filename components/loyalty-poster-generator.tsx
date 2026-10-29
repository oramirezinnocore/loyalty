'use client'

import { useState, useRef } from 'react'
import QRCode from 'qrcode'
import { getContrastTextColor } from '@/lib/utils/color'

interface PosterData {
  businessName: string
  businessSlug: string
  logoUrl: string | null
  brandColor: string
  programType: 'VISITS' | 'PURCHASES' | 'STREAK' | 'POINTS'
  goal: number
  rewardName: string
  publicDescription: string | null
  acquisitionUrl: string
}

interface LoyaltyPosterGeneratorProps {
  data: PosterData
}

export function LoyaltyPosterGenerator({ data }: LoyaltyPosterGeneratorProps) {
  const [generatingPoster, setGeneratingPoster] = useState(false)
  const [generatingQR, setGeneratingQR] = useState(false)
  const [posterMode, setPosterMode] = useState<'full' | 'qr'>('full')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getBenefitCopy = () => {
    const typeMap = {
      PURCHASES: `Completa ${data.goal} ${data.goal === 1 ? 'compra' : 'compras'}`,
      VISITS: `Completa ${data.goal} ${data.goal === 1 ? 'visita' : 'visitas'}`,
      STREAK: `Visítanos ${data.goal} ${data.goal === 1 ? 'día consecutivo' : 'días consecutivos'}`,
      POINTS: `Acumula ${data.goal} ${data.goal === 1 ? 'punto' : 'puntos'}`
    }

    return `${typeMap[data.programType]} y recibe\n${data.rewardName}`
  }

  const generateFullPoster = async () => {
    setGeneratingPoster(true)

    try {
      // Create offscreen canvas at high resolution
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // A4 at 300 DPI
      const width = 2480
      const height = 3508
      canvas.width = width
      canvas.height = height

      // White background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      // Brand color setup
      const brandColor = data.brandColor || '#6B7280'
      const textColor = getContrastTextColor(brandColor)

      // Helper to create lighter version of brand color
      const lightenColor = (color: string, percent: number) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)

        const newR = Math.min(255, Math.floor(r + (255 - r) * percent))
        const newG = Math.min(255, Math.floor(g + (255 - g) * percent))
        const newB = Math.min(255, Math.floor(b + (255 - b) * percent))

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
      }

      const lightBrand = lightenColor(brandColor, 0.9)

      // Decorative elements (circles using brand color)
      ctx.fillStyle = lightBrand
      ctx.beginPath()
      ctx.arc(width * 0.15, 200, 180, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(width * 0.85, height * 0.35, 140, 0, Math.PI * 2)
      ctx.fill()

      // Logo section
      let currentY = 280

      if (data.logoUrl) {
        try {
          // Robust logo loading: fetch + blob + objectURL
          // This avoids CORS issues and handles relative URLs correctly
          const logoResponse = await fetch(data.logoUrl)

          if (!logoResponse.ok) {
            throw new Error(`Logo fetch failed: ${logoResponse.status}`)
          }

          const logoBlob = await logoResponse.blob()

          const logoObjectURL = URL.createObjectURL(logoBlob)

          const logo = new Image()

          // Add timeout to prevent infinite hang
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Logo load timeout after 10s'))
            }, 10000)

            logo.onload = () => {
              clearTimeout(timeout)
              resolve(undefined)
            }
            logo.onerror = (err) => {
              clearTimeout(timeout)
              reject(err)
            }
            logo.src = logoObjectURL
          })

          const logoSize = 300

          // White circle background for logo
          ctx.fillStyle = '#FFFFFF'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
          ctx.shadowBlur = 40
          ctx.shadowOffsetY = 10
          ctx.beginPath()
          ctx.arc(width / 2, currentY, logoSize / 2 + 30, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          // Draw logo (contain - preserve aspect ratio)
          const aspectRatio = logo.width / logo.height
          let drawWidth = logoSize
          let drawHeight = logoSize

          if (aspectRatio > 1) {
            drawHeight = logoSize / aspectRatio
          } else {
            drawWidth = logoSize * aspectRatio
          }

          const drawX = (width - drawWidth) / 2
          const drawY = currentY - drawHeight / 2

          ctx.drawImage(
            logo,
            drawX,
            drawY,
            drawWidth,
            drawHeight
          )

          // Clean up object URL
          URL.revokeObjectURL(logoObjectURL)

          currentY += logoSize / 2 + 100
        } catch (error) {
          // Log error for debugging (development only)
          console.error('[Poster] LOGO FAILED:', {
            logoUrl: data.logoUrl,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })

          // Fallback to initial - white circle with shadow
          ctx.fillStyle = '#FFFFFF'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
          ctx.shadowBlur = 40
          ctx.shadowOffsetY = 10
          ctx.beginPath()
          ctx.arc(width / 2, currentY, 150, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.fillStyle = brandColor
          ctx.font = 'bold 180px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(data.businessName.charAt(0).toUpperCase(), width / 2, currentY)

          currentY += 230
        }
      } else {

        // No logo - show initial - white circle with shadow
        ctx.fillStyle = '#FFFFFF'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
        ctx.shadowBlur = 40
        ctx.shadowOffsetY = 10
        ctx.beginPath()
        ctx.arc(width / 2, currentY, 150, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = brandColor
        ctx.font = 'bold 180px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(data.businessName.charAt(0).toUpperCase(), width / 2, currentY)

        currentY += 230
      }

      // Business Name
      ctx.fillStyle = brandColor
      ctx.font = 'bold 140px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(data.businessName, width / 2, currentY)
      currentY += 180

      // Main headline
      ctx.fillStyle = '#1F2937'
      ctx.font = '90px sans-serif'
      ctx.fillText('¡Tus compras ahora tienen recompensa!', width / 2, currentY)
      currentY += 140

      // Subtitle
      ctx.font = '60px sans-serif'
      ctx.fillStyle = '#6B7280'
      ctx.fillText('Escanea el código QR y únete a nuestro', width / 2, currentY)
      currentY += 85
      ctx.fillText('programa de lealtad.', width / 2, currentY)
      currentY += 180

      // Benefit block
      const benefitCopy = getBenefitCopy()
      const benefitLines = benefitCopy.split('\n')

      // Benefit box
      ctx.fillStyle = brandColor
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 10
      const boxHeight = 220
      ctx.roundRect(300, currentY - 50, width - 600, boxHeight, 30)
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = textColor
      ctx.font = 'bold 85px sans-serif'
      ctx.textAlign = 'center'
      let benefitY = currentY + 50
      benefitLines.forEach(line => {
        ctx.fillText(line, width / 2, benefitY)
        benefitY += 95
      })

      currentY += boxHeight + 150

      // QR Code
      const qrSize = 800
      const qrDataUrl = await QRCode.toDataURL(data.acquisitionUrl, {
        width: qrSize,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      const qrImage = new Image()
      await new Promise((resolve) => {
        qrImage.onload = resolve
        qrImage.src = qrDataUrl
      })

      ctx.drawImage(qrImage, (width - qrSize) / 2, currentY, qrSize, qrSize)
      currentY += qrSize + 80

      // QR instruction
      ctx.fillStyle = '#1F2937'
      ctx.font = '65px sans-serif'
      ctx.fillText('📱 Escanea con la cámara de tu celular', width / 2, currentY)
      currentY += 140

      ctx.fillStyle = '#6B7280'
      ctx.font = '55px sans-serif'
      ctx.fillText('Registrarte toma menos de un minuto.', width / 2, currentY)
      currentY += 180

      // Process visual
      ctx.fillStyle = '#1F2937'
      ctx.font = 'bold 65px sans-serif'

      const processItems = ['Compra / Visita', 'Acumula', 'Disfruta recompensas']
      const processY = currentY + 50
      const processSpacing = (width - 400) / (processItems.length - 1)

      processItems.forEach((item, index) => {
        const x = 200 + index * processSpacing

        // Circle
        ctx.fillStyle = index === 0 || index === processItems.length - 1 ? brandColor : lightBrand
        ctx.beginPath()
        ctx.arc(x, processY, 70, 0, Math.PI * 2)
        ctx.fill()

        // Number
        ctx.fillStyle = index === 0 || index === processItems.length - 1 ? textColor : brandColor
        ctx.font = 'bold 75px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText((index + 1).toString(), x, processY + 10)

        // Arrow
        if (index < processItems.length - 1) {
          ctx.fillStyle = '#9CA3AF'
          ctx.font = 'bold 90px sans-serif'
          ctx.fillText('→', x + processSpacing / 2, processY + 10)
        }

        // Label
        ctx.fillStyle = '#1F2937'
        ctx.font = '48px sans-serif'
        const words = item.split(' ')
        words.forEach((word, wi) => {
          ctx.fillText(word, x, processY + 140 + wi * 55)
        })
      })

      // Footer
      currentY = height - 200
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '50px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Programa de lealtad digital · Powered by IntusPath', width / 2, currentY)

      // Download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${data.businessSlug}-programa-lealtad.png`
          link.click()
          URL.revokeObjectURL(url)
        }
        setGeneratingPoster(false)
      }, 'image/png')
    } catch (error) {
      console.error('Poster generation error:', error)
      alert('Error al generar el cartel. Por favor intenta de nuevo.')
      setGeneratingPoster(false)
    }
  }

  const downloadQROnly = async () => {
    setGeneratingQR(true)

    try {
      const qrDataUrl = await QRCode.toDataURL(data.acquisitionUrl, {
        width: 2048,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      const link = document.createElement('a')
      link.href = qrDataUrl
      link.download = `${data.businessSlug}-qr-registro.png`
      link.click()
    } catch (error) {
      console.error('QR generation error:', error)
      alert('Error al generar el código QR. Por favor intenta de nuevo.')
    } finally {
      setGeneratingQR(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Cartel promocional con QR</h3>
        <p className="text-sm text-gray-600">
          Descarga un cartel listo para imprimir o compartir para que más clientes se unan a tu programa de lealtad.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="posterMode"
            value="full"
            checked={posterMode === 'full'}
            onChange={(e) => setPosterMode(e.target.value as 'full')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium">Cartel completo (recomendado)</div>
            <div className="text-sm text-gray-600">
              Incluye logo, mensaje promocional, beneficio y código QR. Ideal para colocar en tu negocio.
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="posterMode"
            value="qr"
            checked={posterMode === 'qr'}
            onChange={(e) => setPosterMode(e.target.value as 'qr')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium">Solo código QR</div>
            <div className="text-sm text-gray-600">
              Descarga únicamente el código QR de registro.
            </div>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {posterMode === 'full' ? (
          <button
            onClick={generateFullPoster}
            disabled={generatingPoster}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPoster ? 'Generando cartel...' : 'Descargar cartel completo'}
          </button>
        ) : (
          <button
            onClick={downloadQROnly}
            disabled={generatingQR}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingQR ? 'Generando QR...' : 'Descargar solo QR'}
          </button>
        )}
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
