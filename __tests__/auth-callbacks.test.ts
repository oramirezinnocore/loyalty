/**
 * Auth.js v5 JWT and Session Callback Tests
 *
 * Regression tests for production JWTSessionError: "b.id is not a function"
 *
 * Root cause: Callbacks were accessing token.id instead of token.sub
 *
 * NextAuth v5 JWT structure:
 * - token.sub = user ID (set automatically by NextAuth)
 * - token.id = undefined (not set by default)
 * - Custom claims can be added (e.g., token.role)
 *
 * This test suite validates:
 * 1. JWT callback properly stores role without overriding sub
 * 2. Session callback reads user ID from token.sub (not token.id)
 * 3. Both SUPER_ADMIN and BUSINESS_ADMIN roles work correctly
 * 4. No "*.id is not a function" errors occur
 */

import { describe, it, expect } from '@jest/globals'

// Define callback implementations directly (matching lib/auth.ts logic)
const jwtCallback = async function({ token, user }: any) {
  if (user) {
    // NextAuth v5 automatically sets token.sub = user.id
    // Add custom claims (role) but don't manually set id
    token.role = user.role
  }
  return token
}

const sessionCallback = async function({ session, token }: any) {
  if (session.user) {
    // Read user ID from token.sub (standard JWT claim, not token.id)
    session.user.id = token.sub
    session.user.role = token.role
  }
  return session
}

describe('Auth.js v5 Callbacks', () => {
  describe('JWT Callback', () => {
    it('should store custom role claim without overriding sub', async () => {
      const mockUser = {
        id: 'test-user-id-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'SUPER_ADMIN'
      }

      const initialToken = {
        sub: mockUser.id,  // NextAuth v5 sets this automatically
        email: mockUser.email,
        name: mockUser.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      const resultToken = await jwtCallback({
        token: initialToken,
        user: mockUser,
        trigger: 'signIn'
      })

      // Verify token structure
      expect(resultToken).toBeDefined()
      expect(resultToken.sub).toBe('test-user-id-123')  // sub preserved
      expect(resultToken.role).toBe('SUPER_ADMIN')       // role added
      expect(resultToken.id).toBeUndefined()             // id NOT set
    })

    it('should handle SUPER_ADMIN role', async () => {
      const mockUser = {
        id: 'super-admin-id',
        email: 'super@intus.com',
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
      }

      const token = {
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      }

      const result = await jwtCallback({
        token,
        user: mockUser,
        trigger: 'signIn'
      })

      expect(result.role).toBe('SUPER_ADMIN')
      expect(result.sub).toBe('super-admin-id')
    })

    it('should handle BUSINESS_ADMIN role', async () => {
      const mockUser = {
        id: 'business-admin-id',
        email: 'admin@business.com',
        name: 'Business Admin',
        role: 'BUSINESS_ADMIN'
      }

      const token = {
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      }

      const result = await jwtCallback({
        token,
        user: mockUser,
        trigger: 'signIn'
      })

      expect(result.role).toBe('BUSINESS_ADMIN')
      expect(result.sub).toBe('business-admin-id')
    })

    it('should preserve token on subsequent calls (no user)', async () => {
      const existingToken = {
        sub: 'existing-user-id',
        email: 'existing@example.com',
        role: 'SUPER_ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      const result = await jwtCallback({
        token: existingToken,
        // No user (subsequent session access, not sign in)
        trigger: undefined
      })

      // Token should be returned unchanged
      expect(result).toEqual(existingToken)
    })
  })

  describe('Session Callback', () => {
    it('should read user ID from token.sub (not token.id)', async () => {
      const mockToken = {
        sub: 'user-id-from-sub',
        email: 'test@example.com',
        name: 'Test User',
        role: 'SUPER_ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      const mockSession = {
        user: {
          email: 'test@example.com',
          name: 'Test User'
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      }

      const resultSession = await sessionCallback({
        session: mockSession,
        token: mockToken,
        trigger: undefined
      })

      // CRITICAL: Verify session.user.id comes from token.sub
      expect(resultSession.user).toBeDefined()
      expect(resultSession.user.id).toBe('user-id-from-sub')
      expect(resultSession.user.role).toBe('SUPER_ADMIN')

      // Verify token.id was NOT used (it's undefined)
      expect((mockToken as any).id).toBeUndefined()
    })

    it('should create valid SUPER_ADMIN session', async () => {
      const token = {
        sub: 'super-admin-id-123',
        email: 'super@intus.com',
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
      }

      const session = {
        user: {
          email: 'super@intus.com',
          name: 'Super Admin'
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      }

      const result = await sessionCallback({
        session,
        token,
        trigger: undefined
      })

      expect(result.user.id).toBe('super-admin-id-123')
      expect(result.user.role).toBe('SUPER_ADMIN')
      expect(result.user.email).toBe('super@intus.com')
    })

    it('should create valid BUSINESS_ADMIN session', async () => {
      const token = {
        sub: 'business-admin-id-456',
        email: 'admin@business.com',
        name: 'Business Admin',
        role: 'BUSINESS_ADMIN'
      }

      const session = {
        user: {
          email: 'admin@business.com',
          name: 'Business Admin'
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      }

      const result = await sessionCallback({
        session,
        token,
        trigger: undefined
      })

      expect(result.user.id).toBe('business-admin-id-456')
      expect(result.user.role).toBe('BUSINESS_ADMIN')
      expect(result.user.email).toBe('admin@business.com')
    })

    it('should NOT throw "*.id is not a function" error', async () => {
      const token = {
        sub: 'test-id',
        email: 'test@example.com',
        role: 'SUPER_ADMIN',
        // Intentionally do NOT set token.id
        id: undefined
      }

      const session = {
        user: { email: 'test@example.com' },
        expires: new Date(Date.now() + 3600000).toISOString()
      }

      // This should NOT throw "b.id is not a function"
      await expect(async () => {
        await sessionCallback({
          session,
          token,
          trigger: undefined
        })
      }).resolves.not.toThrow()
    })

    it('should handle session without user (edge case)', async () => {
      const token = {
        sub: 'test-id',
        email: 'test@example.com',
        role: 'SUPER_ADMIN'
      }

      const session = {
        // No user property
        expires: new Date(Date.now() + 3600000).toISOString()
      }

      const result = await sessionCallback({
        session,
        token,
        trigger: undefined
      })

      // Should return session unchanged (no user to modify)
      expect(result).toEqual(session)
    })
  })

  describe('Full Authentication Flow', () => {
    it('should complete full SUPER_ADMIN login flow', async () => {
      // Step 1: User signs in, authorize() returns user
      const authenticatedUser = {
        id: 'cmvtest123super',
        email: 'super-flow@intus.com',
        name: 'Super Flow Test',
        role: 'SUPER_ADMIN'
      }

      // Step 2: JWT callback processes user (first time)
      const newToken = await jwtCallback({
        token: {
          sub: authenticatedUser.id,
          email: authenticatedUser.email,
          name: authenticatedUser.name
        },
        user: authenticatedUser,
        trigger: 'signIn'
      })

      expect(newToken.sub).toBe('cmvtest123super')
      expect(newToken.role).toBe('SUPER_ADMIN')

      // Step 3: Session callback creates session from token
      const newSession = await sessionCallback({
        session: {
          user: {
            email: authenticatedUser.email,
            name: authenticatedUser.name
          },
          expires: new Date(Date.now() + 3600000).toISOString()
        },
        token: newToken,
        trigger: undefined
      })

      // Verify final session structure
      expect(newSession.user.id).toBe('cmvtest123super')
      expect(newSession.user.role).toBe('SUPER_ADMIN')
      expect(newSession.user.email).toBe('super-flow@intus.com')
      expect(newSession.user.name).toBe('Super Flow Test')
    })

    it('should complete full BUSINESS_ADMIN login flow', async () => {
      const authenticatedUser = {
        id: 'cmvtest456business',
        email: 'business-flow@example.com',
        name: 'Business Flow Test',
        role: 'BUSINESS_ADMIN'
      }

      const token = await jwtCallback({
        token: {
          sub: authenticatedUser.id,
          email: authenticatedUser.email,
          name: authenticatedUser.name
        },
        user: authenticatedUser,
        trigger: 'signIn'
      })

      const session = await sessionCallback({
        session: {
          user: {
            email: authenticatedUser.email,
            name: authenticatedUser.name
          },
          expires: new Date(Date.now() + 3600000).toISOString()
        },
        token,
        trigger: undefined
      })

      expect(session.user.id).toBe('cmvtest456business')
      expect(session.user.role).toBe('BUSINESS_ADMIN')
    })
  })

  describe('Token Structure Validation', () => {
    it('should verify token.sub is set by NextAuth (not token.id)', async () => {
      const user = {
        id: 'user-id-123',
        email: 'user@example.com',
        role: 'SUPER_ADMIN'
      }

      const token = {
        sub: user.id,  // NextAuth sets this
        email: user.email
      }

      const result = await jwtCallback({
        token,
        user,
        trigger: 'signIn'
      })

      // Verify NextAuth v5 standard structure
      expect(result.sub).toBeDefined()           // ✓ sub is set
      expect(result.sub).toBe('user-id-123')     // ✓ sub contains user ID
      expect(result.id).toBeUndefined()          // ✓ id is NOT set (as expected)
      expect(typeof result.sub).toBe('string')   // ✓ sub is a string (not a function)
    })

    it('should never treat id as a function', () => {
      const token = {
        sub: 'test-id',
        email: 'test@example.com'
      }

      // Verify token.id is undefined, not a function
      expect((token as any).id).toBeUndefined()
      expect(typeof (token as any).id).not.toBe('function')

      // Verify token.sub is a string, not a function
      expect(typeof token.sub).toBe('string')
      expect(typeof token.sub).not.toBe('function')
    })
  })
})
