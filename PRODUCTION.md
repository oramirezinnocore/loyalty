# IntusPath Loyalty - Production Deployment Guide

Complete guide for deploying IntusPath Loyalty to production.

## Prerequisites

- PostgreSQL 14+ database
- Node.js 20+ runtime
- Docker (optional, recommended)
- Mercado Pago business account (required for billing)
- Google Cloud account (optional, for Google Wallet)
- Apple Developer account (optional, for Apple Wallet)

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/intus_loyalty?schema=public"

# Authentication
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# Application
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"

# Cron Security
CRON_SECRET="<generate with: openssl rand -hex 32>"

# Mercado Pago (Required)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-<from MP dashboard>"
MERCADO_PAGO_WEBHOOK_SECRET="<from MP webhook configuration>"
BILLING_GRACE_PERIOD_DAYS="3"
```

### Optional Variables

```bash
# Google Wallet
GOOGLE_WALLET_ISSUER_ID="<your-issuer-id>"
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL="<service-account>@<project>.iam.gserviceaccount.com"
GOOGLE_WALLET_PRIVATE_KEY="<service-account-private-key>"

# Apple Wallet
APPLE_PASS_TYPE_IDENTIFIER="pass.com.intus.loyalty"
APPLE_TEAM_IDENTIFIER="<your-team-id>"
APPLE_PASS_CERTIFICATE="<pass-certificate-pem>"
APPLE_PASS_PRIVATE_KEY="<pass-private-key-pem>"
APPLE_WWDR_CERTIFICATE="<wwdr-g4-certificate-pem>"
```

## Database Setup

### 1. Create Database

```bash
createdb intus_loyalty
```

### 2. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy
```

### 3. Seed Initial Data (Optional)

```bash
# Only for fresh deployments
npx prisma db seed
```

**Default Super Admin:**
- Email: `super@intus.com`
- Password: `super-admin-123` (CHANGE IMMEDIATELY)

## Production Build

### Option 1: Docker (Recommended)

```bash
# Build image
docker build -t intus-loyalty:latest .

# Run container
docker run -d \
  --name intus-loyalty \
  --env-file .env.production \
  -p 3000:3000 \
  intus-loyalty:latest
```

### Option 2: Direct Node.js

```bash
# Install dependencies
npm ci --only=production

# Generate Prisma client
npx prisma generate

# Build Next.js
npm run build

# Start production server
npm start
```

## Mercado Pago Configuration

### 1. Get Access Token

1. Go to https://www.mercadopago.com.mx/developers/panel/app
2. Create or select your application
3. Copy **Production Access Token**
4. Set `MERCADO_PAGO_ACCESS_TOKEN`

### 2. Configure Webhook

1. In MP dashboard, go to **Webhooks**
2. Create webhook: `https://yourdomain.com/api/webhooks/mercado-pago`
3. Select events: `subscription`, `preapproval`
4. Copy **Webhook Secret**
5. Set `MERCADO_PAGO_WEBHOOK_SECRET`

**Webhook Headers Required:**
- `x-signature` - HMAC signature
- `x-request-id` - Request identifier

## Google Wallet Configuration (Optional)

### 1. Enable API

1. Go to https://console.cloud.google.com/
2. Enable **Google Wallet API**
3. Create **Service Account**
4. Generate and download JSON key

### 2. Register Issuer

1. Go to Google Pay & Wallet Console
2. Register as **Loyalty Issuer**
3. Copy **Issuer ID**

### 3. Environment Variables

```bash
GOOGLE_WALLET_ISSUER_ID="<issuer-id>"
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL="<email-from-json>"
GOOGLE_WALLET_PRIVATE_KEY="<private-key-from-json>"
```

## Apple Wallet Configuration (Optional)

### 1. Create Pass Type ID

1. Go to https://developer.apple.com/account/
2. **Certificates, Identifiers & Profiles**
3. Create **Pass Type ID**: `pass.com.intus.loyalty`

### 2. Generate Certificates

```bash
# Generate CSR
openssl req -new -key pass.key -out pass.csr

# Upload CSR to Apple Developer Portal
# Download pass.cer

# Convert to PEM
openssl x509 -inform DER -in pass.cer -out pass.pem

# Extract private key
openssl rsa -in pass.key -out pass-private.pem
```

### 3. Download WWDR Certificate

1. Download **WWDR G4 Certificate** from Apple
2. Convert to PEM:

```bash
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

### 4. Environment Variables

```bash
APPLE_PASS_TYPE_IDENTIFIER="pass.com.intus.loyalty"
APPLE_TEAM_IDENTIFIER="<from developer portal>"
APPLE_PASS_CERTIFICATE="$(cat pass.pem)"
APPLE_PASS_PRIVATE_KEY="$(cat pass-private.pem)"
APPLE_WWDR_CERTIFICATE="$(cat wwdr.pem)"
```

## Cron Job Configuration

Grace period enforcement must run daily:

### Option 1: System Cron

```cron
# /etc/crontab
0 2 * * * curl -X POST https://yourdomain.com/api/billing/enforce-grace \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Option 2: Docker Cron Container

```dockerfile
FROM alpine:latest
RUN apk add curl
COPY enforce-grace.sh /etc/periodic/daily/
RUN chmod +x /etc/periodic/daily/enforce-grace.sh
CMD ["crond", "-f"]
```

**enforce-grace.sh:**
```bash
#!/bin/sh
curl -X POST https://yourdomain.com/api/billing/enforce-grace \
  -H "x-cron-secret: $CRON_SECRET"
```

## Health Checks

### Endpoint

```bash
GET /api/health
```

### Expected Response

```json
{
  "status": "healthy",
  "timestamp": "2026-10-25T12:00:00.000Z",
  "services": {
    "database": "connected",
    "application": "running"
  }
}
```

### Configure Health Check

**Docker:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

**Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Monitoring & Logging

### Key Events to Monitor

- `subscription_status_changed` - Billing state transitions
- `webhook_validation_failed` - Potential attack attempts
- `grace_period_enforced` - Automatic suspensions
- `business_suspended` - Revenue impact
- `wallet_sync_failed` - Integration issues

### Recommended Metrics

- Monthly Recurring Revenue (MRR)
- Active subscriptions
- Trial conversion rate
- Suspension rate
- Webhook success rate
- API response times
- Database query performance

### Access Logs

```bash
# Application logs
docker logs intus-loyalty

# Filter for errors
docker logs intus-loyalty 2>&1 | grep ERROR

# Follow logs
docker logs -f intus-loyalty
```

## Backup & Recovery

### Database Backups

```bash
# Daily backup
pg_dump intus_loyalty > backup-$(date +%Y%m%d).sql

# Restore
psql intus_loyalty < backup-20261025.sql
```

### Backup Strategy

- **Daily**: Full database dump
- **Hourly**: Transaction log archiving
- **Retention**: 30 days minimum
- **Test restores**: Monthly

### Critical Data

- Customers
- Memberships
- Transactions
- Earned rewards
- Subscriptions
- Webhook events (idempotency)

## Rollback Procedure

### 1. Database Rollback

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back <migration-name>
```

### 2. Application Rollback

```bash
# Docker: Revert to previous image
docker stop intus-loyalty
docker run -d --name intus-loyalty intus-loyalty:previous

# Git: Revert to previous release
git checkout <previous-release-tag>
npm ci --only=production
npm run build
npm start
```

### 3. Verify

```bash
# Check health
curl https://yourdomain.com/api/health

# Test critical flows
# - Customer registration
# - Purchase recording
# - Subscription creation
```

## Security Checklist

### Pre-Deployment

- [ ] All environment secrets generated and secured
- [ ] NEXTAUTH_SECRET is cryptographically random
- [ ] CRON_SECRET is unique and secured
- [ ] Database uses SSL/TLS in production
- [ ] Webhook signature validation enabled
- [ ] Mock mode disabled (NODE_ENV=production)
- [ ] Default super admin password changed
- [ ] CORS configured for production domains
- [ ] Rate limiting configured (if using reverse proxy)

### Post-Deployment

- [ ] Health endpoint responding
- [ ] Database migrations applied
- [ ] Mercado Pago webhook receiving events
- [ ] Test subscription creation
- [ ] Test purchase flow
- [ ] Test reward redemption
- [ ] Verify billing enforcement works
- [ ] Monitor error logs for 24 hours

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection Error

```bash
# Test connection
psql $DATABASE_URL

# Check connection limit
SELECT count(*) FROM pg_stat_activity WHERE datname = 'intus_loyalty';
```

### Webhook Signature Validation Fails

```bash
# Verify secret matches MP dashboard
echo $MERCADO_PAGO_WEBHOOK_SECRET

# Check webhook event logs
psql $DATABASE_URL -c "SELECT * FROM \"WebhookEvent\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

### Apple Wallet Pass Invalid

```bash
# Validate certificate chain
openssl verify -CAfile wwdr.pem pass.pem

# Test pass generation in dev mode
curl https://yourdomain.com/api/wallet/apple/<token>
```

## Performance Tuning

### Database

```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_membership_customer ON "Membership"("customerId");
CREATE INDEX IF NOT EXISTS idx_transaction_membership ON "Transaction"("membershipId");
CREATE INDEX IF NOT EXISTS idx_customer_business_phone ON "Customer"("businessId", "phone");

-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;
```

### Next.js

```bash
# Enable standalone output (already configured)
# See next.config.ts: output: 'standalone'

# Reduce bundle size
npm run build -- --analyze
```

### Caching

- Database connection pooling (PgBouncer)
- CDN for static assets
- Redis for session storage (optional)

## Scaling Considerations

### Horizontal Scaling

- Application: Stateless, can run multiple instances
- Database: Use read replicas for analytics queries
- Session: Redis cluster for multi-instance sessions

### Vertical Scaling

- **Application**: 2 CPU, 4GB RAM minimum
- **Database**: 4 CPU, 8GB RAM recommended
- **Storage**: 50GB SSD minimum

### High Availability

- Multi-AZ database deployment
- Load balancer across app instances
- Automated failover
- Regular backup testing

## Support & Maintenance

### Regular Tasks

- **Daily**: Monitor health checks, review error logs
- **Weekly**: Check MRR, review suspension patterns
- **Monthly**: Test backup restoration, security audit
- **Quarterly**: Dependency updates, performance review

### Emergency Contacts

- Database Issues: DBA team
- Billing Issues: Mercado Pago support
- Certificate Expiry: DevOps team
- Security Incidents: Security team

## License

© 2026 IntusPath. All rights reserved.
