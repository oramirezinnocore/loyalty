#!/usr/bin/env bash

# IntusPath Loyalty - Production Update with Automatic Rollback
#
# This script safely updates the production deployment with automatic
# rollback on failure. Inspired by IntusPath Ticketing update strategy.
#
# Features:
# - Fast-forward only updates (prevents history rewrites)
# - Automatic application rollback on health failure
# - Database migration preservation (never automatically rolled back)
# - Deployment locking (prevents concurrent updates)
#
# Requirements:
# - Run from repository root
# - .env.production configured
# - Docker and Docker Compose V2 installed
# - Clean git working tree
# - On 'main' branch

set -Eeuo pipefail

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m'

# Configuration
readonly COMPOSE_FILE="docker-compose.production.yml"
readonly ENV_FILE=".env.production"
readonly LOCK_FILE="/tmp/loyalty-update.lock"
readonly MAX_HEALTH_RETRIES=30
readonly HEALTH_RETRY_DELAY=2

# State tracking
BEFORE_SHA=""
AFTER_SHA=""
ROLLBACK_INITIATED=false
LEGACY_DB_DETECTED=false
LEGACY_APP_DETECTED=false
LEGACY_DB_IMAGE=""
LEGACY_APP_IMAGE=""

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_rollback() {
    echo -e "${MAGENTA}[ROLLBACK]${NC} $*"
}

cleanup() {
    # Release lock on exit
    if [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE"
    fi
}

trap cleanup EXIT

acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        log_error "Another update is already running (lock file exists)"
        log_error "If this is a stale lock, remove: $LOCK_FILE"
        exit 1
    fi

    echo $$ > "$LOCK_FILE"
    log_info "Deployment lock acquired"
}

check_requirements() {
    log_info "Checking update requirements..."

    # Repository root
    if [[ ! -f "package.json" ]] || [[ ! -f "prisma/schema.prisma" ]]; then
        log_error "Must run from repository root"
        exit 1
    fi

    # Environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "$ENV_FILE not found"
        exit 1
    fi

    # Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose V2 not found"
        exit 1
    fi

    # Git repository
    if [[ ! -d ".git" ]]; then
        log_error "Not a git repository"
        exit 1
    fi

    # Clean working tree
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Working tree is not clean"
        git status --short
        exit 1
    fi

    # On main branch
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" ]]; then
        log_error "Must be on 'main' branch (currently on '$current_branch')"
        exit 1
    fi

    # Remote configured
    if ! git remote get-url origin &> /dev/null; then
        log_error "No 'origin' remote configured"
        exit 1
    fi

    log_success "All requirements satisfied"
}

verify_deployment_config() {
    log_info "Verifying deployment configuration..."

    # Verify compose services exist
    local services
    services=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --services 2>&1)

    if ! echo "$services" | grep -q "^app$"; then
        log_error "Service 'app' not found in compose configuration"
        log_error "Available services:"
        echo "$services"
        exit 1
    fi

    if ! echo "$services" | grep -q "^db$"; then
        log_error "Service 'db' not found in compose configuration"
        log_error "Available services:"
        echo "$services"
        exit 1
    fi

    # Verify production PostgreSQL volume exists
    if ! docker volume inspect loyalty-postgres-data &> /dev/null; then
        log_error "Production PostgreSQL volume 'loyalty-postgres-data' not found"
        log_error "This volume must exist and contain the production database"
        log_error ""
        log_error "Available volumes:"
        docker volume ls
        exit 1
    fi

    # Verify required environment variables (without printing values)
    if ! grep -q "^DB_PASSWORD=." "$ENV_FILE"; then
        log_error "DB_PASSWORD not set in $ENV_FILE"
        log_error "This is required for production PostgreSQL"
        log_error ""
        log_error "The existing production database requires its original password."
        log_error "Recovery command:"
        log_error "  docker inspect loyalty-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_PASSWORD"
        exit 1
    fi

    if ! grep -q "^NEXTAUTH_SECRET=." "$ENV_FILE"; then
        log_error "NEXTAUTH_SECRET not set in $ENV_FILE"
        log_error "This is required for authentication"
        exit 1
    fi

    log_success "Deployment configuration valid"
    log_info "Services: app, db"
    log_info "Production volume: loyalty-postgres-data (verified)"
}

capture_current_state() {
    BEFORE_SHA=$(git rev-parse HEAD)
    log_info "Current commit: $BEFORE_SHA"
}

fetch_updates() {
    log_info "Fetching updates from origin..."

    if ! git fetch origin main; then
        log_error "Failed to fetch from origin"
        exit 1
    fi

    log_success "Fetch complete"
}

determine_update_strategy() {
    local target_sha
    target_sha=$(git rev-parse origin/main)

    log_info "Target commit: $target_sha"

    # Same commit
    if [[ "$BEFORE_SHA" == "$target_sha" ]]; then
        log_info "Already at latest version"
        echo ""
        read -p "Rebuild current version? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "No changes made"
            exit 0
        fi
        AFTER_SHA="$BEFORE_SHA"
        return 0
    fi

    # Verify fast-forward
    if ! git merge-base --is-ancestor "$BEFORE_SHA" "$target_sha"; then
        log_error "Update is not a fast-forward"
        log_error "Current: $BEFORE_SHA"
        log_error "Target: $target_sha"
        log_error ""
        log_error "This means the git history has diverged."
        log_error "Manual intervention required."
        exit 1
    fi

    log_success "Fast-forward update available"

    # Show changes
    echo ""
    log_info "Changes to be deployed:"
    git log --oneline "$BEFORE_SHA..$target_sha"
    echo ""
}

apply_update() {
    log_info "Applying fast-forward update..."

    if ! git merge --ff-only origin/main; then
        log_error "Fast-forward merge failed"
        exit 1
    fi

    AFTER_SHA=$(git rev-parse HEAD)
    log_success "Updated to: $AFTER_SHA"
}

detect_legacy_containers() {
    log_info "Checking for legacy production containers..."

    # Check if loyalty-postgres exists but is not managed by current Compose
    if docker ps -a --filter "name=^loyalty-postgres$" --format "{{.Names}}" | grep -q "^loyalty-postgres$"; then
        local compose_project
        compose_project=$(docker inspect loyalty-postgres --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")

        if [[ -z "$compose_project" ]] || [[ "$compose_project" != "loyalty" ]]; then
            log_warning "Legacy database container detected: loyalty-postgres"
            log_warning "This container will be safely transitioned to Compose management"
            LEGACY_DB_DETECTED=true

            # Capture current image for potential rollback
            LEGACY_DB_IMAGE=$(docker inspect loyalty-postgres --format '{{.Config.Image}}' 2>/dev/null || echo "")
            log_info "Legacy DB image: $LEGACY_DB_IMAGE"
        fi
    fi

    # Check if loyalty-app exists but is not managed by current Compose
    if docker ps -a --filter "name=^loyalty-app$" --format "{{.Names}}" | grep -q "^loyalty-app$"; then
        local compose_project
        compose_project=$(docker inspect loyalty-app --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")

        if [[ -z "$compose_project" ]] || [[ "$compose_project" != "loyalty" ]]; then
            log_warning "Legacy application container detected: loyalty-app"
            log_warning "This container will be safely transitioned to Compose management"
            LEGACY_APP_DETECTED=true

            # Capture current image for potential rollback
            LEGACY_APP_IMAGE=$(docker inspect loyalty-app --format '{{.Config.Image}}' 2>/dev/null || echo "")
            log_info "Legacy app image: $LEGACY_APP_IMAGE"
        fi
    fi

    if [[ "$LEGACY_DB_DETECTED" == "true" ]] || [[ "$LEGACY_APP_DETECTED" == "true" ]]; then
        log_warning "Legacy container adoption will be performed"
        log_warning "This is a one-time transition - future deployments will be standard"
    else
        log_info "No legacy containers detected - standard Compose deployment"
    fi
}

adopt_legacy_database() {
    if [[ "$LEGACY_DB_DETECTED" != "true" ]]; then
        return 0
    fi

    log_info "=== ADOPTING LEGACY DATABASE CONTAINER ==="
    echo ""

    # Verify legacy container mounts correct volume
    local mounted_volume
    mounted_volume=$(docker inspect loyalty-postgres --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null)

    if [[ "$mounted_volume" != "loyalty-postgres-data" ]]; then
        log_error "Legacy container does not mount 'loyalty-postgres-data'"
        log_error "Mounted volume: $mounted_volume"
        log_error "Cannot safely adopt - manual intervention required"
        return 1
    fi

    log_info "✓ Verified legacy container mounts: loyalty-postgres-data"

    # Check if container is running
    local is_running
    is_running=$(docker inspect loyalty-postgres --format '{{.State.Running}}' 2>/dev/null || echo "false")

    if [[ "$is_running" == "true" ]]; then
        log_info "Stopping legacy database container..."
        if ! docker stop loyalty-postgres; then
            log_error "Failed to stop legacy database container"
            return 1
        fi
        log_success "Legacy database container stopped"
    fi

    # Remove container (NOT volume)
    log_info "Removing legacy database container (volume preserved)..."
    if ! docker rm loyalty-postgres; then
        log_error "Failed to remove legacy database container"
        log_error "Attempting to restart legacy container for rollback..."
        docker start loyalty-postgres || true
        return 1
    fi

    log_success "Legacy database container removed"
    log_info "Production volume 'loyalty-postgres-data' preserved"
    echo ""

    return 0
}

adopt_legacy_application() {
    if [[ "$LEGACY_APP_DETECTED" != "true" ]]; then
        return 0
    fi

    log_info "=== ADOPTING LEGACY APPLICATION CONTAINER ==="
    echo ""

    # Check if container is running
    local is_running
    is_running=$(docker inspect loyalty-app --format '{{.State.Running}}' 2>/dev/null || echo "false")

    if [[ "$is_running" == "true" ]]; then
        log_info "Stopping legacy application container..."
        if ! docker stop loyalty-app; then
            log_error "Failed to stop legacy application container"
            return 1
        fi
        log_success "Legacy application container stopped"
    fi

    # Remove container (NOT volumes)
    log_info "Removing legacy application container (volumes preserved)..."
    if ! docker rm loyalty-app; then
        log_error "Failed to remove legacy application container"
        log_error "Attempting to restart legacy container for rollback..."
        docker start loyalty-app || true
        return 1
    fi

    log_success "Legacy application container removed"
    log_info "All volumes preserved"
    echo ""

    return 0
}

build_new_version() {
    log_info "Building new application version..."

    local git_sha
    git_sha=$(git rev-parse --short HEAD)

    export GIT_SHA="$git_sha"

    # Log the exact command for debugging
    log_info "Executing: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE build --no-cache app"

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache app; then
        log_error "Application build failed"
        log_error "Expected service: app"
        log_error "Compose file: $COMPOSE_FILE"
        log_error "Env file: $ENV_FILE"
        return 1
    fi

    log_success "New version built: app:$git_sha"
    return 0
}

ensure_database_healthy() {
    log_info "Ensuring PostgreSQL is healthy..."

    local retries=0
    local max_retries=30

    while [[ $retries -lt $max_retries ]]; do
        if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps db | grep -q "healthy"; then
            log_success "PostgreSQL is healthy"
            return 0
        fi

        echo -n "."
        sleep 2
        retries=$((retries + 1))
    done

    echo ""
    log_error "PostgreSQL did not become healthy after $max_retries attempts"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs db | tail -50
    return 1
}

run_migrations() {
    log_info "Running database migrations..."

    # Database health already verified by restart_database()
    # Use bundled Prisma CLI directly (deterministic, no npx package resolution)
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app node_modules/.bin/prisma migrate deploy; then
        log_error "Database migrations failed"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs db | tail -50
        return 1
    fi

    log_success "Migrations applied successfully"
    return 0
}

restart_database() {
    log_info "Starting database service..."

    # Adopt legacy database container if necessary
    if ! adopt_legacy_database; then
        log_error "Failed to adopt legacy database container"
        return 1
    fi

    # Start db service with existing loyalty-postgres-data volume
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db; then
        log_error "Failed to start database service"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs db | tail -50

        # Attempt rollback if legacy container was detected
        if [[ "$LEGACY_DB_DETECTED" == "true" ]] && [[ -n "$LEGACY_DB_IMAGE" ]]; then
            log_rollback "Attempting to restore legacy database container..."
            docker run -d \
                --name loyalty-postgres \
                --network loyalty_default \
                -p 5432:5432 \
                -v loyalty-postgres-data:/var/lib/postgresql/data \
                -e POSTGRES_USER=loyalty \
                -e POSTGRES_PASSWORD="${DB_PASSWORD:-}" \
                -e POSTGRES_DB=loyalty \
                --restart unless-stopped \
                "$LEGACY_DB_IMAGE" || log_error "Failed to restore legacy database"
        fi

        return 1
    fi

    # Wait for database health
    if ! ensure_database_healthy; then
        log_error "Database failed health check after start"
        return 1
    fi

    log_success "Database service started and healthy"
    return 0
}

restart_application() {
    log_info "Starting application service..."

    # Adopt legacy application container if necessary
    if ! adopt_legacy_application; then
        log_error "Failed to adopt legacy application container"
        return 1
    fi

    # Start app service
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --force-recreate --no-deps app; then
        log_error "Failed to start application"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs app | tail -50

        # Attempt rollback if legacy container was detected
        if [[ "$LEGACY_APP_DETECTED" == "true" ]] && [[ -n "$LEGACY_APP_IMAGE" ]]; then
            log_rollback "Attempting to restore legacy application container..."
            docker run -d \
                --name loyalty-app \
                --network loyalty_default \
                -p 3000:3000 \
                -v loyalty-uploads:/app/uploads \
                --restart unless-stopped \
                "$LEGACY_APP_IMAGE" || log_error "Failed to restore legacy application"
        fi

        return 1
    fi

    log_success "Application service started"
    return 0
}

check_health() {
    local app_port
    app_port=$(grep "^APP_PORT=" "$ENV_FILE" | cut -d= -f2 || echo "3005")

    local health_url="http://127.0.0.1:${app_port}/api/health"
    local retries=0

    log_info "Checking application health: $health_url"

    while [[ $retries -lt $MAX_HEALTH_RETRIES ]]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            log_success "Application is healthy"
            return 0
        fi

        echo -n "."
        sleep $HEALTH_RETRY_DELAY
        retries=$((retries + 1))
    done

    echo ""
    log_error "Application health check failed after $MAX_HEALTH_RETRIES attempts"
    return 1
}

rollback_application() {
    ROLLBACK_INITIATED=true

    log_rollback "Initiating automatic application rollback"
    log_rollback "Target: $BEFORE_SHA"
    echo ""
    log_warning "DATABASE MIGRATIONS ARE NOT AUTOMATICALLY ROLLED BACK"
    log_warning "New migrations are assumed backward-compatible with previous app version"
    echo ""

    # Capture failed version logs
    log_rollback "Capturing failed version logs..."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs app > "/tmp/loyalty-failed-${AFTER_SHA}.log" 2>&1
    log_info "Failed logs saved to: /tmp/loyalty-failed-${AFTER_SHA}.log"

    # Restore source tree
    log_rollback "Restoring source tree to: $BEFORE_SHA"
    if ! git reset --hard "$BEFORE_SHA"; then
        log_error "CRITICAL: Failed to restore source tree"
        exit 1
    fi

    # Rebuild previous version
    log_rollback "Building previous application version..."
    local git_sha
    git_sha=$(git rev-parse --short HEAD)
    export GIT_SHA="$git_sha"

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache app; then
        log_error "CRITICAL: Failed to build previous version"
        show_recovery_commands
        exit 1
    fi

    # Restart previous version
    log_rollback "Starting previous application version..."
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --force-recreate --no-deps app; then
        log_error "CRITICAL: Failed to start previous version"
        show_recovery_commands
        exit 1
    fi

    # Check previous version health
    log_rollback "Verifying previous version health..."
    if check_health; then
        log_success "Rollback successful - previous version is healthy"
        log_warning "Update failed and was rolled back to: $BEFORE_SHA"
        log_warning "Failed version: $AFTER_SHA"
        log_warning "Failed logs: /tmp/loyalty-failed-${AFTER_SHA}.log"
        return 0
    else
        log_error "CRITICAL: Previous version also failed health check"
        show_recovery_commands
        exit 1
    fi
}

show_recovery_commands() {
    echo ""
    log_error "=== MANUAL RECOVERY REQUIRED ==="
    echo ""
    echo "Current git state:"
    git log --oneline -3
    echo ""
    echo "Container status:"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    echo ""
    echo "View logs:"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs app"
    echo ""
    echo "Database status:"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE ps db"
    echo ""
}

perform_update() {
    # Detect legacy containers before making any changes
    detect_legacy_containers

    if ! build_new_version; then
        log_error "Build failed - no changes made"
        return 1
    fi

    # Database must be started/adopted before migrations
    if ! restart_database; then
        log_error "Database start failed - no migrations performed"
        return 1
    fi

    if ! run_migrations; then
        log_error "Migration failed - application not restarted"
        return 1
    fi

    if ! restart_application; then
        log_error "Application start failed"
        return 1
    fi

    if ! check_health; then
        log_error "New version failed health check"
        rollback_application
        return 1
    fi

    return 0
}

show_success() {
    local app_port
    app_port=$(grep "^APP_PORT=" "$ENV_FILE" | cut -d= -f2 || echo "3005")

    echo ""
    log_success "===== UPDATE COMPLETE ====="
    echo ""
    log_info "Previous version: $BEFORE_SHA"
    log_info "Current version: $AFTER_SHA"
    echo ""
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    echo ""
    echo "Useful commands:"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f app"
    echo "  curl http://127.0.0.1:${app_port}/api/health"
    echo ""
}

main() {
    log_info "IntusPath Loyalty - Production Update"
    echo ""

    acquire_lock
    check_requirements
    verify_deployment_config
    capture_current_state
    fetch_updates
    determine_update_strategy

    # If we're not on the same SHA, apply update
    if [[ "$BEFORE_SHA" != "$(git rev-parse origin/main)" ]]; then
        apply_update
    fi

    if perform_update; then
        show_success
        exit 0
    else
        if [[ "$ROLLBACK_INITIATED" == "true" ]]; then
            log_error "Update failed and was rolled back"
            exit 1
        else
            log_error "Update failed"
            exit 1
        fi
    fi
}

main "$@"
