-- Add program types and additional program-level rules
-- This migration is backward compatible: existing programs default to VISITS

-- Create ProgramType enum
CREATE TYPE "ProgramType" AS ENUM ('VISITS', 'PURCHASES', 'STREAK', 'POINTS');

-- Add new columns to LoyaltyProgram
ALTER TABLE "LoyaltyProgram"
  ADD COLUMN "programType" "ProgramType" NOT NULL DEFAULT 'VISITS',
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "expirationDays" INTEGER;

-- Add index on programType for filtering
CREATE INDEX "LoyaltyProgram_programType_idx" ON "LoyaltyProgram"("programType");

-- Note: Rewards remain in RewardDefinition table (single source of truth)
-- programType is a semantic/UI field only
-- All programs default to VISITS type (accumulative behavior)
