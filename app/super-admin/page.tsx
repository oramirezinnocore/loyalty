import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/authorization'
import { Card, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { calculateMRR, getSubscriptionCounts } from '@/lib/billing-enforcement'

export const instant = false

export default async function SuperAdminDashboard() {
  try {
    await requireSuperAdmin()
  } catch {
    redirect('/auth/signin')
  }

  const [totalBusinesses, activeBusinesses, suspendedBusinesses, totalCustomers, mrr, subCounts] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: 'ACTIVE' } }),
    prisma.business.count({ where: { status: 'SUSPENDED' } }),
    prisma.customer.count(),
    calculateMRR(),
    getSubscriptionCounts()
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-purple-100 mt-1">IntusPath Loyalty Platform</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-purple-600">{totalBusinesses}</div>
              <p className="text-sm text-gray-600 mt-1">Total Businesses</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-green-600">{activeBusinesses}</div>
              <p className="text-sm text-gray-600 mt-1">Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-red-600">{suspendedBusinesses}</div>
              <p className="text-sm text-gray-600 mt-1">Suspended</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-blue-600">{totalCustomers}</div>
              <p className="text-sm text-gray-600 mt-1">Total Customers</p>
            </CardContent>
          </Card>
        </div>

        {/* Billing Stats */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Billing Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-600">${mrr} MXN</div>
                <p className="text-sm text-gray-600">MRR</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{subCounts.trial}</div>
                <p className="text-sm text-gray-600">Trial</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{subCounts.active}</div>
                <p className="text-sm text-gray-600">Active</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{subCounts.pastDue}</div>
                <p className="text-sm text-gray-600">Past Due</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{subCounts.canceled}</div>
                <p className="text-sm text-gray-600">Canceled</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{subCounts.suspended}</div>
                <p className="text-sm text-gray-600">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/super-admin/businesses">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="text-5xl mb-3">🏢</div>
                <p className="text-xl font-semibold">Manage Businesses</p>
                <p className="text-sm text-gray-600 mt-2">
                  View, create, and manage all businesses
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardContent className="p-6 text-center">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-xl font-semibold">Platform Analytics</p>
              <p className="text-sm text-gray-600 mt-2">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
