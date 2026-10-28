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
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          3. Define la recompensa
        </h2>
        <p className="text-sm text-gray-600">
          ¿Qué recibirá el cliente?
        </p>
      </div>

      {/* Reward Name */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Recompensa *
        </label>
        <input
          type="text"
          value={rewardName}
          onChange={(e) => onRewardChange(e.target.value)}
          placeholder="Ej: 1 churro gratis"
          className="w-full h-10 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {rewardError && (
          <p className="mt-1 text-xs text-red-600">{rewardError}</p>
        )}
      </div>

      {/* Reward Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descripción de la recompensa
        </label>
        <textarea
          value={rewardDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ej: Muestra este cupón al personal"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  )
}
