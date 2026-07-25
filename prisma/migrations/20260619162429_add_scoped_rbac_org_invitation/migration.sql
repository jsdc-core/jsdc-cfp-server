-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'ORG', 'EVENT');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "scope" "RoleScope" NOT NULL DEFAULT 'PLATFORM';

-- DropIndex
DROP INDEX "roles_name_key";

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_type" "RoleScope" NOT NULL,
    "organization_id" UUID,
    "activity_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "scope_type" "RoleScope" NOT NULL,
    "organization_id" UUID,
    "activity_id" UUID,
    "role_id" UUID NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_member_id_idx" ON "memberships"("member_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- CreateIndex
CREATE INDEX "memberships_activity_id_idx" ON "memberships"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_member_id_role_id_scope_type_organization_id_ac_key" ON "memberships"("member_id", "role_id", "scope_type", "organization_id", "activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "invitations_activity_id_idx" ON "invitations"("activity_id");

-- CreateIndex
CREATE INDEX "activities_organization_id_idx" ON "activities"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_scope_key" ON "roles"("name", "scope");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: carry existing global member_roles over as PLATFORM-scoped memberships
-- (so current platform admins keep their access after the cutover).
INSERT INTO "memberships" ("id", "member_id", "role_id", "scope_type", "created_at", "updated_at")
SELECT gen_random_uuid(), "member_id", "role_id", 'PLATFORM', "created_at", "updated_at"
FROM "member_roles";

-- DropForeignKey
ALTER TABLE "member_roles" DROP CONSTRAINT "member_roles_member_id_fkey";

-- DropForeignKey
ALTER TABLE "member_roles" DROP CONSTRAINT "member_roles_role_id_fkey";

-- DropTable
DROP TABLE "member_roles";
