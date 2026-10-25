# IntusPath Loyalty MVP - Demo Guide

## Quick Start

```bash
npm run dev
```

## Demo Credentials & URLs

### Super Admin
- **URL**: http://localhost:3000/super-admin
- **Email**: super@intus.com
- **Password**: super-admin-123
- **Features**:
  - View all businesses
  - Activate/suspend businesses
  - Platform statistics

### Business Admin (Cono Churro)
- **URL**: http://localhost:3000/admin
- **Email**: admin@conochurro.com
- **Password**: admin-123
- **Features**:
  - Dashboard with stats
  - Customer scanner
  - Manage program
  - View customers
  - Manage rewards
  - Settings

### Customer Acquisition
- **URL**: http://localhost:3000/join/cono-churro
- **No login required**
- **Features**:
  - View branded program
  - Register new customer
  - Automatic wallet creation

### Customer Wallets (Demo)
The seed creates two customers with wallets. After running seed, get their tokens:

```bash
psql -U jesus.ramirez -d intus_loyalty -c "SELECT c.\"firstName\", m.\"publicToken\" FROM \"Membership\" m JOIN \"Customer\" c ON m.\"customerId\" = c.id;"
```

Then access wallets at:
- http://localhost:3000/wallet/{token}

María García - 5/9 progress
Juan Pérez - 9/9 at goal (ready for reward)

## Complete Demo Journey

### 1. Super Admin Flow
1. Visit http://localhost:3000/auth/signin
2. Login as Super Admin
3. View platform statistics
4. Navigate to Manage Businesses
5. See Cono Churro (ACTIVE)
6. Optionally suspend/reactivate

### 2. Business Admin Setup
1. Login as Business Admin
2. View Dashboard
3. Go to "Programa" to see QR code
4. Download acquisition QR
5. Go to "Configuración" to customize branding

### 3. Customer Acquisition
1. Visit http://localhost:3000/join/cono-churro (or scan QR)
2. Enter customer details:
   - Name: Test Customer
   - Phone: +52 55 1234 5678
   - Accept terms
3. Click "Quiero mi monedero"
4. Redirected to wallet with unique QR code

### 4. Transaction Flow
1. Business Admin goes to "Escáner"
2. Enter customer token manually (from wallet URL or DB query)
3. View customer info and progress
4. Click "Registrar compra"
5. Progress increments
6. When goal reached, reward appears

### 5. Reward Redemption
1. Business Admin goes to "Gestionar recompensas"
2. See available rewards
3. Click "Canjear" on a reward
4. Confirm redemption
5. Reward moves to "Redeemed" section
6. Second redemption attempt fails

## Testing Scanner

For development, the scanner accepts manual token entry instead of QR scanning.

Get a customer token:
```bash
psql -U jesus.ramirez -d intus_loyalty -c "SELECT \"publicToken\" FROM \"Membership\" LIMIT 1;"
```

Enter this token in the scanner to test the purchase flow.

## Automated Tests

```bash
npm test
```

All 32 tests should pass:
- Authorization (14 tests)
- Membership security (8 tests)
- Business operations (3 tests)
- Customer registration (5 tests)
- Loyalty engine (10 tests)
- Cross-tenant security (7 tests)

## Key Features Demonstrated

✅ Multi-tenant architecture
✅ Role-based access control
✅ Secure non-sequential tokens
✅ Customer registration with deduplication
✅ Digital wallet with QR
✅ Merchant scanner
✅ Purchase transaction recording
✅ Loyalty progress tracking
✅ Automatic reward generation
✅ Reward redemption
✅ Double-redemption prevention
✅ Cross-tenant security
✅ Branding configuration
✅ Mobile-responsive UI

## Architecture Highlights

- **Framework**: Next.js 16 App Router
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS
- **Testing**: Jest (32 passing tests)
- **Security**: Server-side authorization, CUID tokens
- **Multi-tenancy**: Enforced at data access layer

## Not Implemented (Out of Scope)

- Mercado Pago integration
- Apple/Google Wallet integration
- WhatsApp/SMS notifications
- Email marketing
- Advanced analytics
- VIP tiers
- Multi-plan billing
- POS integrations
- Native mobile apps
