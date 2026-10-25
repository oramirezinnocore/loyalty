#!/usr/bin/env bash

# IntusPath Loyalty - Production First Install
#
# This script performs the initial production deployment.
# For updates, use ./update-production.sh instead.
#
# Requirements:
# - Run from repository root
# - .env.production configured
# - Docker and Docker Compose V2 installed
# - Clean git working tree

set -Eeuo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly COMPOSE_FILE="docker-compose.production.yml"
readonly ENV_FILE=".env.production"
readonly HEALTH_ENDPOINT="http://127.0.0.1:\${APP_PORT:-3005}/api/health"
readonly MAX_HEALTH_RETRIES=30
readonly HEALTH_RETRY_DELAY=2

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

check_requirements() {
    log_info "Checking deployment requirements..."

    # Check repository root
    if [[ ! -f "package.json" ]] || [[ ! -f "prisma/schema.prisma" ]]; then
        log_error "Must run from repository root"
        exit 1
    fi

    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "$ENV_FILE not found"
        echo ""
        echo "Create $ENV_FILE with production configuration."
        echo "See .env.example for required variables."
        exit 1
    fi

    # Check environment file permissions (Linux uses -c, BSD/macOS uses -f)
    local perms
    perms=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%A' "$ENV_FILE" 2>/dev/null || echo "unknown")
    # Accept both "600" and "0600" (BSD format)
    if [[ "$perms" != "600" ]] && [[ "$perms" != "0600" ]]; then
        log_warning "$ENV_FILE permissions are $perms (should be 600)"
        log_warning "Run: chmod 600 $ENV_FILE"
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Install Docker first."
        exit 1
    fi

    # Check Docker Compose V2
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose V2 not found"
        log_error "Install with: apt-get install docker-compose-plugin"
        exit 1
    fi

    # Check git repository
    if [[ ! -d ".git" ]]; then
        log_error "Not a git repository"
        exit 1
    fi

    # Check working tree
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Working tree is not clean"
        git status --short
        exit 1
    fi

    # Check compose configuration
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config > /dev/null; then
        log_error "Docker Compose configuration invalid"
        exit 1
    fi

    log_success "All requirements satisfied"
}

show_deployment_info() {
    local git_sha
    git_sha=$(git rev-parse HEAD)
    local git_branch
    git_branch=$(git rev-parse --abbrev-ref HEAD)
    local git_tag
    git_tag=$(git describe --tags 2>/dev/null || echo "none")

    log_info "Deployment information:"
    echo "  Branch: $git_branch"
    echo "  Commit: $git_sha"
    echo "  Tag: $git_tag"
    echo ""
}

build_application() {
    log_info "Building production application image..."

    local git_sha
    git_sha=$(git rev-parse --short HEAD)

    export GIT_SHA="$git_sha"

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache loyalty-app; then
        log_error "Application build failed"
        exit 1
    fi

    log_success "Application image built: loyalty-app:$git_sha"
}

start_database() {
    log_info "Starting PostgreSQL..."

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d loyalty-postgres; then
        log_error "Failed to start PostgreSQL"
        exit 1
    fi

    log_info "Waiting for PostgreSQL health..."
    local retries=0
    while [[ $retries -lt 30 ]]; do
        if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps loyalty-postgres | grep -q "healthy"; then
            log_success "PostgreSQL is healthy"
            return 0
        fi
        sleep 2
        retries=$((retries + 1))
    done

    log_error "PostgreSQL did not become healthy"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs loyalty-postgres
    exit 1
}

run_migrations() {
    log_info "Running production database migrations..."

    # Run migrations using application container with production environment
    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm loyalty-app npx prisma migrate deploy; then
        log_error "Database migrations failed"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs loyalty-postgres
        exit 1
    fi

    log_success "Migrations applied successfully"
}

start_application() {
    log_info "Starting application..."

    if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d loyalty-app; then
        log_error "Failed to start application"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs loyalty-app
        exit 1
    fi

    log_success "Application container started"
}

wait_for_health() {
    log_info "Waiting for application health..."

    # Source APP_PORT from environment
    local app_port
    app_port=$(grep "^APP_PORT=" "$ENV_FILE" | cut -d= -f2 || echo "3005")

    local health_url="http://127.0.0.1:${app_port}/api/health"
    local retries=0

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
    log_error "Application did not become healthy"
    log_error "Health check URL: $health_url"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs loyalty-app | tail -50
    exit 1
}

show_status() {
    log_info "Deployment status:"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
}

show_useful_commands() {
    local app_port
    app_port=$(grep "^APP_PORT=" "$ENV_FILE" | cut -d= -f2 || echo "3005")

    echo ""
    log_success "Deployment complete!"
    echo ""
    echo "Useful commands:"
    echo ""
    echo "  # View container status"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE ps"
    echo ""
    echo "  # View application logs"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f loyalty-app"
    echo ""
    echo "  # View database logs"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f loyalty-postgres"
    echo ""
    echo "  # Check health"
    echo "  curl http://127.0.0.1:${app_port}/api/health"
    echo ""
    echo "  # Future updates"
    echo "  ./update-production.sh"
    echo ""
    echo "  # Stop services"
    echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down"
    echo ""
}

main() {
    log_info "IntusPath Loyalty - Production Deployment"
    echo ""

    check_requirements
    show_deployment_info
    build_application
    start_database
    run_migrations
    start_application
    wait_for_health
    show_status
    show_useful_commands
}

main "$@"
