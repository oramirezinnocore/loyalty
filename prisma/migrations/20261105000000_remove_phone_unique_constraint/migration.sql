-- Remove unique constraint on (businessId, phone) to allow family accounts
-- Multiple customers can share the same phone number within a business
-- (e.g., family members with separate loyalty accounts)

DROP INDEX IF EXISTS "Customer_businessId_phone_key";
