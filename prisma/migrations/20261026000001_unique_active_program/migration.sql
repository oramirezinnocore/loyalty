-- Add unique partial index: only one ACTIVE program per business
-- This enforces the business rule at the database level
-- Prevents race conditions during concurrent activation/creation

CREATE UNIQUE INDEX "LoyaltyProgram_businessId_status_active_key" 
ON "LoyaltyProgram"("businessId") 
WHERE "status" = 'ACTIVE';
