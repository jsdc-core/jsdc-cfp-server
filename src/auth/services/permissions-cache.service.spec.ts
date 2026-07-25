import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { PermissionsCacheService } from "./permissions-cache.service";

describe("PermissionsCacheService", () => {
  let service: PermissionsCacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as Cache;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsCacheService,
        { provide: CACHE_MANAGER, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<PermissionsCacheService>(PermissionsCacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getPermissions / setPermissions", () => {
    it("should return undefined when not cached", async () => {
      jest.spyOn(cacheManager, "get").mockResolvedValue(undefined);
      const result = await service.getPermissions("member-1");
      expect(result).toBeUndefined();
      expect(cacheManager.get).toHaveBeenCalledWith("perms:member-1");
    });

    it("should set and get permissions", async () => {
      const perms = {
        platform: ["activity:manage"],
        org: { "org-1": ["org:profile"] },
        event: {},
      };
      jest.spyOn(cacheManager, "set").mockResolvedValue(undefined);
      jest.spyOn(cacheManager, "get").mockResolvedValue(perms);

      await service.setPermissions("member-1", perms);
      const result = await service.getPermissions("member-1");

      expect(cacheManager.set).toHaveBeenCalledWith("perms:member-1", perms);
      expect(result).toEqual(perms);
    });
  });

  describe("activity -> org mapping", () => {
    it("stores empty string when the activity has no org", async () => {
      jest.spyOn(cacheManager, "set").mockResolvedValue(undefined);
      await service.setActivityOrg("act-1", null);
      expect(cacheManager.set).toHaveBeenCalledWith("act_org:act-1", "");
    });

    it("stores the org id when present", async () => {
      jest.spyOn(cacheManager, "set").mockResolvedValue(undefined);
      await service.setActivityOrg("act-1", "org-1");
      expect(cacheManager.set).toHaveBeenCalledWith("act_org:act-1", "org-1");
    });
  });

  describe("getTokenVersion / setTokenVersion", () => {
    it("should return undefined when not cached", async () => {
      jest.spyOn(cacheManager, "get").mockResolvedValue(undefined);
      const result = await service.getTokenVersion("member-1");
      expect(result).toBeUndefined();
      expect(cacheManager.get).toHaveBeenCalledWith("tv:member-1");
    });

    it("should set and get tokenVersion", async () => {
      jest.spyOn(cacheManager, "set").mockResolvedValue(undefined);
      jest.spyOn(cacheManager, "get").mockResolvedValue(2);

      await service.setTokenVersion("member-1", 2);
      const result = await service.getTokenVersion("member-1");

      expect(cacheManager.set).toHaveBeenCalledWith("tv:member-1", 2);
      expect(result).toBe(2);
    });
  });

  describe("invalidate", () => {
    it("should delete both permissions and tokenVersion keys", async () => {
      jest.spyOn(cacheManager, "del").mockResolvedValue(undefined);

      await service.invalidate("member-1");

      expect(cacheManager.del).toHaveBeenCalledWith("perms:member-1");
      expect(cacheManager.del).toHaveBeenCalledWith("tv:member-1");
    });
  });
});
