-- Idempotent SQL to add DeviceType enum and UserSession table
DO $$ BEGIN
  CREATE TYPE "DeviceType" AS ENUM ('WEB', 'MOBILE', 'DESKTOP', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserSession" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deviceType" "DeviceType" NOT NULL DEFAULT 'WEB',
  "userAgent" TEXT NULL,
  "ipAddress" TEXT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMP NULL,
  "revokedAt" TIMESTAMP NULL,
  CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession" ("userId");
CREATE INDEX IF NOT EXISTS "UserSession_userId_revoked_idx" ON "UserSession" ("userId", "revokedAt");

