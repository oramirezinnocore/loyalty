-- AlterTable Customer: Add publicToken field (stable QR identifier per customer-business)
-- This allows customers to participate in multiple programs with the same QR code

-- Step 1: Add publicToken column as nullable first (to populate existing records)
ALTER TABLE "Customer" ADD COLUMN "publicToken" TEXT;

-- Step 2: Populate publicToken from most recent Membership.publicToken for each customer
-- This preserves existing QR codes in production
UPDATE "Customer" c
SET "publicToken" = (
  SELECT m."publicToken"
  FROM "Membership" m
  WHERE m."customerId" = c.id
  ORDER BY m."createdAt" DESC
  LIMIT 1
)
WHERE c."publicToken" IS NULL;

-- Step 3: For any customers without memberships (edge case), generate CUID-compatible token
-- Using extension for better random strings (similar to CUID format)
UPDATE "Customer"
SET "publicToken" = 'clmig' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 20))
WHERE "publicToken" IS NULL;

-- Step 4: Make publicToken NOT NULL and UNIQUE
ALTER TABLE "Customer" ALTER COLUMN "publicToken" SET NOT NULL;
CREATE UNIQUE INDEX "Customer_publicToken_key" ON "Customer"("publicToken");
CREATE INDEX "Customer_publicToken_idx" ON "Customer"("publicToken");

-- Step 5: Add unique constraint on businessId + phone (handle NULL phones with partial index)
-- CRITICAL FIX: Use WHERE clause to exclude NULL phones from unique constraint
-- This prevents constraint violation when phone is NULL
CREATE UNIQUE INDEX "Customer_businessId_phone_key" ON "Customer"("businessId", "phone") WHERE "phone" IS NOT NULL;

-- Step 6: Make Membership.publicToken nullable (deprecated, kept for backwards compatibility)
ALTER TABLE "Membership" ALTER COLUMN "publicToken" DROP NOT NULL;

-- Step 7: Update Membership.publicToken unique constraint to handle nulls
DROP INDEX IF EXISTS "Membership_publicToken_key";
CREATE UNIQUE INDEX "Membership_publicToken_key" ON "Membership"("publicToken") WHERE "publicToken" IS NOT NULL;
