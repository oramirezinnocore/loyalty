import { auth } from "./auth-config"
import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"

export async function getSession() {
  return await auth()
}

export async function requireAuth() {
  const session = await getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function requireSuperAdmin() {
  const session = await requireAuth()
  const user = session.user as any
  if (user.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden: Super Admin access required")
  }
  return session
}

export async function requireBusinessAccess(businessId: string) {
  const session = await requireAuth()
  const user = session.user as any

  // Super admins have access to all businesses
  if (user.role === UserRole.SUPER_ADMIN) {
    return session
  }

  // Business admins must have explicit association
  const businessUser = await prisma.businessUser.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: user.id
      }
    }
  })

  if (!businessUser) {
    throw new Error("Forbidden: No access to this business")
  }

  return session
}

export async function getUserBusinesses(userId: string, role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) {
    return await prisma.business.findMany({
      orderBy: { name: 'asc' }
    })
  }

  const businessUsers = await prisma.businessUser.findMany({
    where: { userId },
    include: { business: true }
  })

  return businessUsers.map(bu => bu.business)
}

export async function canAccessBusiness(userId: string, role: UserRole, businessId: string): Promise<boolean> {
  if (role === UserRole.SUPER_ADMIN) {
    return true
  }

  const businessUser = await prisma.businessUser.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId
      }
    }
  })

  return !!businessUser
}
