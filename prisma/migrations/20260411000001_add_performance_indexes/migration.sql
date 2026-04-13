-- Performance indexes for property listing queries
CREATE INDEX IF NOT EXISTS "properties_approvalStatus_isAvailable_deletedAt_idx"
  ON "properties" ("approvalStatus", "isAvailable", "deletedAt");

CREATE INDEX IF NOT EXISTS "properties_ownerId_idx"
  ON "properties" ("ownerId");

CREATE INDEX IF NOT EXISTS "properties_createdAt_idx"
  ON "properties" ("createdAt" DESC);

-- Media join indexes
CREATE INDEX IF NOT EXISTS "property_media_propertyId_idx"
  ON "property_media" ("propertyId");

CREATE INDEX IF NOT EXISTS "property_media_propertyId_mediaType_idx"
  ON "property_media" ("propertyId", "mediaType");
