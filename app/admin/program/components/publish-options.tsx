'use client'

import { FileText, Rocket } from 'lucide-react'

interface PublishOptionsProps {
  selected: string
  onChange: (option: string) => void
  error?: string
}

export function PublishOptions({ selected, onChange, error }: PublishOptionsProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          6. ¿Qué quieres hacer con el programa?
        </h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Draft Option */}
        <button
          type="button"
          onClick={() => onChange('draft')}
          className={`
            relative p-6 rounded-lg border-2 text-left transition-all
            ${selected === 'draft'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          {/* Selection Indicator */}
          {selected === 'draft' && (
            <div className="absolute top-3 right-3">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}

          {/* Icon */}
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center mb-4
            ${selected === 'draft' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
          `}>
            <FileText className="w-6 h-6" />
          </div>

          {/* Content */}
          <h3 className="font-semibold text-gray-900 mb-1">Guardar como borrador</h3>
          <p className="text-sm text-gray-600">Puedes terminar de configurarlo después.</p>
        </button>

        {/* Publish Option */}
        <button
          type="button"
          onClick={() => onChange('publish')}
          className={`
            relative p-6 rounded-lg border-2 text-left transition-all
            ${selected === 'publish'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          {/* Selection Indicator */}
          {selected === 'publish' && (
            <div className="absolute top-3 right-3">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}

          {/* Icon */}
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center mb-4
            ${selected === 'publish' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
          `}>
            <Rocket className="w-6 h-6" />
          </div>

          {/* Content */}
          <h3 className="font-semibold text-gray-900 mb-1">Publicar programa</h3>
          <p className="text-sm text-gray-600">
            Los clientes podrán comenzar a registrarse y acumular.
          </p>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
