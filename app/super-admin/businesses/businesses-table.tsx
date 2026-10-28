'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import BusinessActions from './business-actions'

interface Business {
  id: string
  name: string
  slug: string
  status: string
  createdAt: Date
  subscription: {
    status: string
    priceMonthlyMXN: number
    nextBillingDate: Date | null
    trialEndsAt: Date | null
  } | null
  _count: {
    customers: number
    loyaltyPrograms: number
  }
}

export function BusinessesTable({
  businesses,
  initialSearch,
  initialStatus,
  initialBilling
}: {
  businesses: Business[]
  initialSearch: string
  initialStatus: string
  initialBilling: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(initialStatus)
  const [billing, setBilling] = useState(initialBilling)

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (billing) params.set('billing', billing)
    router.push(`/super-admin/businesses${params.toString() ? '?' + params.toString() : ''}`)
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setBilling('')
    router.push('/super-admin/businesses')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="px-3 py-2 border rounded-md"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select
          value={billing}
          onChange={(e) => setBilling(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">All Billing</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELED">Canceled</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={applyFilters}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      {businesses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Business</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Billing</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Customers</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {businesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/businesses/${business.id}`}
                      className="text-purple-600 hover:underline font-medium"
                    >
                      {business.name}
                    </Link>
                    <p className="text-sm text-gray-500">{business.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        business.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {business.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {business.subscription ? (
                      <div>
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {business.subscription.status}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                          ${business.subscription.priceMonthlyMXN} MXN/mes
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No subscription</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{business._count.customers}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{formatDate(business.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <BusinessActions businessId={business.id} currentStatus={business.status as any} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No businesses found</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-purple-600 hover:underline text-sm"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
