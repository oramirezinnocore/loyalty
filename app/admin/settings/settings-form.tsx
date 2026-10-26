'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { uploadLogo } from '@/app/actions/upload-logo'

export default function SettingsForm({ business }: { business: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(business.logoUrl || null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: business.name || '',
    brandColor: business.brandColor || '#FF6B35',
    description: business.description || ''
  })

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError('')
    const file = e.target.files?.[0]

    if (!file) return

    // Validate size
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      setLogoError('Archivo demasiado grande. Máximo 2 MB')
      return
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Formato no permitido. Use PNG, JPG o WebP')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    setLogoFile(file)
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return

    setLogoUploading(true)
    setLogoError('')

    try {
      const formData = new FormData()
      formData.append('logo', logoFile)

      const result = await uploadLogo(business.id, formData)

      if (!result.success) {
        setLogoError(result.error || 'Error al subir logo')
        return
      }

      // Success
      setLogoFile(null)
      router.refresh()
    } catch (error: any) {
      setLogoError(error.message || 'Error al subir logo')
    } finally {
      setLogoUploading(false)
    }
  }

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
    <div className="space-y-6">
      {/* Logo Upload Section */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium mb-2">Logo del negocio</label>

        {/* Current Logo Preview */}
        {logoPreview && (
          <div className="mb-4">
            <img
              src={logoPreview}
              alt="Logo preview"
              className="w-32 h-32 object-contain border rounded-lg bg-gray-50"
            />
          </div>
        )}

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleLogoSelect}
        />

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={logoUploading}
          >
            {logoPreview ? 'Cambiar logo' : 'Seleccionar imagen'}
          </Button>

          <p className="text-xs text-gray-500">
            PNG, JPG o WebP. Máximo 2 MB
          </p>

          {logoError && (
            <p className="text-sm text-red-600">{logoError}</p>
          )}

          {logoFile && (
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleLogoUpload}
                disabled={logoUploading}
                size="sm"
              >
                {logoUploading ? 'Subiendo...' : 'Guardar logo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLogoFile(null)
                  setLogoPreview(business.logoUrl || null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                disabled={logoUploading}
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Business Info Form */}
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  )
}
