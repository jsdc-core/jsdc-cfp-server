import { api } from "./api";
import type { MemberWithRoles } from "@/types/member";

/**
 * Organization member ↔ role assignment.
 *
 * - `GET /members/organization/:orgId` lists the org's members with their
 *   ORG-scoped roles (requires `org:member:manage` in that org).
 * - `PUT /organizations/:orgId/members/:memberId/roles` replaces a member's
 *   ORG-scoped roles wholesale (same permission).
 */
export const orgMembersApi = {
  /** List an organization's members, each with their current ORG roles. */
  listByOrg: (orgId: string): Promise<MemberWithRoles[]> =>
    api
      .get<MemberWithRoles[]>(`/members/organization/${orgId}`)
      .then((r) => r.data),

  /** Replace a member's ORG-scoped roles with `roleIds` (full set, not delta). */
  updateRoles: (orgId: string, memberId: string, roleIds: string[]) =>
    api.put(`/organizations/${orgId}/members/${memberId}/roles`, { roleIds }),
};
