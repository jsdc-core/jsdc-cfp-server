import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { ScopedPermissions } from "../types/scoped-permissions";

@Injectable()
export class PermissionsCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private permsKey(memberId: string): string {
    return `perms:${memberId}`;
  }

  private tvKey(memberId: string): string {
    return `tv:${memberId}`;
  }

  async getPermissions(
    memberId: string,
  ): Promise<ScopedPermissions | undefined> {
    return this.cacheManager.get<ScopedPermissions>(this.permsKey(memberId));
  }

  async setPermissions(
    memberId: string,
    permissions: ScopedPermissions,
  ): Promise<void> {
    await this.cacheManager.set(this.permsKey(memberId), permissions);
  }

  async getTokenVersion(memberId: string): Promise<number | undefined> {
    return this.cacheManager.get<number>(this.tvKey(memberId));
  }

  async setTokenVersion(memberId: string, version: number): Promise<void> {
    await this.cacheManager.set(this.tvKey(memberId), version);
  }

  async invalidate(memberId: string): Promise<void> {
    await this.cacheManager.del(this.permsKey(memberId));
    await this.cacheManager.del(this.tvKey(memberId));
  }

  // --- activity -> organization mapping (for org->event permission cascade) ---
  // Stores "" when the activity has no organization, undefined means cache miss.
  private actOrgKey(activityId: string): string {
    return `act_org:${activityId}`;
  }

  async getActivityOrg(activityId: string): Promise<string | undefined> {
    return this.cacheManager.get<string>(this.actOrgKey(activityId));
  }

  async setActivityOrg(
    activityId: string,
    organizationId: string | null,
  ): Promise<void> {
    await this.cacheManager.set(
      this.actOrgKey(activityId),
      organizationId ?? "",
    );
  }
}
