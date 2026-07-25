import type { Permission } from "./permission";

/**
 * Permission scope. Mirrors the backend `RoleScope` enum:
 * - `PLATFORM` — global permissions
 * - `ORG` — organization-level (cascades to that org's events)
 * - `EVENT` — activity-level
 */
export type RoleScope = "PLATFORM" | "ORG" | "EVENT";

export const ROLE_SCOPES: RoleScope[] = ["PLATFORM", "ORG", "EVENT"];

/** Human-friendly labels for each scope. */
export const ROLE_SCOPE_LABELS: Record<RoleScope, string> = {
  PLATFORM: "平台",
  ORG: "組織",
  EVENT: "活動",
};

/** Join-row shape returned by the API: `permissions[].permission`. */
export type RolePermission = {
  role_id: string;
  permission_id: string;
  permission: Permission;
};

/**
 * A role with its attached permissions.
 *
 * Mirrors `GET /roles` / `GET /roles/catalog`, which include
 * `permissions: { include: { permission: true } }`.
 */
export type Role = {
  id: string;
  name: string;
  scope: RoleScope;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: RolePermission[];
};

/** Body for `POST /roles`. */
export type CreateRoleDto = {
  name: string;
  scope?: RoleScope;
  description?: string;
  /** Permission IDs (UUIDs) to attach to the role. */
  permissionIds: string[];
};

/** Body for `PATCH /roles/:id` — all fields optional. */
export type UpdateRoleDto = Partial<CreateRoleDto>;
