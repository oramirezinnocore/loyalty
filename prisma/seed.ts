import { PrismaClient, UserRole, BusinessStatus, SubscriptionStatus, LoyaltyProgramStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create Super Admin
  const superAdminPassword = 'super-admin-123'
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'super@intus.com' },
    update: {},
    create: {
      email: 'super@intus.com',
      name: 'Super Admin',
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN
    }
  })

  console.log('✅ Created Super Admin:', superAdmin.email)

  // Create Cono Churro Business
  const conoChurro = await prisma.business.upsert({
    where: { slug: 'cono-churro' },
    update: {},
    create: {
      name: 'Cono Churro',
      slug: 'cono-churro',
      status: BusinessStatus.ACTIVE,
      brandColor: '#FF6B35',
      description: 'Churros artesanales deliciosos',
      locations: {
        create: {
          name: 'Cono Churro Centro',
          address: 'Av. Principal 123',
          city: 'Ciudad de México',
          state: 'CDMX',
          postalCode: '01000',
          phone: '+52 55 1234 5678'
        }
      },
      subscription: {
        create: {
          status: SubscriptionStatus.ACTIVE,
          priceMonthlyMXN: 299,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      }
    }
  })

  console.log('✅ Created Business:', conoChurro.name)

  // Create Business Admin for Cono Churro
  const businessAdminPassword = 'admin-123'
  const businessAdminHash = await bcrypt.hash(businessAdminPassword, 10)

  const businessAdmin = await prisma.user.upsert({
    where: { email: 'admin@conochurro.com' },
    update: {},
    create: {
      email: 'admin@conochurro.com',
      name: 'Admin Cono Churro',
      passwordHash: businessAdminHash,
      role: UserRole.BUSINESS_ADMIN,
      businessUsers: {
        create: {
          businessId: conoChurro.id
        }
      }
    }
  })

  console.log('✅ Created Business Admin:', businessAdmin.email)

  // Create Loyalty Program
  const loyaltyProgram = await prisma.loyaltyProgram.create({
    data: {
      businessId: conoChurro.id,
      name: 'Compra 9 churros y recibe el 10 gratis',
      description: 'Programa de lealtad para clientes frecuentes',
      publicDescription: 'En la compra de 9 churros, el décimo va por nuestra cuenta.',
      status: LoyaltyProgramStatus.ACTIVE,
      pointsRequired: 9,
      reward: 'Churro gratis',
      rewardDescription: 'Un churro gratis de cualquier sabor',
      rewardDefinitions: {
        create: {
          name: 'Churro gratis',
          description: 'Un churro gratis de cualquier sabor',
          pointsRequired: 9,
          isActive: true
        }
      }
    }
  })

  console.log('✅ Created Loyalty Program:', loyaltyProgram.name)

  // Create a sample customer with membership and some progress
  const customer = await prisma.customer.create({
    data: {
      businessId: conoChurro.id,
      email: 'cliente@example.com',
      phone: '+52 55 9876 5432',
      firstName: 'María',
      lastName: 'García',
      memberships: {
        create: {
          loyaltyProgramId: loyaltyProgram.id,
          currentPoints: 5,
          lifetimePoints: 5,
          isActive: true,
          lastActivityAt: new Date(),
          transactions: {
            createMany: {
              data: [
                { type: 'PURCHASE', points: 1, description: 'Compra registrada' },
                { type: 'PURCHASE', points: 1, description: 'Compra registrada' },
                { type: 'PURCHASE', points: 1, description: 'Compra registrada' },
                { type: 'PURCHASE', points: 1, description: 'Compra registrada' },
                { type: 'PURCHASE', points: 1, description: 'Compra registrada' }
              ]
            }
          }
        }
      }
    }
  })

  console.log('✅ Created Sample Customer:', customer.email)

  // Create customer at goal for demo
  const customerAtGoal = await prisma.customer.create({
    data: {
      businessId: conoChurro.id,
      phone: '+52 55 1234 9999',
      firstName: 'Juan',
      lastName: 'Pérez',
      memberships: {
        create: {
          loyaltyProgramId: loyaltyProgram.id,
          currentPoints: 9,
          lifetimePoints: 9,
          isActive: true,
          lastActivityAt: new Date()
        }
      }
    }
  })

  console.log('✅ Created Customer at Goal:', customerAtGoal.firstName)

  console.log('\n🎉 Seed completed successfully!')
  console.log('\n📝 Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:')
  console.log(`  Email: ${superAdmin.email}`)
  console.log(`  Password: ${superAdminPassword}`)
  console.log('\nBusiness Admin (Cono Churro):')
  console.log(`  Email: ${businessAdmin.email}`)
  console.log(`  Password: ${businessAdminPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
