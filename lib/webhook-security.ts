import crypto from 'crypto'

const isMockMode = process.env.NODE_ENV !== 'production' &&
                   process.env.MERCADO_PAGO_ACCESS_TOKEN === 'TEST-mock-access-token'

/**
 * Validate Mercado Pago webhook signature
 * https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export function validateMercadoPagoWebhook(
  signature: string | null,
  xRequestId: string | null,
  dataId: string | null
): boolean {
  // In production, webhook secret MUST be configured
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET

  if (process.env.NODE_ENV === 'production' && !webhookSecret) {
    console.error('MERCADO_PAGO_WEBHOOK_SECRET not configured in production!')
    return false
  }

  // Mock mode only allowed in development/test
  if (isMockMode) {
    console.warn('Webhook validation: MOCK MODE (development only)')
    return true
  }

  if (!webhookSecret) {
    return false
  }

  if (!signature || !xRequestId || !dataId) {
    console.error('Missing webhook signature headers')
    return false
  }

  // Mercado Pago signature format: ts=timestamp,v1=signature
  const parts = signature.split(',')
  let ts = ''
  let v1 = ''

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 'ts') ts = value
    if (key === 'v1') v1 = value
  }

  if (!ts || !v1) {
    console.error('Invalid signature format')
    return false
  }

  // Check timestamp (prevent replay attacks - allow 5 min window)
  const timestamp = parseInt(ts, 10)
  const now = Math.floor(Date.now() / 1000)
  const fiveMinutes = 5 * 60

  if (Math.abs(now - timestamp) > fiveMinutes) {
    console.error('Webhook timestamp too old or too new')
    return false
  }

  // Compute expected signature
  // MP uses: template = "id:{data_id};request-id:{request_id};ts:{ts};"
  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', webhookSecret)
  hmac.update(template)
  const expectedSignature = hmac.digest('hex')

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(v1, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

/**
 * Check if Mercado Pago webhook validation is properly configured
 */
export function isMercadoPagoWebhookConfigured(): boolean {
  if (isMockMode) {
    return true // Mock mode available in dev
  }

  return !!(
    process.env.MERCADO_PAGO_ACCESS_TOKEN &&
    process.env.MERCADO_PAGO_WEBHOOK_SECRET &&
    process.env.MERCADO_PAGO_ACCESS_TOKEN !== 'TEST-mock-access-token'
  )
}
