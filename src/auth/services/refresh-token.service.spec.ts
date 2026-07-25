import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import {
  RefreshTokenService,
  RefreshTokenReuseError,
} from "./refresh-token.service";
import { PrismaService } from "../../prisma/prisma.service";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(RefreshTokenService);
    prisma = module.get(PrismaService);
  });

  describe("issue", () => {
    it("creates a refresh token with hashed value", async () => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      const raw = await service.issue("m-1");

      expect(typeof raw).toBe("string");
      expect(raw.length).toBeGreaterThan(20);
      const call = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];
      expect(call.data.memberId).toBe("m-1");
      expect(call.data.tokenHash).toBe(sha(raw));
      expect(call.data.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("rotate", () => {
    it("rejects when token is unknown", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.rotate("nope")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws RefreshTokenReuseError when token already revoked", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: "rt-1",
        memberId: "m-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.rotate("stale")).rejects.toBeInstanceOf(
        RefreshTokenReuseError,
      );
    });

    it("rejects when token is expired", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: "rt-1",
        memberId: "m-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.rotate("old")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("issues a new token and revokes the old on happy path", async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: "rt-1",
        memberId: "m-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: "rt-2",
      });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});

      const result = await service.rotate("valid");
      expect(result.memberId).toBe("m-1");
      expect(typeof result.rawToken).toBe("string");
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date), replacedBy: "rt-2" },
      });
    });
  });

  describe("revoke", () => {
    it("marks the matching token revoked", async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      await service.revoke("raw");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha("raw"), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("revokeAllForMember", () => {
    it("revokes all active tokens for a member", async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
      await service.revokeAllForMember("m-1");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { memberId: "m-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
