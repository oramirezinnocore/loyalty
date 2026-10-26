import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/authorization'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import BusinessActions from '../business-actions'

export const instant = false

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BusinessDetailPage({ params }: PageProps) {
  try {
    await requireSuperAdmin()
  } catch {
    redirect('/auth/signin')
  }

  const { id } = await params

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      subscription: true,
      businessUsers: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true
            }
          }
        }
      },
      _count: {
        select: {
          customers: true,
          loyaltyPrograms: true
        }
      }
    }
  })

  if (!business) {
    notFound()
  }

  const formatCurrency = (amount: number) => `$${amount} MXN`

  // Find primary admin (first BusinessUser with BUSINESS_ADMIN role)
  const primaryAdmin = business.businessUsers.find(
    bu => bu.user.role === 'BUSINESS_ADMIN'
  )?.user

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/super-admin/businesses" className="text-purple-100 hover:underline mb-2 inline-block">
            ← Back to Businesses
          </Link>
          <h1 className="text-2xl font-bold">{business.name}</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Business Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-lg">{business.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Slug</label>
                <p className="text-lg font-mono">{business.slug}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${
                      business.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {business.status}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-lg">{formatDate(business.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Card */}
        {primaryAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Business Administrator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-lg">{primaryAdmin.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg">{primaryAdmin.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Role</label>
                  <p className="text-lg">{primaryAdmin.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-lg">{formatDate(primaryAdmin.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Card */}
        {business.subscription && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p>
                    <span className="inline-block px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {business.subscription.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan</label>
                  <p className="text-lg">{formatCurrency(business.subscription.priceMonthlyMXN)}/mes</p>
                </div>
                {business.subscription.trialEndsAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trial Ends</label>
                    <p className="text-lg">{formatDate(business.subscription.trialEndsAt)}</p>
                  </div>
                )}
                {business.subscription.nextBillingDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Next Billing</label>
                    <p className="text-lg">{formatDate(business.subscription.nextBillingDate)}</p>
                  </div>
                )}
                {business.subscription.mpPreapprovalId && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Mercado Pago Preapproval ID</label>
                    <p className="text-sm font-mono text-gray-600">{business.subscription.mpPreapprovalId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-purple-600">{business._count.customers}</p>
                <p className="text-sm text-gray-600">Customers</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">{business._count.loyaltyPrograms}</p>
                <p className="text-sm text-gray-600">Loyalty Programs</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{business.businessUsers.length}</p>
                <p className="text-sm text-gray-600">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={`/admin?businessId=${business.id}`}
            className="bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700"
          >
            Open Business Dashboard
          </Link>
          <BusinessActions businessId={business.id} currentStatus={business.status} />
        </div>
      </div>
    </div>
  )
}
