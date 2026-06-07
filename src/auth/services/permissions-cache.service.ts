import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

@Injectable()
export class PermissionsCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private permsKey(memberId: string): string {
    return `perms:${memberId}`;
  }

  private tvKey(memberId: string): string {
    return `tv:${memberId}`;
  }

  async getPermissions(memberId: string): Promise<string[] | undefined> {
    return this.cacheManager.get<string[]>(this.permsKey(memberId));
  }

  async setPermissions(memberId: string, permissions: string[]): Promise<void> {
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
}
