jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsCacheService } from "./services/permissions-cache.service";
import { RefreshTokenService } from "./services/refresh-token.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let permissionsCache: jest.Mocked<PermissionsCacheService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;

  beforeEach(async () => {
    const prismaMock = {
      membership: {
        findMany: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      memberProvider: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const jwtServiceMock = {
      signAsync: jest.fn().mockResolvedValue("mock-token"),
    } as unknown as jest.Mocked<JwtService>;

    const permissionsCacheMock = {
      setPermissions: jest.fn().mockResolvedValue(undefined),
      setTokenVersion: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PermissionsCacheService>;

    const refreshTokenServiceMock = {
      issue: jest.fn().mockResolvedValue("mock-refresh-token"),
      revokeAllForMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RefreshTokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        {
          provide: PermissionsCacheService,
          useValue: permissionsCacheMock,
        },
        { provide: RefreshTokenService, useValue: refreshTokenServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    permissionsCache = module.get(PermissionsCacheService);
    refreshTokenService = module.get(RefreshTokenService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  const membershipWith = (
    scopeType: string,
    codes: string[],
    ids: { organizationId?: string; activityId?: string } = {},
  ) =>
    ({
      scopeType,
      organizationId: ids.organizationId ?? null,
      activityId: ids.activityId ?? null,
      role: { permissions: codes.map((code) => ({ permission: { code } })) },
    }) as any;

  describe("getScopedPermissions", () => {
    it("buckets permissions by scope and dedupes platform codes", async () => {
      prisma.membership.findMany.mockResolvedValue([
        membershipWith("PLATFORM", ["activity:manage", "role:manage"]),
        membershipWith("PLATFORM", ["activity:manage"]),
        membershipWith("ORG", ["org:profile"], { organizationId: "org-1" }),
        membershipWith("EVENT", ["event:edit"], { activityId: "act-1" }),
      ]);

      const result = await service.getScopedPermissions("member-1");

      expect(result.platform.sort()).toEqual([
        "activity:manage",
        "role:manage",
      ]);
      expect(result.org).toEqual({ "org-1": ["org:profile"] });
      expect(result.event).toEqual({ "act-1": ["event:edit"] });
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { memberId: "member-1" } }),
      );
    });

    it("returns empty buckets when the member has no memberships", async () => {
      prisma.membership.findMany.mockResolvedValue([]);
      const result = await service.getScopedPermissions("member-1");
      expect(result).toEqual({ platform: [], org: {}, event: {} });
    });
  });

  describe("devLogin", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("should create member and cache permissions on first login", async () => {
      const member = {
        id: "member-1",
        email: "test@example.com",
        tokenVersion: 1,
      } as any;

      prisma.member.findUnique.mockResolvedValue(null);
      prisma.member.create.mockResolvedValue(member);
      prisma.member.findUniqueOrThrow.mockResolvedValue(member);
      prisma.membership.findMany.mockResolvedValue([]);

      const result = await service.devLogin("test@example.com");

      expect(prisma.member.create).toHaveBeenCalled();
      expect(permissionsCache.setPermissions).toHaveBeenCalledWith("member-1", {
        platform: [],
        org: {},
        event: {},
      });
      expect(permissionsCache.setTokenVersion).toHaveBeenCalledWith(
        "member-1",
        1,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: "member-1",
        v: 1,
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith("member-1");
      expect(result.access_token).toBe("mock-token");
      expect(result.refresh_token).toBe("mock-refresh-token");
      expect(result.user.id).toBe("member-1");
    });

    it("should use existing member and update cache on subsequent login", async () => {
      const member = {
        id: "member-1",
        email: "test@example.com",
        tokenVersion: 1,
      } as any;

      prisma.member.findUnique.mockResolvedValue(member);
      prisma.member.findUniqueOrThrow.mockResolvedValue(member);
      prisma.membership.findMany.mockResolvedValue([
        membershipWith("PLATFORM", ["activity:manage"]),
      ]);

      await service.devLogin("test@example.com");

      expect(prisma.member.create).not.toHaveBeenCalled();
      expect(permissionsCache.setPermissions).toHaveBeenCalledWith("member-1", {
        platform: ["activity:manage"],
        org: {},
        event: {},
      });
      expect(permissionsCache.setTokenVersion).toHaveBeenCalledWith(
        "member-1",
        1,
      );
    });

    it("should throw in production", async () => {
      process.env.NODE_ENV = "production";

      await expect(service.devLogin("test@example.com")).rejects.toThrow(
        "This endpoint is only available in development",
      );
    });
  });

  describe("bumpTokenVersion", () => {
    it("should increment tokenVersion, invalidate cache, update cache, and revoke refresh tokens", async () => {
      prisma.member.update.mockResolvedValue({
        id: "member-1",
        tokenVersion: 3,
      } as any);

      await service.bumpTokenVersion("member-1");

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(permissionsCache.invalidate).toHaveBeenCalledWith("member-1");
      expect(permissionsCache.setTokenVersion).toHaveBeenCalledWith(
        "member-1",
        3,
      );
      expect(refreshTokenService.revokeAllForMember).toHaveBeenCalledWith(
        "member-1",
      );
    });
  });

  describe("invalidateUserCache", () => {
    it("should clear cache for a member", async () => {
      await service.invalidateUserCache("member-1");

      expect(permissionsCache.invalidate).toHaveBeenCalledWith("member-1");
    });
  });
});
