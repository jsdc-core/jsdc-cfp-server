import type { RoleScope } from "./role";

/**
 * A platform member. Mirrors the backend `Member` Prisma model (public fields).
 * Reserved for the upcoming 成員管理 (member management) page.
 */
export type MemberStatus = "ACTIVE" | "BANNED";

export type Member = {
  id: string;
  email: string;
  displayName?: string | null;
  location?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
};

/** Body for `POST /members`. */
export type CreateMemberDto = {
  email: string;
  displayName?: string;
  location?: string;
  jobTitle?: string;
  status?: MemberStatus;
};

/** Body for `PATCH /members/:id`. All fields optional. */
export type UpdateMemberDto = Partial<CreateMemberDto>;

/**
 * A member's role assignment within a scope. Mirrors the backend `Membership`
 * join model. Reserved for the member management page.
 */
export type Membership = {
  id: string;
  memberId: string;
  roleId: string;
  scopeType: RoleScope;
  organizationId?: string | null;
  activityId?: string | null;
};

/** Body for `PUT /organizations/:orgId/members/:memberId/roles`. */
export type AssignRolesDto = {
  roleIds: string[];
};

/**
 * A role as summarized inside {@link MemberWithRoles} — the subset the
 * `GET /members/organization/:orgId` endpoint returns per membership
 * (`role: { select: { id, name, scope } }`). For the full role shape
 * (with permissions) use {@link import("./role").Role}.
 */
export type MemberRoleSummary = {
  id: string;
  name: string;
  scope: RoleScope;
};

/**
 * A member together with the roles they hold in a given scope. Mirrors the
 * grouped result of `GET /members/organization/:orgId`, which merges every
 * ORG-scoped membership row for a member into a single `{ member, roles }`.
 */
export type MemberWithRoles = {
  member: {
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    createdAt: string;
  };
  roles: MemberRoleSummary[];
};
