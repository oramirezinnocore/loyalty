'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SettingsForm({ business }: { business: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: business.name || '',
    brandColor: business.brandColor || '#FF6B35',
    logoUrl: business.logoUrl || '',
    description: business.description || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/business/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Error al actualizar')
      }

      alert('Configuración actualizada')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre del negocio</label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Color principal</label>
        <div className="flex gap-2">
          <input
            type="color"
            className="h-10 w-20"
            value={formData.brandColor}
            onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
          />
          <input
            type="text"
            className="flex-1 px-3 py-2 border rounded-lg"
            value={formData.brandColor}
            onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">URL del logo</label>
        <input
          type="url"
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="https://ejemplo.com/logo.png"
          value={formData.logoUrl}
          onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
        />
        <p className="text-xs text-gray-500 mt-1">
          Por ahora ingresa la URL de tu logo. Próximamente podrás subirlo directamente.
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
