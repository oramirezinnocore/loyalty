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
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          5. Reglas adicionales
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expiration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Vigencia
          </label>
          <select
            value={expirationDays ? 'with' : 'none'}
            onChange={(e) => {
              if (e.target.value === 'none') {
                onExpirationChange(undefined)
              } else {
                onExpirationChange(365)
              }
            }}
            className="w-full h-10 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">Sin vencimiento</option>
            <option value="with">Con vencimiento</option>
          </select>

          {expirationDays && (
            <div className="mt-2">
              <input
                type="number"
                min="1"
                value={expirationDays}
                onChange={(e) => onExpirationChange(parseInt(e.target.value) || undefined)}
                placeholder="Días"
                className="w-full h-10 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {expirationError && (
                <p className="mt-1 text-xs text-red-600">{expirationError}</p>
              )}
            </div>
          )}
        </div>

        {/* Terms and Conditions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Términos y condiciones
          </label>
          <textarea
            value={termsAndConditions}
            onChange={(e) => onTermsChange(e.target.value)}
            placeholder="Ej: Válido solo en tienda física"
            rows={expirationDays ? 4 : 2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
