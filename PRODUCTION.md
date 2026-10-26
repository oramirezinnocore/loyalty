# IntusPath Loyalty - Production Deployment Guide

Complete guide for deploying IntusPath Loyalty to production VPS.

## Prerequisites

- Linux VPS (Ubuntu 22.04+ recommended)
- Docker and Docker Compose V2 installed
- Nginx installed
- Git installed
- Domain DNS configured (loyalty.intuspath.com)
- Mercado Pago business account (required for billing)
- Google Cloud account (optional, for Google Wallet)
- Apple Developer account (optional, for Apple Wallet)

## Quick Start (VPS First Install)

```bash
# 1. Clone repository
cd /opt
sudo git clone https://github.com/oramirezinnocore/loyalty.git
cd loyalty

# 2. Verify release
git log --oneline -3
git describe --tags

# 3. Create production environment
sudo cp .env.example .env.production
sudo chmod 600 .env.production
sudo nano .env.production  # Configure all required variables

# 4. Run first deployment
sudo ./deploy-production.sh

# 5. Configure Nginx (see Nginx Configuration section)

# 6. Configure DNS A record: loyalty -> VPS IP

# 7. Obtain SSL certificate (see HTTPS Configuration section)

# 8. Configure cron (see Cron Configuration section)

# 9. Verify public access
curl https://loyalty.intuspath.com/api/health
```

## Quick Start After First Install

Once deployed, the production workflow is streamlined:

### Deploy Updates

```bash
cd /opt/loyalty
./update-production.sh
```

Automatically handles: build, migrate, restart, health check, rollback on failure.

### Create Initial Super Admin

```bash
cd /opt/loyalty
./create-production-admin.sh
```

Interactive prompts for: email, name, password (hidden input).

### Login

Open: **https://loyalty.intuspath.com**

- Root `/` automatically redirects to login if not authenticated
- After login, SUPER_ADMIN → `/super-admin`, BUSINESS_ADMIN → `/admin`
- No Next.js starter content, production-ready interface

## Future Updates

Production updates are automated with rollback protection:

```bash
cd /opt/loyalty
./update-production.sh
```

The update script automatically:
- Fetches latest from GitHub
- Validates fast-forward update
- Builds new application version
- Runs database migrations
- Restarts application
- Verifies health
- **Automatically rolls back on failure**

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

**DO NOT use db:seed in production** - it creates development demo data.

See "Creating the Production Super Admin" section below for the secure production bootstrap process.

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

## Creating the Production Super Admin

**DO NOT use development seed in production.** The seed script creates demo data unsuitable for production.

### Prerequisites

- Production database migrations applied
- Application deployed and healthy
- Shell access to VPS

### Create the First Super Admin

Use the production helper script (recommended):

```bash
cd /opt/loyalty
./create-production-admin.sh
```

**What it does:**
- Detects current Git SHA
- Verifies correct Docker image exists
- Runs admin bootstrap interactively
- Never defaults to `:latest` tag
- Fails safely if image missing

**Alternative (manual):**

```bash
# Set current SHA
export GIT_SHA=$(git rev-parse --short HEAD)

# Run bootstrap
docker compose --env-file .env.production -f docker-compose.production.yml \
  run --rm app node scripts/create-super-admin.js
```

The script will interactively prompt:

```
=== IntusPath Loyalty - Production Super Admin Bootstrap ===

Email: admin@yourdomain.com
Name: Admin User
Password: ************
Confirm password: ************

🔐 Hashing password...
💾 Creating SUPER_ADMIN user...

✅ SUPER_ADMIN created successfully:
   Email: admin@yourdomain.com
   Name: Admin User
   Role: SUPER_ADMIN
   ID: clxxxxx...

⚠️  IMPORTANT: Store the password securely. It cannot be recovered.
```

**Security features:**
- Password is **not echoed** to terminal
- Password is **never** in shell history
- Password is **never** in process arguments
- Uses bcrypt hashing (12 rounds, same as application)
- Validates email format
- Requires strong password (≥12 chars, letters + numbers)

### Verify Super Admin Exists

Check without exposing password:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec app node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, name: true, role: true }
    }).then(users => {
      console.log('SUPER_ADMIN users:', users);
      prisma.\$disconnect();
    });
  "
```

Expected output:
```javascript
SUPER_ADMIN users: [
  {
    id: 'clxxxxx...',
    email: 'admin@yourdomain.com',
    name: 'Admin User',
    role: 'SUPER_ADMIN'
  }
]
```

### Idempotency and Safety

The bootstrap script is **idempotent** and safe to run multiple times:

**Existing SUPER_ADMIN:**
- Reports existing admin, exits successfully
- Does **not** modify password

**Existing non-SUPER_ADMIN:**
- Reports current role
- Asks for **explicit confirmation** before promotion
- Promotion preserves existing password

**Duplicate email:**
- Prisma unique constraint prevents duplicates
- Script reports error and exits

### Promoting an Existing User

If you need to promote an existing user to SUPER_ADMIN:

1. Run the bootstrap script
2. Enter the existing user's email
3. Script detects existing user and prompts:
   ```
   ⚠️  User already exists:
      Email: user@example.com
      Name: Existing User
      Role: BUSINESS_ADMIN

   Promote this user to SUPER_ADMIN? (yes/no):
   ```
4. Type `yes` to confirm promotion
5. Password is **not changed** during promotion

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

## Nginx Configuration

Create `/etc/nginx/sites-available/loyalty.intuspath.com`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name loyalty.intuspath.com;

    # Redirect HTTP to HTTPS (added automatically by Certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name loyalty.intuspath.com;

    # SSL certificates (managed by Certbot)
    # ssl_certificate /etc/letsencrypt/live/loyalty.intuspath.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/loyalty.intuspath.com/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to application
    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Health check endpoint (no auth required)
    location /api/health {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Client max body size (for uploads)
    client_max_body_size 10M;
}
```

Enable site and test:

```bash
sudo ln -s /etc/nginx/sites-available/loyalty.intuspath.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## DNS Configuration

Configure DNS A record for your domain:

| Type | Host    | Value           | TTL  |
|------|---------|-----------------|------|
| A    | loyalty | VPS_PUBLIC_IP   | 300  |

Wait for DNS propagation before running Certbot:

```bash
dig loyalty.intuspath.com +short
# Should return: VPS_PUBLIC_IP
```

## HTTPS Configuration

Obtain Let's Encrypt SSL certificate:

```bash
sudo certbot --nginx -d loyalty.intuspath.com
```

Certbot will automatically:
- Modify Nginx configuration
- Add SSL certificates
- Set up auto-renewal

Verify certificate:

```bash
sudo certbot certificates
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

## Cron Configuration

Grace period enforcement must run daily.

Create `/etc/cron.d/loyalty-billing`:

```cron
# IntusPath Loyalty - Daily billing grace period enforcement
# Runs at 2 AM daily

0 2 * * * root curl -X POST -H "x-cron-secret: YOUR_CRON_SECRET_HERE" http://127.0.0.1:3005/api/billing/enforce-grace >> /var/log/loyalty-cron.log 2>&1
```

**IMPORTANT:** Replace `YOUR_CRON_SECRET_HERE` with the actual `CRON_SECRET` from `.env.production`.

Set permissions:

```bash
sudo chmod 644 /etc/cron.d/loyalty-billing
```

Verify cron syntax:

```bash
cat /etc/cron.d/loyalty-billing
```

Manual execution (for testing):

```bash
curl -X POST \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  http://127.0.0.1:3005/api/billing/enforce-grace
```

## Docker Architecture

Production deployment uses isolated Docker infrastructure:

### Services

**db:**
- Image: postgres:16-alpine
- Network: loyalty-network (isolated)
- Volume: db-data (persistent)
- Port: NOT exposed to host (internal only)
- Health check: pg_isready
- Restart: unless-stopped

**app:**
- Image: app:${GIT_SHA}
- Network: loyalty-network (isolated)
- Port: 127.0.0.1:3005 → 3000 (localhost only)
- Health check: /api/health
- Restart: unless-stopped
- Environment: from .env.production

### Security

- PostgreSQL is **NOT exposed** to host network
- Application binds **ONLY to 127.0.0.1** (no 0.0.0.0)
- Nginx reverse proxy handles public HTTPS traffic
- Secrets stored in `.env.production` (chmod 600)
- All inter-service communication uses isolated Docker network

### Useful Commands

```bash
# View container status
docker compose --env-file .env.production -f docker-compose.production.yml ps

# View application logs
docker compose --env-file .env.production -f docker-compose.production.yml logs -f app

# View database logs
docker compose --env-file .env.production -f docker-compose.production.yml logs -f db

# Check health
curl http://127.0.0.1:3005/api/health

# Stop services (does not delete data)
docker compose --env-file .env.production -f docker-compose.production.yml down

# Restart application only
docker compose --env-file .env.production -f docker-compose.production.yml restart app

# View database volume
docker volume inspect db-data
```

## Migration Safety

**Production Migration Rule:**

All database migrations must be **backward-compatible** with the immediately previous application release.

This allows automatic application rollback without database rollback.

**Backward-Compatible Changes:**
- Adding nullable columns
- Adding new tables
- Adding indexes
- Expanding enum values

**Non-Backward-Compatible Changes (require manual planning):**
- Dropping columns
- Renaming columns
- Changing column types
- Dropping tables
- Restricting enum values

For destructive schema changes:
1. Plan multi-phase migration
2. Test rollback procedure manually
3. Schedule maintenance window
4. Coordinate with team

