jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
  generateState: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { RoleService } from "./role.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

describe("RoleService", () => {
  let service: RoleService;
  let prisma: any;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permission: { count: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      membership: { findMany: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    const authMock = {
      bumpTokenVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authMock },
      ],
    }).compile();

    service = module.get(RoleService);
    authService = module.get(AuthService);
  });

  it("rejects duplicate role name", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "r-1" });
    await expect(
      service.create({ name: "admin", permissionIds: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates role with given permissions", async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.permission.count.mockResolvedValue(1);
    prisma.role.create.mockResolvedValue({ id: "r-1" });

    await service.create({ name: "editor", permissionIds: ["p-1"] });
    expect(prisma.role.create).toHaveBeenCalled();
  });

  it("updating permissions bumps tokenVersion of all role members", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "r-1" });
    prisma.permission.count.mockResolvedValue(1);
    prisma.role.update.mockResolvedValue({ id: "r-1" });
    prisma.membership.findMany.mockResolvedValue([
      { memberId: "m-1" },
      { memberId: "m-2" },
    ]);

    await service.update("r-1", { permissionIds: ["p-1"] });
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-1");
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-2");
  });

  it("delete throws when role not found", async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(service.delete("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("delete bumps tokenVersion of affected members", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "r-1" });
    prisma.membership.findMany.mockResolvedValue([{ memberId: "m-1" }]);

    await service.delete("r-1");
    expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-1");
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
  });
});
