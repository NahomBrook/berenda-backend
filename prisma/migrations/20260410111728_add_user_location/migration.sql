-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLatitude" DOUBLE PRECISION,
                    ADD COLUMN "lastLongitude" DOUBLE PRECISION,
                    ADD COLUMN "lastLocationAt" TIMESTAMP(3);
