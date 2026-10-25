'use client'

import { useState } from 'react'

export default function AppleWalletButton({ membershipToken }: { membershipToken: string }) {
  const [error, setError] = useState('')

  const handleAddToWallet = () => {
    setError('')

    try {
      // Direct download of .pkpass file
      const url = `/api/wallet/apple/${membershipToken}`
      window.location.href = url
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-2 mt-2">
      <button
        onClick={handleAddToWallet}
        className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800"
      >
        Agregar a Apple Wallet
      </button>
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
