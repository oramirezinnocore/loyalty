-- Add ARCHIVED status to LoyaltyProgramStatus enum
-- This migration is backward compatible: existing programs remain DRAFT/ACTIVE/PAUSED
-- NO data is modified, only the enum type is extended

ALTER TYPE "LoyaltyProgramStatus" ADD VALUE 'ARCHIVED';
