'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BusinessStatus } from '@prisma/client'

export default function BusinessActions({
  businessId,
  currentStatus
}: {
  businessId: string
  currentStatus: BusinessStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const toggleStatus = async () => {
    const action = currentStatus === BusinessStatus.ACTIVE ? 'suspend' : 'activate'
    const confirmMessage =
      action === 'suspend'
        ? 'Are you sure you want to suspend this business?'
        : 'Are you sure you want to activate this business?'

    if (!confirm(confirmMessage)) return

    setLoading(true)

    try {
      const response = await fetch(`/api/business/${businessId}/${action}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      alert(`Business ${action}d successfully`)
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={toggleStatus}
      disabled={loading}
      variant={currentStatus === BusinessStatus.ACTIVE ? 'destructive' : 'default'}
      size="sm"
    >
      {loading
        ? 'Processing...'
        : currentStatus === BusinessStatus.ACTIVE
          ? 'Suspend'
          : 'Activate'}
    </Button>
  )
}
