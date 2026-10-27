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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'create' ? 'Crear programa de lealtad' : 'Editar programa de lealtad'}
          </h1>
          <p className="mt-2 text-gray-600">
            Configura cómo quieres recompensar a tus clientes.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Program Type */}
              <ProgramTypeSelector
                selectedType={formData.programType}
                onChange={(type) => setFormData(prev => ({ ...prev, programType: type }))}
                error={errors.programType}
              />

              {/* Step 2: Goal */}
              <GoalConfiguration
                programType={formData.programType}
                goal={formData.goal}
                onChange={(goal) => setFormData(prev => ({ ...prev, goal }))}
                error={errors.pointsRequired}
              />

              {/* Step 3: Reward */}
              <RewardDefinition
                rewardName={formData.rewardName}
                rewardDescription={formData.rewardDescription}
                onRewardChange={(rewardName) => setFormData(prev => ({ ...prev, rewardName }))}
                onDescriptionChange={(desc) => setFormData(prev => ({ ...prev, rewardDescription: desc }))}
                rewardError={errors.rewardName}
              />

              {/* Step 4: Program Information */}
              <ProgramInformation
                name={formData.name}
                publicDescription={formData.publicDescription}
                onNameChange={(name) => setFormData(prev => ({ ...prev, name }))}
                onDescriptionChange={handlePublicDescriptionChange}
                nameError={errors.name}
                descriptionError={errors.publicDescription}
              />

              {/* Step 5: Additional Rules */}
              <AdditionalRules
                termsAndConditions={formData.termsAndConditions}
                expirationDays={formData.expirationDays}
                onTermsChange={(terms) => setFormData(prev => ({ ...prev, termsAndConditions: terms }))}
                onExpirationChange={(days) => setFormData(prev => ({ ...prev, expirationDays: days }))}
                expirationError={errors.expirationDays}
              />

              {/* Step 6: Publish Options */}
              <PublishOptions
                selected={formData.publishOption}
                onChange={(option) => setFormData(prev => ({ ...prev, publishOption: option }))}
                error={errors.status}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1" size="lg">
                  {loading ? 'Guardando...' : mode === 'create' ? 'Crear programa' : 'Guardar cambios'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/program')}
                  disabled={loading}
                  size="lg"
                >
                  Cancelar
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
