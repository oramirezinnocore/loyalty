'use client'

import { ProgramType } from '@prisma/client'
import { QrCode } from 'lucide-react'
import Image from 'next/image'

interface CustomerPreviewProps {
  programType: ProgramType
  goal: number
  currentProgress: number
  rewardName: string
  rewardDescription: string
  programName: string
  publicDescription: string
  businessName: string
  businessLogoUrl?: string | null
}

export function CustomerPreview({
  programType,
  goal,
  currentProgress,
  rewardName,
  rewardDescription,
  programName,
  publicDescription,
  businessName,
  businessLogoUrl
}: CustomerPreviewProps) {
  // Generate progress indicators (limit to 10 for visual clarity)
  const renderProgress = () => {
    const displayGoal = Math.min(goal, 10)
    const circles = []
    for (let i = 0; i < displayGoal; i++) {
      const isFilled = i < currentProgress
      circles.push(
        <div
          key={i}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
            ${isFilled
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500'
            }
          `}
        >
          {isFilled ? '✓' : i + 1}
        </div>
      )
    }
    if (goal > 10) {
      circles.push(
        <div key="more" className="w-8 h-8 flex items-center justify-center text-xs text-gray-500">
          +{goal - 10}
        </div>
      )
    }
    return circles
  }

  const getProgressLabel = () => {
    switch (programType) {
      case ProgramType.VISITS:
        return `${currentProgress} de ${goal} visitas`
      case ProgramType.PURCHASES:
        return `${currentProgress} de ${goal} compras`
      case ProgramType.STREAK:
        return `${currentProgress} de ${goal} días consecutivos`
      case ProgramType.POINTS:
        return `${currentProgress} de ${goal} puntos`
      default:
        return `${currentProgress} de ${goal}`
    }
  }

  const displayProgramName = programName || 'Nombre de tu programa'
  const displayRewardName = rewardName || 'Tu recompensa'
  const displayDescription = publicDescription || 'Descripción de tu programa'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Vista previa para tus clientes
        </h3>
        <p className="text-xs text-gray-600">
          Así se verá tu programa en su monedero.
        </p>
      </div>

      {/* Mobile Preview Container */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Business Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 text-white">
            <div className="flex items-center gap-2">
              {businessLogoUrl ? (
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src={businessLogoUrl}
                    alt={businessName}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-bold text-base">
                    {businessName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{businessName}</p>
                <p className="text-xs opacity-90 truncate">{displayProgramName}</p>
              </div>
            </div>
          </div>

          {/* Program Content */}
          <div className="p-3 space-y-3">
            {/* Description */}
            <p className="text-xs text-gray-700 leading-relaxed">
              {displayDescription}
            </p>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 uppercase">Progreso</span>
                <span className="text-xs font-semibold text-gray-900">
                  {getProgressLabel()}
                </span>
              </div>

              {/* Progress Indicators */}
              <div className="flex flex-wrap gap-1.5">
                {renderProgress()}
              </div>
            </div>

            {/* Reward */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-900 uppercase mb-1">
                🎁 Tu recompensa
              </p>
              <p className="font-semibold text-sm text-yellow-900">
                {displayRewardName}
              </p>
              {rewardDescription && (
                <p className="text-xs text-yellow-800 mt-1">
                  {rewardDescription}
                </p>
              )}
            </div>

            {/* QR Code Representation */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-600 uppercase mb-2">
                Mi código de cliente
              </p>
              <div className="flex items-center justify-center py-3 bg-gray-50 rounded-lg">
                <QrCode className="w-12 h-12 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
