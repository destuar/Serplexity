-- Idempotent DDL for team models
DO $$ BEGIN
  CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TeamMember" (
  id TEXT PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL,
  "memberUserId" TEXT NOT NULL,
  role "TeamRole" NOT NULL DEFAULT 'MEMBER',
  status "TeamMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedAt" TIMESTAMP NULL,
  "acceptedAt" TIMESTAMP NULL,
  "removedAt" TIMESTAMP NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT team_member_owner_fk FOREIGN KEY ("ownerUserId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT team_member_member_fk FOREIGN KEY ("memberUserId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT team_member_unique UNIQUE ("ownerUserId", "memberUserId")
);

CREATE INDEX IF NOT EXISTS "TeamMember_owner_idx" ON "TeamMember" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "TeamMember_member_idx" ON "TeamMember" ("memberUserId");
CREATE INDEX IF NOT EXISTS "TeamMember_status_idx" ON "TeamMember" (status);

CREATE TABLE IF NOT EXISTS "TeamInvite" (
  id TEXT PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL,
  email TEXT NOT NULL,
  role "TeamRole" NOT NULL DEFAULT 'MEMBER',
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "consumedAt" TIMESTAMP NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT team_invite_owner_fk FOREIGN KEY ("ownerUserId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TeamInvite_owner_idx" ON "TeamInvite" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "TeamInvite_email_idx" ON "TeamInvite" (email);
