jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy, JwtPayloadToken } from "./jwt.strategy";
import { PermissionsCacheService } from "../services/permissions-cache.service";
import { AuthService } from "../auth.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let permissionsCache: jest.Mocked<PermissionsCacheService>;
  let prisma: jest.Mocked<PrismaService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const permissionsCacheMock = {
      getTokenVersion: jest.fn(),
      setTokenVersion: jest.fn(),
      getPermissions: jest.fn(),
      setPermissions: jest.fn(),
    } as unknown as jest.Mocked<PermissionsCacheService>;

    const prismaMock = {
      member: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const authServiceMock = {
      getUserPermissions: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("test-secret") },
        },
        { provide: PermissionsCacheService, useValue: permissionsCacheMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    permissionsCache = module.get(
      PermissionsCacheService,
    ) as jest.Mocked<PermissionsCacheService>;
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  describe("validate", () => {
    it("should return AuthUser when tokenVersion matches and permissions are cached", async () => {
      const payload: JwtPayloadToken = { sub: "member-1", v: 1 };
      const cachedPermissions = ["activity:manage"];

      permissionsCache.getTokenVersion.mockResolvedValue(1);
      permissionsCache.getPermissions.mockResolvedValue(cachedPermissions);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: "member-1",
        permissions: cachedPermissions,
        tokenVersion: 1,
      });
      expect(permissionsCache.getTokenVersion).toHaveBeenCalledWith("member-1");
      expect(permissionsCache.getPermissions).toHaveBeenCalledWith("member-1");
    });

    it("should fallback to DB when tokenVersion is not cached", async () => {
      const payload: JwtPayloadToken = { sub: "member-1", v: 1 };
      const cachedPermissions = ["activity:manage"];

      permissionsCache.getTokenVersion.mockResolvedValue(undefined);
      prisma.member.findUnique.mockResolvedValue({
        tokenVersion: 1,
      } as any);
      permissionsCache.setTokenVersion.mockResolvedValue(undefined);
      permissionsCache.getPermissions.mockResolvedValue(cachedPermissions);

      const result = await strategy.validate(payload);

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: "member-1" },
        select: { tokenVersion: true },
      });
      expect(permissionsCache.setTokenVersion).toHaveBeenCalledWith("member-1", 1);
      expect(result.tokenVersion).toBe(1);
    });

    it("should fallback to DB when permissions are not cached", async () => {
      const payload: JwtPayloadToken = { sub: "member-1", v: 1 };
      const dbPermissions = ["activity:manage", "submission:read"];

      permissionsCache.getTokenVersion.mockResolvedValue(1);
      permissionsCache.getPermissions.mockResolvedValue(undefined);
      authService.getUserPermissions.mockResolvedValue(dbPermissions);
      permissionsCache.setPermissions.mockResolvedValue(undefined);

      const result = await strategy.validate(payload);

      expect(authService.getUserPermissions).toHaveBeenCalledWith("member-1");
      expect(permissionsCache.setPermissions).toHaveBeenCalledWith("member-1", dbPermissions);
      expect(result.permissions).toEqual(dbPermissions);
    });

    it("should throw UnauthorizedException when tokenVersion mismatches", async () => {
      const payload: JwtPayloadToken = { sub: "member-1", v: 1 };

      permissionsCache.getTokenVersion.mockResolvedValue(2);

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException("Token has been revoked"),
      );
    });

    it("should throw UnauthorizedException when user no longer exists", async () => {
      const payload: JwtPayloadToken = { sub: "member-1", v: 1 };

      permissionsCache.getTokenVersion.mockResolvedValue(undefined);
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException("User no longer exists"),
      );
    });
  });
});
