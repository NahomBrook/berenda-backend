-- Add rejectionReason and appealMessage columns to properties table
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "appealMessage" TEXT;
