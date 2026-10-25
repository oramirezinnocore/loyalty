'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function RedeemButton({ rewardId, businessId }: { rewardId: string; businessId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRedeem = async () => {
    if (!confirm('¿Confirmar canje de recompensa?')) return

    setLoading(true)

    try {
      const response = await fetch('/api/reward/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ earnedRewardId: rewardId, businessId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al canjear')
      }

      alert('Recompensa canjeada exitosamente')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleRedeem}
      disabled={loading}
      className="bg-green-600 hover:bg-green-700"
    >
      {loading ? 'Canjeando...' : 'Canjear'}
    </Button>
  )
}
