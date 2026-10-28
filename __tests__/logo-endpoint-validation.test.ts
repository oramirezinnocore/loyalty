import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { GET } from '@/app/api/public/assets/businesses/[businessId]/logo/route'
import { NextRequest } from 'next/server'

describe('Logo Endpoint - Business ID Validation', () => {
  const createRequest = (businessId: string) => {
    const url = `http://localhost:3000/api/public/assets/businesses/${businessId}/logo`
    return new NextRequest(url)
  }

  const createParams = (businessId: string) => {
    return Promise.resolve({ businessId })
  }

  describe('CUID Validation', () => {
    it('accepts valid CUID format (c + 24 alphanumeric = 25 total)', async () => {
      // Real CUID example format: ckwpq7lhc0000d0o18fk4r96w (25 chars)
      const validCuid = 'clj8x9abc1234567890defgh1' // 25 characters
      const request = createRequest(validCuid)
      const params = createParams(validCuid)

      const response = await GET(request, { params })

      // Should not reject with 400 for valid CUID
      // (Will return 404 if logo doesn't exist, which is fine)
      expect(response.status).not.toBe(400)
    })

    it('accepts CUID with mixed case', async () => {
      const validCuid = 'cLJ8X9ABC1234567890DEFGH1' // 25 characters
      const request = createRequest(validCuid)
      const params = createParams(validCuid)

      const response = await GET(request, { params })

      expect(response.status).not.toBe(400)
    })

    it('rejects UUID format (wrong for Prisma cuid())', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const request = createRequest(uuid)
      const params = createParams(uuid)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
      const text = await response.text()
      expect(text).toContain('Invalid business ID')
    })

    it('rejects path traversal attempts', async () => {
      const malicious = '../../../etc/passwd'
      const request = createRequest(malicious)
      const params = createParams(malicious)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
    })

    it('rejects CUID with wrong length', async () => {
      const tooShort = 'clj8x9abc'
      const request = createRequest(tooShort)
      const params = createParams(tooShort)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
    })

    it('rejects CUID not starting with c', async () => {
      const invalid = 'alj8x9abc1234567890defgh1' // 25 chars but starts with 'a'
      const request = createRequest(invalid)
      const params = createParams(invalid)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
    })

    it('rejects empty string', async () => {
      const empty = ''
      const request = createRequest(empty)
      const params = createParams(empty)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
    })

    it('rejects special characters in CUID', async () => {
      const invalid = 'clj8x9abc!@#$567890defgh1' // 25 chars but has special chars
      const request = createRequest(invalid)
      const params = createParams(invalid)

      const response = await GET(request, { params })

      expect(response.status).toBe(400)
    })
  })
})
