'use client'

import { ProgramType } from '@prisma/client'
import { Coffee, ShoppingBag, Flame, Star } from 'lucide-react'

interface ProgramTypeSelectorProps {
  selectedType: ProgramType
  onChange: (type: ProgramType) => void
  error?: string
}

interface TypeCardProps {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
  badge?: string
}

function TypeCard({ icon, title, description, selected, onClick, disabled, badge }: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-full p-4 rounded-lg border-2 text-left transition-all h-[100px] flex flex-col
        ${selected
          ? 'border-blue-600 bg-blue-50'
          : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }
      `}
    >
      <div className="flex items-start gap-3 flex-1">
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center shrink-0
          ${selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
        `}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{title}</h3>
          <p className="text-xs text-gray-600 leading-snug">{description}</p>
        </div>

        {/* Selection Indicator or Badge */}
        <div className="shrink-0">
          {selected && (
            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {badge && !selected && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {badge}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function ProgramTypeSelector({ selectedType, onChange, error }: ProgramTypeSelectorProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          1. ¿Cómo quieres premiar a tus clientes?
        </h2>
        <p className="text-sm text-gray-600">
          Selecciona el tipo de programa que mejor se adapte a tu negocio.
        </p>
      </div>

      {/* Type Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TypeCard
          icon={<Coffee className="w-6 h-6" />}
          title="Por visitas"
          description="Después de X visitas recibe un premio."
          selected={selectedType === ProgramType.VISITS}
          onClick={() => onChange(ProgramType.VISITS)}
        />

        <TypeCard
          icon={<ShoppingBag className="w-6 h-6" />}
          title="Por compras"
          description="Después de X compras recibe un premio."
          selected={selectedType === ProgramType.PURCHASES}
          onClick={() => onChange(ProgramType.PURCHASES)}
        />

        <TypeCard
          icon={<Flame className="w-6 h-6" />}
          title="Visitas consecutivas"
          description="Premia al cliente por visitarte X días seguidos."
          selected={selectedType === ProgramType.STREAK}
          onClick={() => onChange(ProgramType.STREAK)}
        />

        <TypeCard
          icon={<Star className="w-6 h-6" />}
          title="Por puntos"
          description="Acumula puntos hasta conseguir recompensas."
          selected={selectedType === ProgramType.POINTS}
          onClick={() => onChange(ProgramType.POINTS)}
          disabled
          badge="Próximamente"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
