#!/usr/bin/env bash

# IntusPath Loyalty - Production Super Admin Creation Helper
#
# Safely runs admin bootstrap against the current production image
# Uses SHA-tagged image (never :latest)
# Requires .env.production in current directory

set -Eeuo pipefail

readonly COMPOSE_FILE="docker-compose.production.yml"
readonly ENV_FILE=".env.production"
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Check prerequisites
if [[ ! -f "$ENV_FILE" ]]; then
    log_error "$ENV_FILE not found"
    echo ""
    echo "This script must be run from /opt/loyalty with .env.production configured"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_error "Docker not found"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose V2 not found"
    exit 1
fi

if [[ ! -d ".git" ]]; then
    log_error "Not a git repository"
    exit 1
fi

# Determine current Git SHA
CURRENT_SHA=$(git rev-parse --short HEAD)
log_info "Current commit: $CURRENT_SHA"

# Set GIT_SHA for docker compose (used in image tag)
export GIT_SHA="$CURRENT_SHA"

# Verify image exists
IMAGE_NAME="app:${CURRENT_SHA}"
if ! docker image inspect "$IMAGE_NAME" &> /dev/null; then
    log_error "Image $IMAGE_NAME not found"
    echo ""
    echo "The current commit's Docker image has not been built yet."
    echo "Run: ./update-production.sh"
    echo ""
    echo "Or if this is the first deployment, run: ./deploy-production.sh"
    exit 1
fi

log_success "Found image: $IMAGE_NAME"

# Run admin bootstrap script interactively
log_info "Starting admin bootstrap (interactive mode)..."
echo ""
log_info "You will be prompted for:"
log_info "  - Email address"
log_info "  - Full name"
log_info "  - Password (hidden, minimum 12 characters)"
log_info "  - Password confirmation"
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm app node scripts/create-super-admin.js

EXIT_CODE=$?

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
    log_success "Admin bootstrap completed successfully"
    echo ""
    echo "Next steps:"
    echo "  1. Open: https://loyalty.intuspath.com"
    echo "  2. Login with the credentials you just created"
    echo "  3. You will be redirected to the Super Admin dashboard"
    echo ""
else
    log_error "Admin bootstrap failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
