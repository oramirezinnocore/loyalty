'use client'

interface ProgramInformationProps {
  name: string
  publicDescription: string
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  nameError?: string
  descriptionError?: string
}

export function ProgramInformation({
  name,
  publicDescription,
  onNameChange,
  onDescriptionChange,
  nameError,
  descriptionError
}: ProgramInformationProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          4. Información que verá tu cliente
        </h2>
      </div>

      {/* Program Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre del programa *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ej: Cliente Frecuente Cono Churro"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {nameError && (
          <p className="mt-1 text-sm text-red-600">{nameError}</p>
        )}
      </div>

      {/* Public Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción pública del programa *
        </label>
        <textarea
          value={publicDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ej: Completa 5 compras y recibe un churro gratis"
          rows={3}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {descriptionError && (
          <p className="mt-1 text-sm text-red-600">{descriptionError}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Esta descripción se mostrará a los clientes en su monedero.
        </p>
      </div>
    </div>
  )
}
