/**
 * Permissions resolved for a member, bucketed by scope.
 * - `platform`: codes granted via PLATFORM-scoped memberships (apply everywhere)
 * - `org`: orgId -> codes granted on that organization
 * - `event`: activityId -> codes granted directly on that activity
 *
 * Org permissions cascade down to that org's events; the cascade is resolved
 * at check time in PermissionGuard (it is not pre-expanded here).
 */
export interface ScopedPermissions {
  platform: string[];
  org: Record<string, string[]>;
  event: Record<string, string[]>;
}

export const emptyScopedPermissions = (): ScopedPermissions => ({
  platform: [],
  org: {},
  event: {},
});
