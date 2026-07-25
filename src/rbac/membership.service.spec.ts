jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
  generateState: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MembershipService } from "./membership.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

describe("MembershipService", () => {
  let service: MembershipService;
  let prisma: any;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    prisma = {
      member: { findUnique: jest.fn().mockResolvedValue({ id: "m-1" }) },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: "org-1" }),
      },
      activity: { findUnique: jest.fn().mockResolvedValue({ id: "act-1" }) },
      role: { findMany: jest.fn() },
      membership: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    authService = {
      bumpTokenVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(MembershipService);
  });

  it("replaces org roles, scoping the write and bumping the member", async () => {
    prisma.role.findMany.mockResolvedValue([{ id: "r-1", scope: "ORG" }]);

    await service.replaceForOrg("org-1", "m-1", ["r-1"]);

    expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
      where: {
        memberId: "m-1",
        scopeType: "ORG",
        organizationId: "org-1",
        activityId: null,
      },
    });
    expect(prisma.membership.createMany).toHaveBeenCalled();
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-1");
  });

  it("rejects roles whose scope does not match the target scope", async () => {
    prisma.role.findMany.mockResolvedValue([{ id: "r-1", scope: "EVENT" }]);

    await expect(
      service.replaceForOrg("org-1", "m-1", ["r-1"]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown role ids", async () => {
    prisma.role.findMany.mockResolvedValue([]); // none found

    await expect(
      service.replaceForActivity("act-1", "m-1", ["missing"]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
