'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProgramType, LoyaltyProgramStatus } from '@prisma/client'
import { createLoyaltyProgram, updateLoyaltyProgram } from '@/app/actions/loyalty-program'
import { ProgramTypeSelector } from './program-type-selector'
import { GoalConfiguration } from './goal-configuration'
import { RewardDefinition } from './reward-definition'
import { ProgramInformation } from './program-information'
import { AdditionalRules } from './additional-rules'
import { PublishOptions } from './publish-options'
import { CustomerPreview } from './customer-preview'
import { Button } from '@/components/ui/button'

interface ProgramBuilderProps {
  mode: 'create' | 'edit'
  program?: {
    id: string
    name: string
    description: string | null
    publicDescription: string | null
    programType: ProgramType
    pointsRequired: number
    rewardName: string
    rewardDescription: string | null
    termsAndConditions: string | null
    expirationDays: number | null
    status: LoyaltyProgramStatus
  }
  businessName: string
  businessLogoUrl?: string | null
}

export function ProgramBuilder({ mode, program, businessName, businessLogoUrl }: ProgramBuilderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    programType: program?.programType || ProgramType.VISITS,
    goal: program?.pointsRequired || 5,
    rewardName: program?.rewardName || '',
    rewardDescription: program?.rewardDescription || '',
    name: program?.name || '',
    publicDescription: program?.publicDescription || '',
    termsAndConditions: program?.termsAndConditions || '',
    expirationDays: program?.expirationDays || undefined,
    publishOption: program?.status === LoyaltyProgramStatus.ACTIVE ? 'publish' : 'draft'
  })

  const [manuallyEditedDescription, setManuallyEditedDescription] = useState(!!program?.publicDescription)

  // Auto-generate public description if not manually edited
  useEffect(() => {
    if (!manuallyEditedDescription && formData.goal && formData.rewardName) {
      const typeLabel =
        formData.programType === ProgramType.VISITS ? 'visitas' :
        formData.programType === ProgramType.PURCHASES ? 'compras' :
        formData.programType === ProgramType.STREAK ? 'días consecutivos' : 'puntos'

      const autoDescription = `Completa ${formData.goal} ${typeLabel} y recibe ${formData.rewardName}`
      setFormData(prev => ({ ...prev, publicDescription: autoDescription }))
    }
  }, [formData.programType, formData.goal, formData.rewardName, manuallyEditedDescription])

  const handlePublicDescriptionChange = (value: string) => {
    setManuallyEditedDescription(true)
    setFormData(prev => ({ ...prev, publicDescription: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const input = {
      name: formData.name,
      publicDescription: formData.publicDescription,
      programType: formData.programType,
      pointsRequired: formData.goal,
      rewardName: formData.rewardName,
      rewardDescription: formData.rewardDescription || undefined,
      termsAndConditions: formData.termsAndConditions || undefined,
      expirationDays: formData.expirationDays,
      status: formData.publishOption === 'publish' ? LoyaltyProgramStatus.ACTIVE : LoyaltyProgramStatus.DRAFT
    }

    let result
    if (mode === 'create') {
      result = await createLoyaltyProgram(input)
    } else {
      result = await updateLoyaltyProgram(program!.id, input)
    }

    if (!result.success) {
      if (result.fieldErrors) {
        setErrors(result.fieldErrors)
      } else {
        alert(result.error || 'Error al guardar el programa')
      }
      setLoading(false)
      return
    }

    // Success
    router.push('/admin/program')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'create' ? 'Crear programa de lealtad' : 'Editar programa de lealtad'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Configura cómo quieres recompensar a tus clientes.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max pb-2">
            {[
              { num: 1, label: 'Tipo de programa' },
              { num: 2, label: 'Meta' },
              { num: 3, label: 'Recompensa' },
              { num: 4, label: 'Información' },
              { num: 5, label: 'Publicar' }
            ].map((step, idx, arr) => (
              <div key={step.num} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold
                    ${step.num === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {step.num}
                  </div>
                  <span className={`text-sm font-medium ${step.num === 1 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className="w-8 h-px bg-gray-300 mx-3" />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),400px] gap-6">
            {/* Left Column - Unified Builder */}
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {/* Step 1: Program Type */}
              <div className="p-5">
                <ProgramTypeSelector
                  selectedType={formData.programType}
                  onChange={(type) => setFormData(prev => ({ ...prev, programType: type }))}
                  error={errors.programType}
                />
              </div>

              {/* Step 2: Goal */}
              <div className="p-5">
                <GoalConfiguration
                  programType={formData.programType}
                  goal={formData.goal}
                  onChange={(goal) => setFormData(prev => ({ ...prev, goal }))}
                  error={errors.pointsRequired}
                />
              </div>

              {/* Step 3: Reward */}
              <div className="p-5">
                <RewardDefinition
                  rewardName={formData.rewardName}
                  rewardDescription={formData.rewardDescription}
                  onRewardChange={(rewardName) => setFormData(prev => ({ ...prev, rewardName }))}
                  onDescriptionChange={(desc) => setFormData(prev => ({ ...prev, rewardDescription: desc }))}
                  rewardError={errors.rewardName}
                />
              </div>

              {/* Step 4: Program Information */}
              <div className="p-5">
                <ProgramInformation
                  name={formData.name}
                  publicDescription={formData.publicDescription}
                  onNameChange={(name) => setFormData(prev => ({ ...prev, name }))}
                  onDescriptionChange={handlePublicDescriptionChange}
                  nameError={errors.name}
                  descriptionError={errors.publicDescription}
                />
              </div>

              {/* Step 5: Additional Rules */}
              <div className="p-5">
                <AdditionalRules
                  termsAndConditions={formData.termsAndConditions}
                  expirationDays={formData.expirationDays}
                  onTermsChange={(terms) => setFormData(prev => ({ ...prev, termsAndConditions: terms }))}
                  onExpirationChange={(days) => setFormData(prev => ({ ...prev, expirationDays: days }))}
                  expirationError={errors.expirationDays}
                />
              </div>

              {/* Step 6: Publish Options */}
              <div className="p-5">
                <PublishOptions
                  programType={formData.programType}
                  selected={formData.publishOption}
                  onChange={(option) => setFormData(prev => ({ ...prev, publishOption: option }))}
                  error={errors.status}
                />
              </div>

              {/* Action Buttons */}
              <div className="p-5 flex flex-col sm:flex-row justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/program')}
                  disabled={loading}
                  className="sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="sm:w-auto sm:min-w-[180px]"
                >
                  {loading ? 'Guardando...' : mode === 'create' ? 'Crear programa' : 'Guardar cambios'}
                </Button>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <CustomerPreview
                  programType={formData.programType}
                  goal={formData.goal}
                  currentProgress={0}
                  rewardName={formData.rewardName}
                  rewardDescription={formData.rewardDescription}
                  programName={formData.name || 'Programa de lealtad'}
                  publicDescription={formData.publicDescription}
                  businessName={businessName}
                  businessLogoUrl={businessLogoUrl}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
