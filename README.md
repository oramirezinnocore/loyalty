# IntusPath Loyalty MVP

Multi-tenant SaaS loyalty platform for small businesses.

## Quick Start

```bash
# Install dependencies
npm install

# Set up database (first time only)
npx prisma db push
npm run db:seed

# Run development server
npm run dev

# Run tests
npm test
```

## Development Credentials

### Super Admin
- Email: `super@intus.com`
- Password: `super-admin-123`

### Business Admin (Cono Churro)
- Email: `admin@conochurro.com`
- Password: `admin-123`

### Sample Customer
- Email: `cliente@example.com`
- Phone: `+52 55 9876 5432`

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS
- **Testing**: Jest

## Project Structure

```
├── app/                    # Next.js app directory
│   └── api/               # API routes
│       └── auth/          # Authentication endpoints
├── lib/                   # Core utilities
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # NextAuth configuration
│   └── authorization.ts  # Authorization utilities
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
└── __tests__/            # Test files
```

## Key Features Implemented

### Multi-tenancy
- Strict tenant isolation at database level
- SUPER_ADMIN: access to all businesses
- BUSINESS_ADMIN: access only to associated businesses

### Security
- Bcrypt password hashing
- Non-sequential public tokens for memberships
- Server-side authorization enforcement

### Data Model
- Business with branding and subscription
- Loyalty programs with reward definitions
- Customer memberships with secure tokens
- Transaction tracking
- Earned rewards and redemptions

## Database Commands

```bash
# Push schema changes
npx prisma db push

# Seed database
npm run db:seed

# Reset database (warning: deletes all data)
npx prisma db push --force-reset
npm run db:seed
```

## Testing

All tests pass:
- Authorization tests (SUPER_ADMIN and BUSINESS_ADMIN)
- Tenant isolation tests
- Membership security tests (non-sequential tokens)
- Business suspension tests
- Unique constraint tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch
```

## Environment Variables

The `.env.local` file is configured with:

```
DATABASE_URL="postgresql://username@localhost:5432/intus_loyalty?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-key-not-for-production"
```
