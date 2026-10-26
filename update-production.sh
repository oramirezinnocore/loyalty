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

build_new_version() {
    log_info "Building new application version..."

    local git_sha
    git_sha=$(git rev-parse --short HEAD)

    export GIT_SHA="$git_sha"

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache app; then
        log_error "Application build failed"
        return 1
    fi

    log_success "New version built: app:$git_sha"
    return 0
}

run_migrations() {
    log_info "Running database migrations..."

    # Use bundled Prisma CLI directly (deterministic, no npx package resolution)
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app node_modules/.bin/prisma migrate deploy; then
        log_error "Database migrations failed"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs db | tail -50
        return 1
    fi

    log_success "Migrations applied successfully"
    return 0
}

restart_application() {
    log_info "Restarting application..."

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --force-recreate --no-deps app; then
        log_error "Failed to restart application"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs app | tail -50
        return 1
    fi

    log_success "Application restarted"
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
    if ! build_new_version; then
        log_error "Build failed - no changes made"
        return 1
    fi

    if ! run_migrations; then
        log_error "Migration failed - application not restarted"
        return 1
    fi

    if ! restart_application; then
        log_error "Application restart failed"
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
