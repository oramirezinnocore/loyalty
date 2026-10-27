# Production Migration Diagnosis and Repair

## Purpose

The `diagnose-and-repair-migrations.sh` script performs a complete inspection and reconciliation of Prisma migration state against the actual PostgreSQL database.

## When to Use

Use this script when:
- `prisma migrate deploy` fails with P3009 (failed migration) or P3018 errors
- Migration history is out of sync with physical database state
- You need to understand the complete migration status before deployment

## What It Does

### STEP 1: Inspect Migration History
Queries the `_prisma_migrations` table and displays:
- migration_name
- started_at / finished_at / rolled_back_at timestamps
- applied_steps_count
- logs

### STEP 2: Verify Physical Database State
Checks actual PostgreSQL objects:
- **ARCHIVED enum value**: Verifies `ARCHIVED` exists in `LoyaltyProgramStatus`
- **Unique partial index**: Verifies `LoyaltyProgram_businessId_status_active_key` exists and shows its definition

### STEP 3: Reconcile Migration History
Based on physical reality:
- If object exists: marks migration as `--applied`
- If object missing: marks failed migration as `--rolled-back` (allows retry)

### STEP 4: Verify Prisma Status
Runs `prisma migrate status` to show current state

### STEP 5: Apply Pending Migrations
Runs `prisma migrate deploy` to apply any pending migrations

### Final Verification
Shows final `prisma migrate status`

## Usage

```bash
cd /opt/loyalty
./scripts/diagnose-and-repair-migrations.sh
```

## Safety

✓ **Does NOT**:
  - Drop or recreate database
  - Delete volumes
  - Modify business/customer data
  - Run destructive SQL commands

✓ **Only reconciles metadata** to match physical reality

## Expected Result

After running successfully:
- All migrations show as applied
- `prisma migrate status` shows "No pending migrations"
- `prisma migrate deploy` succeeds with no errors
- Database ready for normal deployment

## Troubleshooting

If script fails:
1. Check database is healthy: `docker compose -f docker-compose.production.yml ps db`
2. Check credentials in `.env.production`: `DB_USER`, `DB_NAME`, `DB_PASSWORD`
3. Verify database connection: `docker compose exec db psql -U loyalty_user -d intus_loyalty -c '\dt'`

## Next Steps

After successful reconciliation:
1. Run `./update-production.sh` for normal deployment
2. Migration history is now clean
3. Future deployments will work normally
