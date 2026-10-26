import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import BusinessActions from './business-actions'

export const instant = false

export default async function BusinessesPage() {
  try {
    await requireSuperAdmin()
  } catch {
    redirect('/auth/signin')
  }

  const businesses = await prisma.business.findMany({
    include: {
      subscription: true,
      _count: {
        select: { customers: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const formatCurrency = (amount: number) => `$${amount} MXN`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/super-admin" className="text-purple-100 hover:underline mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Manage Businesses</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Businesses ({businesses.length})</CardTitle>
            <Link
              href="/super-admin/businesses/new"
              className="bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700 text-sm"
            >
              + Create Business
            </Link>
          </CardHeader>
          <CardContent>
            {businesses.length > 0 ? (
              <div className="space-y-3">
                {businesses.map(business => (
                  <Link
                    key={business.id}
                    href={`/super-admin/businesses/${business.id}`}
                    className="flex justify-between items-center p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{business.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            business.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {business.status}
                        </span>
                        {business.subscription && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {business.subscription.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Slug: {business.slug}
                      </p>
                      <p className="text-sm text-gray-600">
                        {business._count.customers} customers • Created {formatDate(business.createdAt)}
                      </p>
                      {business.subscription && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">
                            Plan: {formatCurrency(business.subscription.priceMonthlyMXN)}/mes
                          </span>
                          {business.subscription.mpPreapprovalId && (
                            <span className="text-gray-500 text-xs ml-2">
                              • MP: {business.subscription.mpPreapprovalId.substring(0, 20)}...
                            </span>
                          )}
                          {business.subscription.nextBillingDate && (
                            <span className="text-gray-600 ml-2">
                              • Next: {formatDate(business.subscription.nextBillingDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div onClick={(e) => e.preventDefault()}>
                      <BusinessActions businessId={business.id} currentStatus={business.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">No businesses yet</p>
                <Link
                  href="/super-admin/businesses/new"
                  className="inline-block bg-purple-600 text-white px-6 py-3 rounded-md font-medium hover:bg-purple-700"
                >
                  Create your first business
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
