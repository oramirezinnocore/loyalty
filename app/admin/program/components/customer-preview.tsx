'use client'

import { ProgramType } from '@prisma/client'
import { QrCode } from 'lucide-react'
import Image from 'next/image'

interface CustomerPreviewProps {
  programType: ProgramType
  goal: number
  currentProgress: number
  reward: string
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
  reward,
  rewardDescription,
  programName,
  publicDescription,
  businessName,
  businessLogoUrl
}: CustomerPreviewProps) {
  // Generate progress indicators
  const renderProgress = () => {
    const circles = []
    for (let i = 0; i < goal; i++) {
      const isFilled = i < currentProgress
      circles.push(
        <div
          key={i}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
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

  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Vista previa para tus clientes
        </h3>
        <p className="text-sm text-gray-600">
          Así se verá tu programa en su monedero.
        </p>
      </div>

      {/* Mobile Preview Container */}
      <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Business Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
            <div className="flex items-center gap-3 mb-2">
              {businessLogoUrl ? (
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden">
                  <Image
                    src={businessLogoUrl}
                    alt={businessName}
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">
                    {businessName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold">{businessName}</p>
                <p className="text-sm opacity-90">{programName}</p>
              </div>
            </div>
          </div>

          {/* Program Content */}
          <div className="p-4">
            {/* Description */}
            {publicDescription && (
              <p className="text-sm text-gray-700 mb-4">
                {publicDescription}
              </p>
            )}

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 uppercase">Progreso</span>
                <span className="text-sm font-semibold text-gray-900">
                  {getProgressLabel()}
                </span>
              </div>

              {/* Progress Indicators */}
              <div className="flex flex-wrap gap-2">
                {renderProgress()}
              </div>
            </div>

            {/* Reward */}
            {reward && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs font-medium text-yellow-900 uppercase mb-1">
                  Tu recompensa
                </p>
                <p className="font-semibold text-yellow-900 mb-1">
                  {reward}
                </p>
                {rewardDescription && (
                  <p className="text-sm text-yellow-800">
                    {rewardDescription}
                  </p>
                )}
              </div>
            )}

            {/* QR Code Representation */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-gray-600 uppercase mb-2">
                Mi código de cliente
              </p>
              <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
                <QrCode className="w-16 h-16 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
