jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
  generateState: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { PermissionService } from "./permission.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

describe("PermissionService", () => {
  let service: PermissionService;
  let prisma: any;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    prisma = {
      permission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      member: { findMany: jest.fn() },
    };
    const authMock = {
      bumpTokenVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authMock },
      ],
    }).compile();

    service = module.get(PermissionService);
    authService = module.get(AuthService);
  });

  it("rejects duplicate code", async () => {
    prisma.permission.findUnique.mockResolvedValue({ id: "p-1" });
    await expect(service.create({ code: "x:y" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("creates permission with new code", async () => {
    prisma.permission.findUnique.mockResolvedValue(null);
    prisma.permission.create.mockResolvedValue({ id: "p-1", code: "x:y" });
    const result = await service.create({ code: "x:y" });
    expect(result.code).toBe("x:y");
  });

  it("delete bumps tokenVersion of every member with the permission", async () => {
    prisma.permission.findUnique.mockResolvedValue({ id: "p-1" });
    prisma.member.findMany.mockResolvedValue([{ id: "m-1" }, { id: "m-2" }]);
    await service.delete("p-1");
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-1");
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-2");
    expect(prisma.permission.delete).toHaveBeenCalled();
  });
});
