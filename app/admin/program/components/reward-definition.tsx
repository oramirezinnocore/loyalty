'use client'

interface RewardDefinitionProps {
  rewardName: string
  rewardDescription: string
  onRewardChange: (rewardName: string) => void
  onDescriptionChange: (description: string) => void
  rewardError?: string
}

export function RewardDefinition({
  rewardName,
  rewardDescription,
  onRewardChange,
  onDescriptionChange,
  rewardError
}: RewardDefinitionProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          3. Define la recompensa
        </h2>
        <p className="text-gray-600">
          ¿Qué recibirá el cliente?
        </p>
      </div>

      {/* Reward Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recompensa *
        </label>
        <input
          type="text"
          value={rewardName}
          onChange={(e) => onRewardChange(e.target.value)}
          placeholder="Ej: 1 churro gratis"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {rewardError && (
          <p className="mt-1 text-sm text-red-600">{rewardError}</p>
        )}
      </div>

      {/* Reward Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción de la recompensa
        </label>
        <textarea
          value={rewardDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ej: Muestra este cupón al personal para recibir tu churro gratis"
          rows={3}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Instrucciones adicionales para canjear la recompensa
        </p>
      </div>
    </div>
  )
}
