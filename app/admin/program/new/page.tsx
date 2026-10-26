'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { createLoyaltyProgram } from '@/app/actions/loyalty-program'

export default function NewProgramPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publicDescription, setPublicDescription] = useState('')
  const [pointsRequired, setPointsRequired] = useState('5')
  const [rewardName, setRewardName] = useState('')
  const [rewardDescription, setRewardDescription] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setFieldErrors({})

    const result = await createLoyaltyProgram({
      name,
      description: description || undefined,
      publicDescription: publicDescription || undefined,
      pointsRequired: parseInt(pointsRequired, 10),
      rewardName,
      rewardDescription: rewardDescription || undefined,
      status
    })

    if (result.success) {
      // Redirect to program page
      router.push('/admin/program')
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
      setIsSubmitting(false)
    } else if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/admin/program" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Volver a programa
          </Link>
          <h1 className="text-2xl font-bold">Crear programa de lealtad</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Información del programa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Program Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del programa <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Cliente Frecuente Cono Churro"
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Points Required (Goal) */}
              <div>
                <label htmlFor="pointsRequired" className="block text-sm font-medium text-gray-700 mb-1">
                  Meta (número de compras) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  id="pointsRequired"
                  value={pointsRequired}
                  onChange={(e) => setPointsRequired(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.pointsRequired ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="5"
                  min="1"
                  max="100"
                  disabled={isSubmitting}
                  required
                />
                <p className="text-gray-500 text-sm mt-1">
                  Número de compras necesarias para obtener la recompensa
                </p>
                {fieldErrors.pointsRequired && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.pointsRequired}</p>
                )}
              </div>

              {/* Reward Name */}
              <div>
                <label htmlFor="rewardName" className="block text-sm font-medium text-gray-700 mb-1">
                  Recompensa <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="rewardName"
                  value={rewardName}
                  onChange={(e) => setRewardName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.rewardName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1 churro gratis"
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.rewardName && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.rewardName}</p>
                )}
              </div>

              {/* Reward Description */}
              <div>
                <label htmlFor="rewardDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de la recompensa
                </label>
                <textarea
                  id="rewardDescription"
                  value={rewardDescription}
                  onChange={(e) => setRewardDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Muestra este cupón al personal para recibir tu churro gratis"
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>

              {/* Public Description */}
              <div>
                <label htmlFor="publicDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción pública del programa
                </label>
                <textarea
                  id="publicDescription"
                  value={publicDescription}
                  onChange={(e) => setPublicDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Completa 5 compras y recibe un churro gratis"
                  rows={2}
                  disabled={isSubmitting}
                />
                <p className="text-gray-500 text-sm mt-1">
                  Esta descripción se muestra a los clientes en su monedero
                </p>
              </div>

              {/* Internal Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Términos y condiciones (interno)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Términos y condiciones del programa"
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Estado inicial
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE')}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.status ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <option value="ACTIVE">Activo (disponible para clientes)</option>
                  <option value="DRAFT">Borrador (no visible)</option>
                </select>
                {fieldErrors.status && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.status}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creando...' : 'Crear programa'}
                </button>
                <Link
                  href="/admin/program"
                  className="px-4 py-2 border border-gray-300 rounded-md font-medium hover:bg-gray-50 text-center"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Vista previa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
              <h3 className="text-xl font-bold">
                {name || 'Nombre del programa'}
              </h3>
              <p className="mt-2 opacity-90">
                {publicDescription || 'Descripción pública del programa'}
              </p>
              <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm">Meta: <span className="font-bold">{pointsRequired} compras</span></p>
                <p className="text-sm mt-1">Recompensa: <span className="font-bold">{rewardName || 'Recompensa'}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
