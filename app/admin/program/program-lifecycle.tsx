'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateProgramStatus, deleteLoyaltyProgram } from '@/app/actions/loyalty-program'
import { LoyaltyProgramStatus } from '@prisma/client'

interface ProgramLifecycleProps {
  programId: string
  status: string
  hasMemberships: boolean
}

export function ProgramLifecycle({ programId, status, hasMemberships }: ProgramLifecycleProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (newStatus: LoyaltyProgramStatus) => {
    const confirmMessages: Record<string, string> = {
      [LoyaltyProgramStatus.PAUSED]: '¿Pausar el programa? Los clientes no podrán registrarse ni acumular compras mientras esté pausado.',
      [LoyaltyProgramStatus.ARCHIVED]: '¿Finalizar el programa? Esta acción no se puede deshacer. Los clientes no podrán registrarse ni acumular compras. Las recompensas ya ganadas no podrán canjearse.',
      [LoyaltyProgramStatus.ACTIVE]: '¿Reactivar el programa? Los clientes podrán volver a registrarse y acumular compras.'
    }

    if (!confirm(confirmMessages[newStatus])) {
      return
    }

    setLoading(true)

    const result = await updateProgramStatus(programId, newStatus)

    if (!result.success) {
      alert(result.error || 'Error al cambiar el estado')
      setLoading(false)
      return
    }

    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar definitivamente este programa? Esta acción no se puede deshacer.')) {
      return
    }

    setLoading(true)

    const result = await deleteLoyaltyProgram(programId)

    if (!result.success) {
      alert(result.error || 'Error al eliminar el programa')
      setLoading(false)
      return
    }

    router.refresh()
  }

  if (status === 'ARCHIVED') {
    // ARCHIVED programs: show delete button only if no activity
    return (
      <div className="flex gap-2 flex-wrap">
        {!hasMemberships && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="text-red-600 hover:text-red-700"
          >
            Eliminar definitivamente
          </Button>
        )}
      </div>
    )
  }

  if (status === 'PAUSED') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleStatusChange(LoyaltyProgramStatus.ACTIVE)}
          disabled={loading}
        >
          Reactivar programa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(LoyaltyProgramStatus.ARCHIVED)}
          disabled={loading}
        >
          Finalizar programa
        </Button>
      </div>
    )
  }

  if (status === 'ACTIVE') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/admin/program/${programId}/edit`)}
        >
          Editar programa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(LoyaltyProgramStatus.PAUSED)}
          disabled={loading}
        >
          Pausar programa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(LoyaltyProgramStatus.ARCHIVED)}
          disabled={loading}
          className="text-red-600 hover:text-red-700"
        >
          Finalizar programa
        </Button>
      </div>
    )
  }

  return null
}
