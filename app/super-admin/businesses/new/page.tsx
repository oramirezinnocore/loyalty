'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { createBusiness } from '@/app/actions/business'

// Client-side slug generation function
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
}

export default function NewBusinessPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [enableTrial, setEnableTrial] = useState(true)

  // Auto-generate slug from name
  const handleNameChange = (newName: string) => {
    setName(newName)
    // Only auto-generate if slug hasn't been manually edited
    if (slug === '' || slug === generateSlug(name)) {
      setSlug(generateSlug(newName))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setFieldErrors({})

    const result = await createBusiness({
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword,
      status,
      enableTrial
    })

    if (result.success && result.businessId) {
      // Redirect to business detail page
      router.push(`/super-admin/businesses/${result.businessId}`)
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
      setIsSubmitting(false)
    } else if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/super-admin/businesses" className="text-purple-100 hover:underline mb-2 inline-block">
            ← Back to Businesses
          </Link>
          <h1 className="text-2xl font-bold">Create New Business</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Business Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Cono Churro"
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.slug ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="cono-churro"
                  disabled={isSubmitting}
                  required
                />
                <p className="text-gray-500 text-sm mt-1">
                  URL-safe identifier (lowercase, hyphens only)
                </p>
                {fieldErrors.slug && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.slug}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              {/* Trial Subscription */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableTrial"
                  checked={enableTrial}
                  onChange={(e) => setEnableTrial(e.target.checked)}
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                  disabled={isSubmitting}
                />
                <label htmlFor="enableTrial" className="ml-2 block text-sm text-gray-700">
                  Enable 7-day trial (recommended)
                </label>
              </div>

              <hr className="my-6" />

              {/* Admin Name */}
              <div>
                <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Admin Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="adminName"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.adminName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Omar Test"
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.adminName && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.adminName}</p>
                )}
              </div>

              {/* Admin Email */}
              <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Admin Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  id="adminEmail"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.adminEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="admin@conochurro.com"
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.adminEmail && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.adminEmail}</p>
                )}
              </div>

              {/* Admin Password */}
              <div>
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Temporary Password <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  id="adminPassword"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    fieldErrors.adminPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Minimum 12 characters"
                  disabled={isSubmitting}
                  required
                  minLength={12}
                />
                <p className="text-gray-500 text-sm mt-1">
                  Must be at least 12 characters with letters and numbers
                </p>
                {fieldErrors.adminPassword && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.adminPassword}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create Business'}
                </button>
                <Link
                  href="/super-admin/businesses"
                  className="px-4 py-2 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
