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
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          4. Información que verá tu cliente
        </h2>
      </div>

      {/* Program Name */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre del programa *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ej: Cliente Frecuente Cono Churro"
          className="w-full h-10 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {nameError && (
          <p className="mt-1 text-xs text-red-600">{nameError}</p>
        )}
      </div>

      {/* Public Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descripción pública *
        </label>
        <textarea
          value={publicDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ej: Completa 5 compras y recibe un churro gratis"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {descriptionError && (
          <p className="mt-1 text-xs text-red-600">{descriptionError}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Se mostrará en el monedero del cliente
        </p>
      </div>
    </div>
  )
}
