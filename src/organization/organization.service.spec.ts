jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
  generateState: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

describe("OrganizationService", () => {
  let service: OrganizationService;
  let prisma: any;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      role: { findUnique: jest.fn() },
    };
    authService = {
      bumpTokenVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(OrganizationService);
  });

  describe("create", () => {
    it("creates the org with the creator as Owner and refreshes their session", async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: "owner-role" });
      prisma.organization.create.mockResolvedValue({ id: "org-1" });

      await service.create({ name: "JSDC", slug: "jsdc" }, "creator-1");

      const createArg = prisma.organization.create.mock.calls[0][0];
      expect(createArg.data.memberships.create).toEqual(
        expect.objectContaining({
          memberId: "creator-1",
          roleId: "owner-role",
          scopeType: "ORG",
        }),
      );
      expect(authService.bumpTokenVersion).toHaveBeenCalledWith("creator-1");
    });

    it("rejects a duplicate slug", async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: "existing" });
      await expect(
        service.create({ name: "X", slug: "taken" }, "creator-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("fails clearly when the Owner role is not seeded", async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ name: "X", slug: "x" }, "creator-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
