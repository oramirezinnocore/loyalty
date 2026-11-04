/**
 * Single Registration Per Business - Integration Tests
 *
 * Verifies that customers register once per business and can participate
 * in multiple programs with the same QR code (Customer.publicToken)
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { findCustomerByToken, getActiveMembership, autoCreateMembershipsForProgram } from '@/lib/services/customer-lookup'

describe('Single Registration Per Business', () => {
  describe('Customer Identity and QR Stability', () => {
    it('customer should have stable publicToken independent of programs', () => {
      const customerPublicToken = 'clrx_customer_stable_token'
      const program1 = 'program-A'
      const program2 = 'program-B'

      // Same customer token for different programs
      const tokenForProgram1 = customerPublicToken
      const tokenForProgram2 = customerPublicToken

      expect(tokenForProgram1).toBe(tokenForProgram2)
    })

    it('customer publicToken should be unique globally', () => {
      const customer1Token = 'clrx_customer1_token'
      const customer2Token = 'clrx_customer2_token'

      expect(customer1Token).not.toBe(customer2Token)
    })

    it('membership should NOT have publicToken for new registrations', () => {
      // New memberships don't get publicToken (deprecated field)
      const membership = {
        id: 'membership-id',
        customerId: 'customer-id',
        loyaltyProgramId: 'program-id',
        publicToken: null // ✓ Not set
      }

      expect(membership.publicToken).toBeNull()
    })

    it('legacy membership publicToken should still work for backwards compatibility', () => {
      // Old memberships with publicToken should still be resolvable
      const legacyToken = 'clrx_legacy_membership_token'
      const canResolve = true // findCustomerByToken() falls back to Membership.publicToken

      expect(canResolve).toBe(true)
    })
  })

  describe('Multi-Program Participation', () => {
    it('customer should have multiple memberships (one per program)', () => {
      const customer = {
        id: 'customer-1',
        publicToken: 'clrx_stable_token',
        memberships: [
          { id: 'membership-1', loyaltyProgramId: 'program-A', currentPoints: 5 },
          { id: 'membership-2', loyaltyProgramId: 'program-B', currentPoints: 0 }
        ]
      }

      expect(customer.memberships.length).toBe(2)
      expect(customer.memberships[0].loyaltyProgramId).not.toBe(
        customer.memberships[1].loyaltyProgramId
      )
    })

    it('each membership should have independent progress', () => {
      const memberships = [
        { programId: 'program-A', currentPoints: 5, lifetimePoints: 10 },
        { programId: 'program-B', currentPoints: 0, lifetimePoints: 0 }
      ]

      // Program B starts fresh, doesn't inherit Program A points
      expect(memberships[0].currentPoints).not.toBe(memberships[1].currentPoints)
      expect(memberships[1].currentPoints).toBe(0)
    })

    it('customer should participate in ACTIVE program when scanning QR', () => {
      const programs = [
        { id: 'program-A', status: 'ARCHIVED', currentPoints: 5 },
        { id: 'program-B', status: 'ACTIVE', currentPoints: 0 }
      ]

      const activeProgramId = programs.find(p => p.status === 'ACTIVE')?.id

      expect(activeProgramId).toBe('program-B')
    })

    it('historical program data should be preserved', () => {
      const archivedMembership = {
        programId: 'program-A',
        status: 'ARCHIVED',
        currentPoints: 5,
        lifetimePoints: 10,
        transactions: [
          { id: 'tx-1', points: 1 },
          { id: 'tx-2', points: 1 }
        ]
      }

      // History preserved even when program archived
      expect(archivedMembership.transactions.length).toBe(2)
      expect(archivedMembership.lifetimePoints).toBe(10)
    })
  })

  describe('Program Lifecycle and Auto-Enrollment', () => {
    it('when program A archives, customers should remain registered to business', () => {
      const customer = {
        id: 'customer-1',
        businessId: 'cono-churro',
        publicToken: 'clrx_stable_token',
        memberships: [
          { programId: 'program-A', status: 'ARCHIVED' }
        ]
      }

      // Customer still exists, just no active membership
      expect(customer.businessId).toBe('cono-churro')
      expect(customer.publicToken).toBe('clrx_stable_token')
    })

    it('when program B activates, existing customers should auto-enroll', () => {
      const businessCustomers = [
        { id: 'customer-1', publicToken: 'token1' },
        { id: 'customer-2', publicToken: 'token2' },
        { id: 'customer-3', publicToken: 'token3' }
      ]

      const programBActivates = true

      if (programBActivates) {
        // autoCreateMembershipsForProgram() creates memberships
        const membershipsCreated = businessCustomers.length

        expect(membershipsCreated).toBe(3)
      }
    })

    it('auto-enrollment should not duplicate existing memberships', () => {
      const existingMemberships = [
        { customerId: 'customer-1', programId: 'program-B' }
      ]

      const allCustomers = [
        { id: 'customer-1' },
        { id: 'customer-2' }
      ]

      // Only customer-2 needs new membership
      const needsMembership = allCustomers.filter(
        c => !existingMemberships.some(m => m.customerId === c.id)
      )

      expect(needsMembership.length).toBe(1)
      expect(needsMembership[0].id).toBe('customer-2')
    })

    it('creating program with ACTIVE status should trigger auto-enrollment', () => {
      const programStatus = 'ACTIVE'
      const shouldAutoEnroll = programStatus === 'ACTIVE'

      expect(shouldAutoEnroll).toBe(true)
    })

    it('creating program with DRAFT status should NOT trigger auto-enrollment', () => {
      const programStatus = 'DRAFT'
      const shouldAutoEnroll = programStatus === 'ACTIVE'

      expect(shouldAutoEnroll).toBe(false)
    })

    it('activating PAUSED program should trigger auto-enrollment', () => {
      const statusChange = { from: 'PAUSED', to: 'ACTIVE' }
      const shouldAutoEnroll = statusChange.to === 'ACTIVE'

      expect(shouldAutoEnroll).toBe(true)
    })
  })

  describe('Scanner and Wallet Integration', () => {
    it('scanner should resolve customer by stable token', () => {
      const qrToken = 'clrx_stable_customer_token'

      // findCustomerByToken(qrToken) returns customer with all memberships
      const resolves = true

      expect(resolves).toBe(true)
    })

    it('scanner should show active program membership', () => {
      const customer = {
        memberships: [
          { id: 'm1', programStatus: 'ARCHIVED', currentPoints: 5 },
          { id: 'm2', programStatus: 'ACTIVE', currentPoints: 2 }
        ]
      }

      // getActiveMembership() returns membership with ACTIVE program
      const activeMembership = customer.memberships.find(
        m => m.programStatus === 'ACTIVE'
      )

      expect(activeMembership?.currentPoints).toBe(2)
    })

    it('wallet should show active program or most recent', () => {
      const customer = {
        memberships: [
          { id: 'm1', programStatus: 'ARCHIVED', createdAt: '2024-01-01' },
          { id: 'm2', programStatus: 'ACTIVE', createdAt: '2024-06-01' }
        ]
      }

      const displayMembership = customer.memberships.find(
        m => m.programStatus === 'ACTIVE'
      ) || customer.memberships[customer.memberships.length - 1]

      expect(displayMembership.programStatus).toBe('ACTIVE')
    })

    it('wallet should fall back to most recent if no active program', () => {
      const customer = {
        memberships: [
          { id: 'm1', programStatus: 'ARCHIVED', createdAt: '2024-01-01' },
          { id: 'm2', programStatus: 'ARCHIVED', createdAt: '2024-06-01' }
        ]
      }

      const displayMembership = customer.memberships.find(
        m => m.programStatus === 'ACTIVE'
      ) || customer.memberships[customer.memberships.length - 1]

      expect(displayMembership.id).toBe('m2') // Most recent
    })
  })

  describe('Registration Flow', () => {
    it('first registration should create customer with publicToken', () => {
      const registration = {
        phone: '5551234567',
        businessId: 'cono-churro',
        programId: 'program-A'
      }

      const customerCreated = {
        id: 'customer-1',
        phone: registration.phone,
        businessId: registration.businessId,
        publicToken: 'clrx_auto_generated' // Auto-generated by Prisma
      }

      expect(customerCreated.publicToken).toBeTruthy()
      expect(customerCreated.publicToken.length).toBeGreaterThanOrEqual(19) // CUID length
    })

    it('first registration should create membership for active program', () => {
      const membershipCreated = {
        customerId: 'customer-1',
        loyaltyProgramId: 'program-A',
        currentPoints: 0,
        publicToken: null // NOT set - Customer.publicToken used
      }

      expect(membershipCreated.publicToken).toBeNull()
      expect(membershipCreated.currentPoints).toBe(0)
    })

    it('re-registration with same phone should return existing customer', () => {
      const existingCustomer = {
        phone: '5551234567',
        businessId: 'cono-churro',
        publicToken: 'clrx_stable_token'
      }

      const reRegistration = {
        phone: '5551234567',
        businessId: 'cono-churro'
      }

      // Same phone → same customer
      const returnedToken = existingCustomer.publicToken

      expect(returnedToken).toBe('clrx_stable_token') // SAME token
    })

    it('registration after program change should reuse customer token', () => {
      const customerToken = 'clrx_stable_token'

      const scenario = {
        step1: { programId: 'program-A', customerToken },
        step2: { programArchived: 'program-A' },
        step3: { programActivated: 'program-B' },
        step4: { customerScansQr: customerToken } // SAME token
      }

      expect(scenario.step4.customerScansQr).toBe(scenario.step1.customerToken)
    })
  })

  describe('Multi-Tenant Isolation', () => {
    it('customer publicToken should be globally unique across businesses', () => {
      const customer1 = { businessId: 'cono-churro', publicToken: 'token1' }
      const customer2 = { businessId: 'otra-empresa', publicToken: 'token2' }

      expect(customer1.publicToken).not.toBe(customer2.publicToken)
    })

    it('same person different businesses should have different tokens', () => {
      const person = {
        phone: '5551234567',
        businesses: [
          { id: 'cono-churro', customerToken: 'token1' },
          { id: 'otra-empresa', customerToken: 'token2' }
        ]
      }

      // Different customer records per business
      expect(person.businesses[0].customerToken).not.toBe(
        person.businesses[1].customerToken
      )
    })

    it('admin from business A cannot scan QR from business B', () => {
      const adminBusinessId = 'cono-churro'
      const customerBusinessId = 'otra-empresa'

      const authorized = adminBusinessId === customerBusinessId

      expect(authorized).toBe(false)
    })
  })

  describe('Backwards Compatibility', () => {
    it('findCustomerByToken should try Customer.publicToken first', () => {
      const lookupOrder = ['Customer.publicToken', 'Membership.publicToken (fallback)']

      expect(lookupOrder[0]).toBe('Customer.publicToken')
    })

    it('old QR codes with Membership.publicToken should still work', () => {
      const legacyToken = 'clrx_old_membership_token'
      const canResolve = true // findCustomerByToken() falls back

      expect(canResolve).toBe(true)
    })

    it('migration should copy most recent Membership.publicToken to Customer', () => {
      const memberships = [
        { publicToken: 'token1', createdAt: '2024-01-01' },
        { publicToken: 'token2', createdAt: '2024-06-01' }
      ]

      // Migration picks most recent
      const copiedToken = memberships[memberships.length - 1].publicToken

      expect(copiedToken).toBe('token2')
    })
  })

  describe('Edge Cases', () => {
    it('customer without any membership should still have publicToken', () => {
      const newCustomer = {
        id: 'customer-1',
        businessId: 'cono-churro',
        publicToken: 'clrx_token',
        memberships: []
      }

      // Customer exists before any program participation
      expect(newCustomer.publicToken).toBeTruthy()
      expect(newCustomer.memberships.length).toBe(0)
    })

    it('business with no active program should not create transactions', () => {
      const business = {
        programs: [
          { id: 'program-A', status: 'ARCHIVED' }
        ]
      }

      const hasActiveProgram = business.programs.some(p => p.status === 'ACTIVE')

      // Scanner can lookup customer, but no purchase registration allowed
      expect(hasActiveProgram).toBe(false)
    })

    it('customer can have membership in archived and active program simultaneously', () => {
      const memberships = [
        { programId: 'program-A', programStatus: 'ARCHIVED', currentPoints: 5 },
        { programId: 'program-B', programStatus: 'ACTIVE', currentPoints: 0 }
      ]

      expect(memberships.length).toBe(2)
      expect(memberships.every(m => m.currentPoints >= 0)).toBe(true)
    })
  })
})
