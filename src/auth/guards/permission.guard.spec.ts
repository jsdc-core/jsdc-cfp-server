import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { PermissionGuard } from "./permission.guard";
import { AuthUser } from "../strategies/jwt.strategy";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsCacheService } from "../services/permissions-cache.service";
import {
  SCOPED_PERMISSIONS_KEY,
  ScopedPermissionRequirement,
} from "../decorators/scoped-permissions.decorator";
import { ScopedPermissions } from "../types/scoped-permissions";

describe("PermissionGuard", () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<PermissionsCacheService>;

  const context = (
    user: AuthUser | undefined,
    params: Record<string, string> = {},
  ): ExecutionContext => {
    const request = { user, params };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  const setMetadata = (
    scoped?: ScopedPermissionRequirement,
    legacy?: string[],
  ) => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === SCOPED_PERMISSIONS_KEY ? scoped : legacy,
    );
  };

  const user = (permissions: Partial<ScopedPermissions>): AuthUser => ({
    id: "member-1",
    tokenVersion: 1,
    permissions: { platform: [], org: {}, event: {}, ...permissions },
  });

  beforeEach(async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    const prismaMock = {
      activity: { findUnique: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;
    const cacheMock = {
      getActivityOrg: jest.fn().mockResolvedValue(undefined),
      setActivityOrg: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PermissionsCacheService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: PermissionsCacheService, useValue: cacheMock },
      ],
    }).compile();

    guard = module.get(PermissionGuard);
    reflector = module.get(Reflector);
    prisma = module.get(PrismaService);
    cache = module.get(PermissionsCacheService);
  });

  it("allows when no permissions are required", async () => {
    setMetadata(undefined, undefined);
    expect(await guard.canActivate(context(undefined))).toBe(true);
  });

  it("denies when user is not authenticated", async () => {
    setMetadata(undefined, ["activity:manage"]);
    expect(await guard.canActivate(context(undefined))).toBe(false);
  });

  describe("legacy @Permissions (platform scope)", () => {
    it("allows when platform bucket has all codes", async () => {
      setMetadata(undefined, ["activity:manage"]);
      const ctx = context(user({ platform: ["activity:manage"] }));
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it("denies when a platform code is missing", async () => {
      setMetadata(undefined, ["activity:manage", "role:manage"]);
      const ctx = context(user({ platform: ["activity:manage"] }));
      expect(await guard.canActivate(ctx)).toBe(false);
    });
  });

  describe("ORG scope", () => {
    const req: ScopedPermissionRequirement = {
      scope: "ORG",
      param: "orgId",
      perms: ["org:member:manage"],
    };

    it("allows when the org bucket grants the permission", async () => {
      setMetadata(req);
      const ctx = context(user({ org: { "org-1": ["org:member:manage"] } }), {
        orgId: "org-1",
      });
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it("allows when a platform grant covers it", async () => {
      setMetadata(req);
      const ctx = context(user({ platform: ["org:member:manage"] }), {
        orgId: "org-1",
      });
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it("denies when the org bucket lacks it", async () => {
      setMetadata(req);
      const ctx = context(user({ org: { "org-2": ["org:member:manage"] } }), {
        orgId: "org-1",
      });
      expect(await guard.canActivate(ctx)).toBe(false);
    });
  });

  describe("EVENT scope", () => {
    const req: ScopedPermissionRequirement = {
      scope: "EVENT",
      param: "activityId",
      perms: ["event:edit"],
    };

    it("allows on a direct event grant", async () => {
      setMetadata(req);
      const ctx = context(user({ event: { "act-1": ["event:edit"] } }), {
        activityId: "act-1",
      });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(prisma.activity.findUnique).not.toHaveBeenCalled();
    });

    it("cascades to the activity's organization", async () => {
      setMetadata(req);
      prisma.activity.findUnique.mockResolvedValue({
        organizationId: "org-1",
      } as any);
      const ctx = context(user({ org: { "org-1": ["event:edit"] } }), {
        activityId: "act-1",
      });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(cache.setActivityOrg).toHaveBeenCalledWith("act-1", "org-1");
    });

    it("denies when neither event nor parent org grants it", async () => {
      setMetadata(req);
      prisma.activity.findUnique.mockResolvedValue({
        organizationId: "org-1",
      } as any);
      const ctx = context(user({ org: { "org-1": ["event:report"] } }), {
        activityId: "act-1",
      });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it("uses the cached activity->org mapping when present", async () => {
      setMetadata(req);
      cache.getActivityOrg.mockResolvedValue("org-1");
      const ctx = context(user({ org: { "org-1": ["event:edit"] } }), {
        activityId: "act-1",
      });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(prisma.activity.findUnique).not.toHaveBeenCalled();
    });
  });
});
