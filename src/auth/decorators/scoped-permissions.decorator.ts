import { SetMetadata } from "@nestjs/common";

export type PermissionScope = "PLATFORM" | "ORG" | "EVENT";

export interface ScopedPermissionRequirement {
  /** Which scope the required permissions must be satisfied in. */
  scope: PermissionScope;
  /** Permission codes required (all must be granted). */
  perms: string[];
  /**
   * Route param holding the scope id. Required for ORG/EVENT.
   * e.g. param: "activityId" reads `req.params.activityId`.
   */
  param?: string;
}

export const SCOPED_PERMISSIONS_KEY = "scoped_permissions";

/**
 * Require permissions within a given scope. The PermissionGuard resolves the
 * scope id from the route param and checks the matching permission bucket.
 *
 * PLATFORM permissions always satisfy any scope; ORG permissions cascade down
 * to that org's events.
 *
 * @example
 * @RequirePermissions({ scope: "EVENT", param: "activityId", perms: ["event:edit"] })
 */
export const RequirePermissions = (req: ScopedPermissionRequirement) =>
  SetMetadata(SCOPED_PERMISSIONS_KEY, req);
