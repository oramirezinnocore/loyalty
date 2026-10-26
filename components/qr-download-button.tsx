'use client'

import { downloadQR } from './qr-generator'

interface QRDownloadButtonProps {
  acquisitionUrl: string
  businessSlug: string
}

export function QRDownloadButton({ acquisitionUrl, businessSlug }: QRDownloadButtonProps) {
  const handleDownload = () => {
    downloadQR(acquisitionUrl, `${businessSlug}-registro.png`)
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Descargar QR
    </button>
  )
}
