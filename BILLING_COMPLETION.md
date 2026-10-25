# Mission 3 Complete - Automated SaaS Billing with Mercado Pago

## BILLING FLOW

```
Business Registration
    ↓
TRIAL (7 days)
    ↓
Mercado Pago Subscription Created
    ↓
Payment Authorized → ACTIVE
    |
    ├─→ Monthly Recurring Payment → ACTIVE (continues)
    |
    ├─→ Payment Problem → PAST_DUE
    |       ↓
    |   Grace Period (3 days)
    |       ↓
    |   Grace Expired → SUSPENDED
    |       ↓
    |   Business SUSPENDED
    |       ↓
    |   Loyalty Operations Blocked
    |       ↓
    |   Payment Resolved → ACTIVE (reactivation, data preserved)
    |
    └─→ User Cancels → CANCELED
```

## State Transitions

1. **New Business**: TRIAL (7 days free)
2. **Payment Authorized**: ACTIVE
3. **Payment Failed**: PAST_DUE (3-day grace period)
4. **Grace Expired**: SUSPENDED (business + subscription)
5. **Payment Resolved**: Reactivated to ACTIVE
6. **User Cancels**: CANCELED

## Access Control During Suspension

**SUSPENDED Business:**
- ❌ New customer enrollment blocked
- ❌ Purchase transactions blocked
- ❌ Reward redemption blocked
- ✅ BUSINESS_ADMIN can access billing
- ✅ SUPER_ADMIN can access everything
- ✅ All data preserved

**Customer Experience:**
- Neutral message: "El programa de lealtad no está disponible temporalmente."
- No mention of billing issues to end customers

## Data Preservation

**During and After Suspension:**
- ✅ Customers preserved
- ✅ Memberships preserved
- ✅ Progress preserved
- ✅ Transactions preserved
- ✅ Earned rewards preserved
- ✅ Redemption history preserved

**On Reactivation:**
- All historical data immediately accessible
- Business operations resume normally
- No data loss

## Implementation Details

### Mercado Pago Integration
- **SDK**: mercadopago npm package
- **Mode**: Mock mode for development (TEST-mock-access-token)
- **Production**: Real MP credentials via environment variables
- **Plan**: $299 MXN/month, 7-day trial

### Webhook Handling
- **Endpoint**: `/api/webhooks/mercado-pago`
- **Idempotency**: WebhookEvent table tracks processed events
- **Events**: subscription status changes, payment success/failure
- **Security**: Event ID uniqueness enforced

### Grace Period Enforcement
- **Default**: 3 days (configurable via BILLING_GRACE_PERIOD_DAYS)
- **Trigger**: Subscription status → PAST_DUE
- **Action**: Set gracePeriodEndsAt timestamp
- **Enforcement**: `/api/billing/enforce-grace` (SUPER_ADMIN only)
- **Automation**: Designed for cron job integration

### Subscription Management
- **Create**: `/api/subscription/create`
- **Sync**: `/api/subscription/sync`
- **Idempotency**: Prevents duplicate active subscriptions

## Environment Variables

Required for production:
```
MERCADO_PAGO_ACCESS_TOKEN=your-production-access-token
MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_APP_URL=https://yourdomain.com
BILLING_GRACE_PERIOD_DAYS=3
```

Development (mocked):
```
MERCADO_PAGO_ACCESS_TOKEN=TEST-mock-access-token
MERCADO_PAGO_WEBHOOK_SECRET=mock-webhook-secret
```

## UI Components

### Business Admin - /admin/billing
- Plan details (IntusPath Loyalty, $299 MXN/mes)
- Subscription status badge
- Next billing date
- Grace period countdown (if PAST_DUE)
- Activate subscription form
- Sync status button
- Informational alerts based on status

### Super Admin Dashboard
- **MRR**: Total monthly recurring revenue
- **Subscription Counts**:
  - Trial
  - Active  
  - Past Due
  - Canceled
  - Suspended

### Super Admin Business List
- Per-business subscription status
- Mercado Pago preapproval ID
- Next billing date
- Monthly price

## Security

✅ Mercado Pago credentials server-side only
✅ Webhook event validation
✅ Idempotency enforcement
✅ Cross-tenant access prevention
✅ BUSINESS_ADMIN cannot forge subscription status
✅ Provider IDs not used for authorization
✅ Tenant isolation maintained

## Test Coverage

**8 test suites, 54 tests passing:**

1. authorization.test.ts (14 tests)
2. membership.test.ts (4 tests)
3. business.test.ts (4 tests)
4. customer-registration.test.ts (5 tests)
5. loyalty-engine.test.ts (10 tests)
6. cross-tenant-security.test.ts (7 tests)
7. **billing.test.ts (15 tests)**
8. **webhook-idempotency.test.ts (5 tests)**

**New Billing Tests:**
- ✅ Create subscription with $299 MXN plan
- ✅ Prevent duplicate active subscription
- ✅ Provider status mapping (authorized/paused/cancelled)
- ✅ Grace period behavior
- ✅ Allow operations during TRIAL/ACTIVE/PAST_DUE
- ✅ Block operations when SUSPENDED
- ✅ Enforce grace period expiration
- ✅ Suspend business after grace period
- ✅ Block purchase when suspended
- ✅ Block redemption when suspended
- ✅ Allow operations after reactivation
- ✅ Preserve data through suspension/reactivation
- ✅ MRR calculation
- ✅ Subscription counts
- ✅ Webhook idempotency
- ✅ Duplicate event prevention
- ✅ Event processing tracking
- ✅ Mock webhook payloads

All tests run without real Mercado Pago credentials.
