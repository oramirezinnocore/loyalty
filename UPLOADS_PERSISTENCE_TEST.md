# Business Uploads Persistence Test

## Purpose
Verify that business logos survive container recreation and deployments.

## Prerequisites
- SSH access to production VPS at `/opt/loyalty`
- Docker access on production server
- Existing production deployment

## Test Procedure

### 1. Verify Current State

```bash
cd /opt/loyalty

# Check existing volumes
docker volume ls | grep loyalty

# Expected output should include:
# loyalty-postgres-data  (PostgreSQL - must exist)
# loyalty-uploads        (Uploads - must exist after fix)

# Inspect loyalty-app mounts
docker inspect loyalty-app --format '{{range .Mounts}}{{.Type}} {{.Name}} {{.Source}} -> {{.Destination}} ({{.RW}}){{println}}{{end}}'

# Expected output:
# volume loyalty-uploads /var/lib/docker/volumes/loyalty-uploads/_data -> /app/uploads (true)
```

### 2. Create Test File

```bash
# Create test marker file inside container
docker exec loyalty-app sh -c 'echo "persistence-test-$(date +%s)" > /app/uploads/.persistence-test && cat /app/uploads/.persistence-test'

# Record the content for verification
```

### 3. Verify Test File Exists

```bash
# Check from host via volume
sudo ls -la /var/lib/docker/volumes/loyalty-uploads/_data/

# Should show .persistence-test file
```

### 4. Recreate ONLY App Container

```bash
# Stop and remove app container (DOES NOT affect volumes)
docker stop loyalty-app
docker rm loyalty-app

# Verify volume still exists
docker volume inspect loyalty-uploads

# Should return volume metadata (not deleted)
```

### 5. Start New App Container

```bash
# Start app service (will create new container with same mounts)
docker compose --env-file .env.production -f docker-compose.production.yml up -d app

# Wait for container to be ready
docker ps | grep loyalty-app
```

### 6. Verify Persistence

```bash
# Check if test file survived container recreation
docker exec loyalty-app cat /app/uploads/.persistence-test

# Should show the SAME content from step 2
# If content matches: ✅ PERSISTENCE WORKS
# If file missing: ❌ PERSISTENCE FAILED
```

### 7. Cleanup

```bash
# Remove test file
docker exec loyalty-app rm /app/uploads/.persistence-test

# Verify business logos still exist
docker exec loyalty-app ls -la /app/uploads/businesses/
```

## Production Deployment Test

### Before Deployment
```bash
# 1. Verify uploads volume exists
docker volume inspect loyalty-uploads

# 2. If volume doesn't exist, create it:
docker volume create loyalty-uploads

# 3. Note a business that has a logo uploaded
# (Check Admin > Settings for a business with visible logo)
```

### During Deployment
```bash
# Run update script (will recreate containers)
./update-production.sh
```

### After Deployment
```bash
# 1. Verify uploads volume still exists
docker volume inspect loyalty-uploads

# 2. Check new container mounts correct volume
docker inspect loyalty-app --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}'

# Expected: loyalty-uploads

# 3. Access the business Settings page
# Logo should still be visible (not broken)

# 4. Access /join/<business-slug>
# Logo should display correctly (not fallback to initial letter)
```

## Common Issues

### Issue: Volume has project prefix (loyalty_loyalty-uploads)
**Cause:** Volume was created before marking it as external
**Fix:** 
```bash
# Stop app
docker stop loyalty-app

# Rename volume
docker volume create loyalty-uploads
docker run --rm -v loyalty_loyalty-uploads:/source -v loyalty-uploads:/dest alpine sh -c 'cp -av /source/. /dest/'
docker volume rm loyalty_loyalty-uploads

# Restart app
docker compose --env-file .env.production -f docker-compose.production.yml up -d app
```

### Issue: Logos disappear after deployment
**Cause:** Container mounting wrong volume or volume not marked external
**Verification:**
```bash
# Check what volume is actually mounted
docker inspect loyalty-app --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}MOUNTED: {{.Name}} ({{.Source}}){{end}}{{end}}'

# Should be: MOUNTED: loyalty-uploads
# Not: MOUNTED: loyalty_loyalty-uploads or empty
```

## Success Criteria

✅ Volume `loyalty-uploads` exists and is marked external in docker-compose.production.yml
✅ Container mounts `loyalty-uploads` to `/app/uploads`
✅ Test file survives container recreation
✅ Existing business logos survive ./update-production.sh execution
✅ No broken images in /join pages after deployment
✅ Settings page shows logos correctly after deployment
