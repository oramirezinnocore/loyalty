'use client'

import { FileText, Rocket } from 'lucide-react'
import { ProgramType } from '@prisma/client'

interface PublishOptionsProps {
  programType: ProgramType
  selected: string
  onChange: (option: string) => void
  error?: string
}

export function PublishOptions({ programType, selected, onChange, error }: PublishOptionsProps) {
  const getPublishText = () => {
    switch (programType) {
      case ProgramType.VISITS:
        return 'Los clientes podrán registrarse y acumular visitas.'
      case ProgramType.PURCHASES:
        return 'Los clientes podrán registrarse y acumular compras.'
      case ProgramType.STREAK:
        return 'Los clientes podrán registrarse y comenzar su racha.'
      case ProgramType.POINTS:
        return 'Los clientes podrán registrarse y acumular puntos.'
      default:
        return 'Los clientes podrán registrarse y participar.'
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          6. ¿Qué quieres hacer con el programa?
        </h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Draft Option */}
        <button
          type="button"
          onClick={() => onChange('draft')}
          className={`
            relative p-4 rounded-lg border-2 text-left transition-all h-[100px] flex flex-col
            ${selected === 'draft'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div className="flex items-start gap-3 flex-1">
            {/* Icon */}
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center shrink-0
              ${selected === 'draft' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
            `}>
              <FileText className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Guardar como borrador</h3>
              <p className="text-xs text-gray-600 leading-snug">
                Puedes terminar de configurarlo después.
              </p>
            </div>

            {/* Selection Indicator */}
            {selected === 'draft' && (
              <div className="shrink-0">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Publish Option */}
        <button
          type="button"
          onClick={() => onChange('publish')}
          className={`
            relative p-4 rounded-lg border-2 text-left transition-all h-[100px] flex flex-col
            ${selected === 'publish'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div className="flex items-start gap-3 flex-1">
            {/* Icon */}
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center shrink-0
              ${selected === 'publish' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
            `}>
              <Rocket className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Publicar programa</h3>
              <p className="text-xs text-gray-600 leading-snug">
                {getPublishText()}
              </p>
            </div>

            {/* Selection Indicator */}
            {selected === 'publish' && (
              <div className="shrink-0">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
