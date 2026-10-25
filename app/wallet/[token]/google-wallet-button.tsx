'use client'

import { useState } from 'react'

export default function GoogleWalletButton({ membershipToken }: { membershipToken: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAddToWallet = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/wallet/google/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipToken })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 503) {
          setError('Google Wallet no está disponible en este momento')
        } else {
          throw new Error(data.error || 'Error al agregar a Google Wallet')
        }
        return
      }

      // Redirect to Google Wallet save URL
      if (data.saveUrl) {
        window.location.href = data.saveUrl
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleAddToWallet}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Agregando...' : 'Agregar a Google Wallet'}
      </button>
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
