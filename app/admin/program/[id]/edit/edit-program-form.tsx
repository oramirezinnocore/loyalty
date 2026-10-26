'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateLoyaltyProgram } from '@/app/actions/loyalty-program'

interface EditProgramFormProps {
  program: {
    id: string
    name: string
    description: string
    publicDescription: string
    pointsRequired: number
    rewardName: string
    rewardDescription: string
  }
}

export function EditProgramForm({ program }: EditProgramFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    name: program.name,
    description: program.description,
    publicDescription: program.publicDescription,
    pointsRequired: program.pointsRequired,
    rewardName: program.rewardName,
    rewardDescription: program.rewardDescription
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const result = await updateLoyaltyProgram(program.id, formData)

    if (!result.success) {
      if (result.fieldErrors) {
        setErrors(result.fieldErrors)
      } else {
        alert(result.error || 'Error al actualizar el programa')
      }
      setLoading(false)
      return
    }

    // Success
    router.push('/admin/program')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg border p-6">
      <div>
        <label className="block text-sm font-medium mb-1">
          Nombre del programa *
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        {errors.name && (
          <p className="text-sm text-red-600 mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Descripción pública *
        </label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg"
          rows={3}
          placeholder="Esta descripción será visible para los clientes"
          value={formData.publicDescription}
          onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
        />
        {errors.publicDescription && (
          <p className="text-sm text-red-600 mt-1">{errors.publicDescription}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Descripción interna (opcional)
        </label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg"
          rows={2}
          placeholder="Notas internas (no visible para clientes)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Meta (número de compras) *
        </label>
        <input
          type="number"
          min="1"
          max="100"
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.pointsRequired}
          onChange={(e) => setFormData({ ...formData, pointsRequired: parseInt(e.target.value) || 0 })}
        />
        {errors.pointsRequired && (
          <p className="text-sm text-red-600 mt-1">{errors.pointsRequired}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Número de compras necesarias para ganar la recompensa
        </p>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-4">Recompensa</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre de la recompensa *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ej: 1 churro gratis"
              value={formData.rewardName}
              onChange={(e) => setFormData({ ...formData, rewardName: e.target.value })}
            />
            {errors.rewardName && (
              <p className="text-sm text-red-600 mt-1">{errors.rewardName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Descripción de la recompensa (opcional)
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Detalles adicionales de la recompensa"
              value={formData.rewardDescription}
              onChange={(e) => setFormData({ ...formData, rewardDescription: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/program')}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
