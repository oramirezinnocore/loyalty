'use client'

import { ProgramType } from '@prisma/client'
import { Target } from 'lucide-react'

interface GoalConfigurationProps {
  programType: ProgramType
  goal: number
  onChange: (goal: number) => void
  error?: string
}

export function GoalConfiguration({ programType, goal, onChange, error }: GoalConfigurationProps) {
  const getGoalLabel = () => {
    switch (programType) {
      case ProgramType.VISITS:
        return 'visitas'
      case ProgramType.PURCHASES:
        return 'compras'
      case ProgramType.STREAK:
        return 'días'
      case ProgramType.POINTS:
        return 'puntos'
      default:
        return 'visitas'
    }
  }

  const getQuestion = () => {
    switch (programType) {
      case ProgramType.VISITS:
        return '¿Cuántas visitas necesita realizar el cliente?'
      case ProgramType.PURCHASES:
        return '¿Cuántas compras necesita hacer el cliente?'
      case ProgramType.STREAK:
        return '¿Cuántos días consecutivos debe visitarte el cliente?'
      case ProgramType.POINTS:
        return '¿Cuántos puntos necesita acumular el cliente?'
      default:
        return '¿Cuántas visitas necesita realizar el cliente?'
    }
  }

  const getCallout = () => {
    switch (programType) {
      case ProgramType.VISITS:
        return `🎯 Después de ${goal} ${goal === 1 ? 'visita' : 'visitas'}, el cliente obtiene su recompensa.`
      case ProgramType.PURCHASES:
        return `🎯 Después de ${goal} ${goal === 1 ? 'compra' : 'compras'}, el cliente obtiene su recompensa.`
      case ProgramType.STREAK:
        return `🔥 El cliente debe visitarte ${goal} ${goal === 1 ? 'día consecutivo' : 'días consecutivos'} para obtener su recompensa.`
      case ProgramType.POINTS:
        return `🎯 Después de acumular ${goal} puntos, el cliente obtiene su recompensa.`
      default:
        return ''
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          2. Configura la meta
        </h2>
        <p className="text-sm text-gray-600">
          {getQuestion()}
        </p>
      </div>

      {/* Goal Input */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="100"
            value={goal}
            onChange={(e) => onChange(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 text-base font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 font-medium">{getGoalLabel()}</span>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-900">{getCallout()}</p>
      </div>

      {/* Additional Info for Streak */}
      {programType === ProgramType.STREAK && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-700">
            ℹ️ Si el cliente interrumpe la racha, deberá comenzar nuevamente.
          </p>
        </div>
      )}
    </div>
  )
}
