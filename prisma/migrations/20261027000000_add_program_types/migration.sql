-- Add program types and simplified reward fields
-- This migration is backward compatible: existing programs default to VISITS

-- Create ProgramType enum
CREATE TYPE "ProgramType" AS ENUM ('VISITS', 'PURCHASES', 'STREAK', 'POINTS');

-- Add new columns to LoyaltyProgram
ALTER TABLE "LoyaltyProgram"
  ADD COLUMN "programType" "ProgramType" NOT NULL DEFAULT 'VISITS',
  ADD COLUMN "reward" TEXT,
  ADD COLUMN "rewardDescription" TEXT,
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "expirationDays" INTEGER;

-- Backfill reward and rewardDescription from first active RewardDefinition
-- This preserves existing program rewards in the new simple fields
UPDATE "LoyaltyProgram" lp
SET
  "reward" = COALESCE(
    (SELECT name FROM "RewardDefinition"
     WHERE "loyaltyProgramId" = lp.id
       AND "isActive" = true
     ORDER BY "createdAt" ASC
     LIMIT 1),
    '1 premio gratis'
  ),
  "rewardDescription" = (
    SELECT description FROM "RewardDefinition"
    WHERE "loyaltyProgramId" = lp.id
      AND "isActive" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
  );

-- Make reward required after backfill
ALTER TABLE "LoyaltyProgram"
  ALTER COLUMN "reward" SET NOT NULL;

-- Add index on programType for filtering
CREATE INDEX "LoyaltyProgram_programType_idx" ON "LoyaltyProgram"("programType");
