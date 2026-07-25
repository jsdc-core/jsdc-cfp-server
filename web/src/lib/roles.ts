import { api } from "./api";
import type {
  CreateRoleDto,
  Role,
  RoleScope,
  UpdateRoleDto,
} from "@/types/role";

/**
 * Role CRUD. Backend routes live under `/roles` and require the platform
 * `role:manage` permission — except `GET /roles/catalog`, a dev-only public
 * endpoint that lists every role for the mock UI.
 */

/** List roles, optionally filtered by scope. Requires `role:manage`. */
export async function listRoles(scope?: RoleScope): Promise<Role[]> {
  const { data } = await api.get<Role[]>("/roles", {
    params: scope ? { scope } : undefined,
  });
  return data;
}

/**
 * List every role via the dev-only public catalog endpoint (no auth needed).
 * Filtering by scope is done client-side since the endpoint takes no params.
 */
export async function listRoleCatalog(scope?: RoleScope): Promise<Role[]> {
  const { data } = await api.get<Role[]>("/roles/catalog");
  return scope ? data.filter((role) => role.scope === scope) : data;
}

export async function createRole(dto: CreateRoleDto): Promise<Role> {
  const { data } = await api.post<Role>("/roles", dto);
  return data;
}

export async function updateRole(
  id: string,
  dto: UpdateRoleDto,
): Promise<Role> {
  const { data } = await api.patch<Role>(`/roles/${id}`, dto);
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}
