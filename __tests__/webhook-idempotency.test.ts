import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Webhook Idempotency', () => {
  const testEventId = `test-event-${Date.now()}`

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({
      where: { eventId: { contains: 'test-event-' } }
    })
    await prisma.$disconnect()
  })

  it('should store webhook event', async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        provider: 'mercado_pago',
        eventId: testEventId,
        eventType: 'subscription',
        payload: { test: 'data' },
        processed: false
      }
    })

    expect(event).toBeTruthy()
    expect(event.eventId).toBe(testEventId)
    expect(event.processed).toBe(false)
  })

  it('should prevent duplicate event IDs', async () => {
    await expect(
      prisma.webhookEvent.create({
        data: {
          provider: 'mercado_pago',
          eventId: testEventId,
          eventType: 'subscription',
          payload: { test: 'duplicate' },
          processed: false
        }
      })
    ).rejects.toThrow()
  })

  it('should mark event as processed', async () => {
    const updated = await prisma.webhookEvent.update({
      where: { eventId: testEventId },
      data: {
        processed: true,
        processedAt: new Date()
      }
    })

    expect(updated.processed).toBe(true)
    expect(updated.processedAt).toBeTruthy()
  })

  it('should find processed events', async () => {
    const processed = await prisma.webhookEvent.findMany({
      where: {
        processed: true,
        provider: 'mercado_pago'
      }
    })

    expect(processed.length).toBeGreaterThan(0)
    expect(processed.some(e => e.eventId === testEventId)).toBe(true)
  })

  it('should handle mock webhook payload', async () => {
    const mockPayload = {
      type: 'preapproval',
      data: {
        id: 'mock-preapproval-123',
        status: 'authorized'
      }
    }

    const event = await prisma.webhookEvent.create({
      data: {
        provider: 'mercado_pago',
        eventId: `mock-webhook-${Date.now()}`,
        eventType: 'preapproval',
        payload: mockPayload,
        processed: true,
        processedAt: new Date()
      }
    })

    expect(event.payload).toEqual(mockPayload)
  })
})
