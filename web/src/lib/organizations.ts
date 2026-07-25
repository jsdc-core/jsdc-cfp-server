import { api } from "./api";
import type { Organization } from "@/types/organization";
import type { AssignRolesDto } from "@/types/member";
import type { Role } from "@/types/role";

/**
 * Organization list + member-role assignment. `GET /organizations` returns the
 * organizations the current member belongs to.
 */

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>("/organizations");
  return data;
}

/**
 * Replace a member's ORG-scoped roles.
 * `PUT /organizations/:orgId/members/:memberId/roles` — requires
 * `org:member:manage` in that org. Reserved for the member management page.
 */
export async function replaceOrgMemberRoles(
  orgId: string,
  memberId: string,
  dto: AssignRolesDto,
): Promise<Role[]> {
  const { data } = await api.put<Role[]>(
    `/organizations/${orgId}/members/${memberId}/roles`,
    dto,
  );
  return data;
}
