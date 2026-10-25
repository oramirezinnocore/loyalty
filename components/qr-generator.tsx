'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRGeneratorProps {
  value: string
  size?: number
}

export function QRGenerator({ value, size = 256 }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    }
  }, [value, size])

  return <canvas ref={canvasRef} />
}

export function downloadQR(value: string, filename: string) {
  QRCode.toDataURL(value, { width: 512, margin: 2 }, (err: Error | null | undefined, url: string) => {
    if (err) {
      console.error('QR generation error:', err)
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  })
}
