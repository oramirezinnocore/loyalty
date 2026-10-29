'use client'

import { useState } from 'react'
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

interface LoyaltyPosterGeneratorDebugProps {
  data: PosterData
}

/**
 * DEBUG VERSION - Tests different scenarios to identify root cause
 */
export function LoyaltyPosterGeneratorDebug({ data }: LoyaltyPosterGeneratorDebugProps) {
  const [generatingPoster, setGeneratingPoster] = useState(false)
  const [testMode, setTestMode] = useState<'normal' | 'green-before' | 'green-after' | 'embedded' | 'force-fallback'>('normal')

  const getBenefitCopy = () => {
    const typeMap = {
      PURCHASES: `Completa ${data.goal} ${data.goal === 1 ? 'compra' : 'compras'}`,
      VISITS: `Completa ${data.goal} ${data.goal === 1 ? 'visita' : 'visitas'}`,
      STREAK: `Visítanos ${data.goal} ${data.goal === 1 ? 'día consecutivo' : 'días consecutivos'}`,
      POINTS: `Acumula ${data.goal} ${data.goal === 1 ? 'punto' : 'puntos'}`
    }
    return `${typeMap[data.programType]} y recibe\n${data.rewardName}`
  }

  const generateDebugPoster = async () => {
    setGeneratingPoster(true)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const width = 2480
      const height = 3508
      canvas.width = width
      canvas.height = height

      // White background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      const brandColor = data.brandColor || '#6B7280'
      const textColor = getContrastTextColor(brandColor)

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

      // Decorative circles
      ctx.fillStyle = lightBrand
      ctx.beginPath()
      ctx.arc(width * 0.15, 200, 180, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(width * 0.85, height * 0.35, 140, 0, Math.PI * 2)
      ctx.fill()

      let currentY = 280

      console.log('[DEBUG] Test mode:', testMode)
      console.log('[DEBUG] logoUrl:', data.logoUrl)
      console.log('[DEBUG] brandColor:', brandColor)
      console.log('[DEBUG] lightBrand:', lightBrand)

      // GREEN DEBUG RECTANGLE BEFORE LOGO SECTION
      if (testMode === 'green-before') {
        console.log('[DEBUG] Drawing GREEN BEFORE marker')
        ctx.fillStyle = '#00FF00'
        ctx.fillRect(1000, 100, 480, 360)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 80px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('GREEN BEFORE', 1240, 300)
      }

      // FORCE FALLBACK TEST
      if (testMode === 'force-fallback') {
        console.log('[DEBUG] FORCE FALLBACK mode')
        ctx.fillStyle = lightBrand
        ctx.beginPath()
        ctx.arc(width / 2, currentY, 150, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = brandColor
        ctx.font = 'bold 180px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(data.businessName.charAt(0).toUpperCase(), width / 2, currentY)

        currentY += 230
        console.log('[DEBUG] Fallback rendered at currentY:', currentY)
      }
      // EMBEDDED IMAGE TEST
      else if (testMode === 'embedded') {
        console.log('[DEBUG] EMBEDDED IMAGE mode')

        // Tiny 1x1 red pixel as base64 PNG
        const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

        const logo = new Image()
        await new Promise((resolve, reject) => {
          logo.onload = resolve
          logo.onerror = reject
          logo.src = testImageData
        })

        console.log('[DEBUG] Embedded image loaded:', logo.width, 'x', logo.height)

        const logoSize = 300

        // White circle
        ctx.fillStyle = '#FFFFFF'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
        ctx.shadowBlur = 40
        ctx.shadowOffsetY = 10
        ctx.beginPath()
        ctx.arc(width / 2, currentY, logoSize / 2 + 30, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Draw embedded image
        ctx.drawImage(logo, 1090, 130, 300, 300)
        console.log('[DEBUG] Embedded image drawn at:', 1090, 130, 300, 300)

        currentY += logoSize / 2 + 100
      }
      // NORMAL LOGO LOAD
      else if (data.logoUrl && testMode === 'normal') {
        try {
          console.log('[DEBUG] NORMAL mode - loading logo from:', data.logoUrl)

          const logoResponse = await fetch(data.logoUrl)
          console.log('[DEBUG] Fetch status:', logoResponse.status, logoResponse.statusText)

          if (!logoResponse.ok) {
            throw new Error(`Logo fetch failed: ${logoResponse.status}`)
          }

          const logoBlob = await logoResponse.blob()
          console.log('[DEBUG] Blob:', logoBlob.type, logoBlob.size, 'bytes')

          const logoObjectURL = URL.createObjectURL(logoBlob)
          const logo = new Image()

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 10000)
            logo.onload = () => { clearTimeout(timeout); resolve(undefined) }
            logo.onerror = (err) => { clearTimeout(timeout); reject(err) }
            logo.src = logoObjectURL
          })

          console.log('[DEBUG] Logo loaded:', logo.width, 'x', logo.height)

          const logoSize = 300

          // White circle
          ctx.fillStyle = '#FFFFFF'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
          ctx.shadowBlur = 40
          ctx.shadowOffsetY = 10
          ctx.beginPath()
          ctx.arc(width / 2, currentY, logoSize / 2 + 30, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

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

          console.log('[DEBUG] Drawing logo at:', drawX, drawY, drawWidth, drawHeight)

          ctx.drawImage(logo, drawX, drawY, drawWidth, drawHeight)
          URL.revokeObjectURL(logoObjectURL)

          currentY += logoSize / 2 + 100
          console.log('[DEBUG] Logo success, new currentY:', currentY)
        } catch (error) {
          console.error('[DEBUG] Logo FAILED:', error)

          // Fallback
          ctx.fillStyle = lightBrand
          ctx.beginPath()
          ctx.arc(width / 2, currentY, 150, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = brandColor
          ctx.font = 'bold 180px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(data.businessName.charAt(0).toUpperCase(), width / 2, currentY)

          currentY += 230
        }
      }

      // GREEN DEBUG RECTANGLE AFTER LOGO SECTION
      if (testMode === 'green-after') {
        console.log('[DEBUG] Drawing GREEN AFTER marker')
        ctx.fillStyle = '#00FF00'
        ctx.fillRect(1000, 100, 480, 360)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 80px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('GREEN AFTER', 1240, 300)
      }

      // Business Name
      console.log('[DEBUG] Drawing business name at currentY:', currentY)
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
        color: { dark: '#000000', light: '#FFFFFF' }
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
        ctx.fillStyle = index === 0 || index === processItems.length - 1 ? brandColor : lightBrand
        ctx.beginPath()
        ctx.arc(x, processY, 70, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = index === 0 || index === processItems.length - 1 ? textColor : brandColor
        ctx.font = 'bold 75px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText((index + 1).toString(), x, processY + 10)

        if (index < processItems.length - 1) {
          ctx.fillStyle = '#9CA3AF'
          ctx.font = 'bold 90px sans-serif'
          ctx.fillText('→', x + processSpacing / 2, processY + 10)
        }

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

      console.log('[DEBUG] Calling toBlob()')

      // Download
      canvas.toBlob((blob) => {
        console.log('[DEBUG] toBlob callback, blob size:', blob?.size)
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${data.businessSlug}-debug-${testMode}.png`
          link.click()
          URL.revokeObjectURL(url)
        }
        setGeneratingPoster(false)
      }, 'image/png')
    } catch (error) {
      console.error('[DEBUG] Poster generation error:', error)
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown'))
      setGeneratingPoster(false)
    }
  }

  return (
    <div className="space-y-6 p-6 border-4 border-red-500">
      <div>
        <h3 className="text-lg font-bold mb-2 text-red-600">DEBUG POSTER GENERATOR</h3>
        <p className="text-sm text-gray-600">
          Test different scenarios to identify logo rendering issue
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="testMode"
            value="normal"
            checked={testMode === 'normal'}
            onChange={(e) => setTestMode(e.target.value as any)}
          />
          <div>
            <div className="font-medium">Normal (real logo)</div>
            <div className="text-sm text-gray-600">Test real logo loading from endpoint</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="testMode"
            value="green-before"
            checked={testMode === 'green-before'}
            onChange={(e) => setTestMode(e.target.value as any)}
          />
          <div>
            <div className="font-medium">Green marker BEFORE logo</div>
            <div className="text-sm text-gray-600">Check if area renders before logo section</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="testMode"
            value="green-after"
            checked={testMode === 'green-after'}
            onChange={(e) => setTestMode(e.target.value as any)}
          />
          <div>
            <div className="font-medium">Green marker AFTER logo</div>
            <div className="text-sm text-gray-600">Check if area renders after logo section</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="testMode"
            value="embedded"
            checked={testMode === 'embedded'}
            onChange={(e) => setTestMode(e.target.value as any)}
          />
          <div>
            <div className="font-medium">Embedded test image</div>
            <div className="text-sm text-gray-600">Use base64 embedded image instead of fetch</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="testMode"
            value="force-fallback"
            checked={testMode === 'force-fallback'}
            onChange={(e) => setTestMode(e.target.value as any)}
          />
          <div>
            <div className="font-medium">Force fallback (initial)</div>
            <div className="text-sm text-gray-600">Skip logo, render fallback circle + letter</div>
          </div>
        </label>
      </div>

      <button
        onClick={generateDebugPoster}
        disabled={generatingPoster}
        className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {generatingPoster ? 'Generating...' : `Generate DEBUG (${testMode})`}
      </button>

      <div className="text-xs text-gray-500">
        Open browser DevTools console to see detailed logs
      </div>
    </div>
  )
}
