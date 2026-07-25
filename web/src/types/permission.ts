/**
 * A permission code, e.g. `event:edit`, `org:member:manage`.
 *
 * Mirrors the backend `Permission` Prisma model (see prisma/models/role.prisma).
 * Codes are colon-namespaced as `resource:action`.
 */
export type Permission = {
  id: string;
  code: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Body for `POST /permissions`. */
export type CreatePermissionDto = {
  /** Must match `resource:action`, e.g. `activity:manage`. */
  code: string;
  description?: string;
};

/** Body for `PATCH /permissions/:id` — all fields optional. */
export type UpdatePermissionDto = Partial<CreatePermissionDto>;

/** Regex enforced by the backend for permission codes. */
export const PERMISSION_CODE_PATTERN = /^[a-z0-9_-]+:[a-z0-9_-]+$/;
