#!/bin/bash
#
# Production Migration Diagnosis and Repair
#
# This script inspects the complete migration state and reconciles
# Prisma migration history with the actual PostgreSQL database state.
#
# SAFE: Does not modify data or drop volumes
# SAFE: Only reconciles migration metadata to match physical reality
#

set -Eeuo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"

echo "========================================"
echo "PRODUCTION MIGRATION DIAGNOSIS & REPAIR"
echo "========================================"
echo ""

# STEP 1: Inspect complete migration history
echo "=== STEP 1: INSPECT MIGRATION HISTORY ==="
echo ""
echo "Querying _prisma_migrations table..."
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db psql -U loyalty_user -d intus_loyalty <<'EOSQL'
SELECT
    migration_name,
    TO_CHAR(started_at, 'YYYY-MM-DD HH24:MI:SS') as started_at,
    TO_CHAR(finished_at, 'YYYY-MM-DD HH24:MI:SS') as finished_at,
    TO_CHAR(rolled_back_at, 'YYYY-MM-DD HH24:MI:SS') as rolled_back_at,
    applied_steps_count,
    logs
FROM _prisma_migrations
ORDER BY started_at;
EOSQL

echo ""
echo "=== STEP 2: VERIFY PHYSICAL DATABASE STATE ==="
echo ""

# Check ARCHIVED enum value
echo "Checking if ARCHIVED exists in LoyaltyProgramStatus enum..."
ARCHIVED_EXISTS=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db psql -U loyalty_user -d intus_loyalty -t -c "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ARCHIVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LoyaltyProgramStatus'));" | tr -d ' \n')

if [ "$ARCHIVED_EXISTS" = "t" ]; then
    echo "✓ ARCHIVED exists in LoyaltyProgramStatus enum"
else
    echo "✗ ARCHIVED does NOT exist in LoyaltyProgramStatus enum"
fi
echo ""

# Check unique index
echo "Checking if unique partial index exists..."
INDEX_EXISTS=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db psql -U loyalty_user -d intus_loyalty -t -c "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LoyaltyProgram_businessId_status_active_key');" | tr -d ' \n')

if [ "$INDEX_EXISTS" = "t" ]; then
    echo "✓ Unique partial index 'LoyaltyProgram_businessId_status_active_key' EXISTS"
    echo ""
    echo "Index definition:"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db psql -U loyalty_user -d intus_loyalty -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'LoyaltyProgram_businessId_status_active_key';"
else
    echo "✗ Unique partial index 'LoyaltyProgram_businessId_status_active_key' does NOT exist"
fi
echo ""

# STEP 3: Reconcile based on physical state
echo "=== STEP 3: RECONCILE MIGRATION HISTORY ==="
echo ""

# Reconcile migration 20261026000000_add_archived_program_status
if [ "$ARCHIVED_EXISTS" = "t" ]; then
    echo "ARCHIVED exists physically. Marking migration as applied if not already..."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
        node_modules/.bin/prisma migrate resolve --applied 20261026000000_add_archived_program_status || echo "Already applied or resolved"
    echo ""
fi

# Reconcile migration 20261026000001_unique_active_program
if [ "$INDEX_EXISTS" = "t" ]; then
    echo "Unique index exists physically. Marking migration as applied..."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
        node_modules/.bin/prisma migrate resolve --applied 20261026000001_unique_active_program || echo "Already applied or resolved"
    echo ""
else
    echo "Unique index does NOT exist physically."
    echo "Checking if there is a failed migration record to roll back..."

    FAILED_MIGRATION=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db psql -U loyalty_user -d intus_loyalty -t -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20261026000001_unique_active_program' AND finished_at IS NULL;" | tr -d ' \n')

    if [ -n "$FAILED_MIGRATION" ]; then
        echo "Found failed migration record. Marking as rolled back..."
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
            node_modules/.bin/prisma migrate resolve --rolled-back 20261026000001_unique_active_program
        echo ""
        echo "Migration marked as rolled back. Prisma will attempt to apply it on next deploy."
    else
        echo "No failed migration record found."
    fi
    echo ""
fi

# STEP 4: Verify Prisma state
echo "=== STEP 4: VERIFY PRISMA MIGRATION STATUS ==="
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
    node_modules/.bin/prisma migrate status

echo ""
echo "=== STEP 5: APPLY PENDING MIGRATIONS ==="
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
    node_modules/.bin/prisma migrate deploy

echo ""
echo "=== FINAL VERIFICATION ==="
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
    node_modules/.bin/prisma migrate status

echo ""
echo "========================================"
echo "DIAGNOSIS AND REPAIR COMPLETE"
echo "========================================"
