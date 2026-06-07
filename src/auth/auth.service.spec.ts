jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsCacheService } from "./services/permissions-cache.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let permissionsCache: jest.Mocked<PermissionsCacheService>;

  beforeEach(async () => {
    const prismaMock = {
      rolePermission: {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        {
          provide: PermissionsCacheService,
          useValue: permissionsCacheMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    permissionsCache = module.get(
      PermissionsCacheService,
    ) as jest.Mocked<PermissionsCacheService>;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUserPermissions", () => {
    it("should return deduplicated permission codes for a member", async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        {
          permission: { code: "activity:manage" },
        } as any,
        {
          permission: { code: "submission:read" },
        } as any,
        {
          permission: { code: "activity:manage" },
        } as any,
      ]);

      const result = await service.getUserPermissions("member-1");

      expect(result).toEqual(["activity:manage", "submission:read"]);
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: {
              members: {
                some: { memberId: "member-1" },
              },
            },
          },
          include: { permission: true },
        }),
      );
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
      prisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await service.devLogin("test@example.com");

      expect(prisma.member.create).toHaveBeenCalled();
      expect(permissionsCache.setPermissions).toHaveBeenCalledWith(
        "member-1",
        [],
      );
      expect(permissionsCache.setTokenVersion).toHaveBeenCalledWith(
        "member-1",
        1,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: "member-1",
        v: 1,
      });
      expect(result.access_token).toBe("mock-token");
      expect(result.user.id).toBe("member-1");
    });

    it("should use existing member and update cache on subsequent login", async () => {
      const member = {
        id: "member-1",
        email: "test@example.com",
        tokenVersion: 1,
      } as any;

      prisma.member.findUnique.mockResolvedValue(member);
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { code: "activity:manage" } } as any,
      ]);

      await service.devLogin("test@example.com");

      expect(prisma.member.create).not.toHaveBeenCalled();
      expect(permissionsCache.setPermissions).toHaveBeenCalledWith(
        "member-1",
        ["activity:manage"],
      );
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
    it("should increment tokenVersion, invalidate cache, and update cache", async () => {
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
    });
  });

  describe("invalidateUserCache", () => {
    it("should clear cache for a member", async () => {
      await service.invalidateUserCache("member-1");

      expect(permissionsCache.invalidate).toHaveBeenCalledWith("member-1");
    });
  });
});
