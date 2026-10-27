'use client'

interface AdditionalRulesProps {
  termsAndConditions: string
  expirationDays: number | undefined
  onTermsChange: (terms: string) => void
  onExpirationChange: (days: number | undefined) => void
  expirationError?: string
}

export function AdditionalRules({
  termsAndConditions,
  expirationDays,
  onTermsChange,
  onExpirationChange,
  expirationError
}: AdditionalRulesProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          5. Reglas adicionales
        </h2>
      </div>

      {/* Expiration */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Vigencia del programa
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              checked={!expirationDays}
              onChange={() => onExpirationChange(undefined)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Sin fecha de vencimiento</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={!!expirationDays}
              onChange={() => onExpirationChange(365)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Con vencimiento</span>
          </label>
        </div>

        {expirationDays && (
          <div className="mt-3">
            <label className="block text-sm text-gray-600 mb-1">
              Días de vigencia
            </label>
            <input
              type="number"
              min="1"
              value={expirationDays}
              onChange={(e) => onExpirationChange(parseInt(e.target.value) || undefined)}
              className="w-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {expirationError && (
              <p className="mt-1 text-sm text-red-600">{expirationError}</p>
            )}
          </div>
        )}
      </div>

      {/* Terms and Conditions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Términos y condiciones (opcional)
        </label>
        <textarea
          value={termsAndConditions}
          onChange={(e) => onTermsChange(e.target.value)}
          placeholder="Ej: Válido solo en tienda física. No acumulable con otras promociones."
          rows={4}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Restricciones o condiciones especiales del programa
        </p>
      </div>
    </div>
  )
}
