jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
  generateState: jest.fn(),
}));

import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  GoneException,
  ConflictException,
} from "@nestjs/common";
import { InvitationService } from "./invitation.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { MailService } from "./mail.service";

describe("InvitationService", () => {
  let service: InvitationService;
  let prisma: any;
  let authService: jest.Mocked<AuthService>;
  let mail: jest.Mocked<MailService>;

  beforeEach(async () => {
    prisma = {
      organization: { findUnique: jest.fn() },
      activity: { findUnique: jest.fn() },
      role: { findUnique: jest.fn() },
      member: { findUnique: jest.fn() },
      membership: { findFirst: jest.fn(), create: jest.fn() },
      invitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    authService = {
      bumpTokenVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;
    mail = {
      sendInvitation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(InvitationService);
  });

  describe("inviteToOrg", () => {
    it("creates a PENDING invitation with a ~7 day expiry and emails it", async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      prisma.role.findUnique.mockResolvedValue({ scope: "ORG" });
      prisma.invitation.create.mockImplementation(({ data }: any) => ({
        ...data,
      }));

      const before = Date.now();
      const inv = await service.inviteToOrg(
        "org-1",
        { email: "Foo@Example.com", roleId: "role-1" },
        "admin-1",
      );

      expect(inv.email).toBe("foo@example.com"); // normalised
      expect(inv.status).toBe("PENDING");
      const ttl = new Date(inv.expiresAt).getTime() - before;
      expect(ttl).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
      expect(ttl).toBeLessThan(7.1 * 24 * 3600 * 1000);
      expect(mail.sendInvitation).toHaveBeenCalled();
    });

    it("rejects a role whose scope does not match", async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
      prisma.role.findUnique.mockResolvedValue({ scope: "EVENT" });

      await expect(
        service.inviteToOrg(
          "org-1",
          { email: "a@b.com", roleId: "role-1" },
          "admin-1",
        ),
      ).rejects.toThrow(/ORG-scoped/);
    });
  });

  describe("accept", () => {
    const pending = {
      id: "inv-1",
      email: "invitee@example.com",
      roleId: "role-1",
      scopeType: "ORG",
      organizationId: "org-1",
      activityId: null,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    };

    it("creates the membership and bumps the accepting member", async () => {
      prisma.invitation.findUnique.mockResolvedValue({ ...pending });
      prisma.member.findUnique.mockResolvedValue({
        id: "m-1",
        email: "invitee@example.com",
      });
      prisma.membership.findFirst.mockResolvedValue(null);

      const res = await service.accept("tok", "m-1");

      expect(res).toEqual({ ok: true });
      expect(prisma.membership.create).toHaveBeenCalled();
      expect(prisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACCEPTED" }),
        }),
      );
      expect(authService.bumpTokenVersion).toHaveBeenCalledWith("m-1");
    });

    it("forbids accepting with a mismatched email", async () => {
      prisma.invitation.findUnique.mockResolvedValue({ ...pending });
      prisma.member.findUnique.mockResolvedValue({
        id: "m-1",
        email: "someone-else@example.com",
      });

      await expect(service.accept("tok", "m-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("returns 410 (Gone) and marks EXPIRED for an expired invite", async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        ...pending,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.accept("tok", "m-1")).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(prisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "EXPIRED" }),
        }),
      );
    });

    it("rejects a non-pending invitation", async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        ...pending,
        status: "ACCEPTED",
      });

      await expect(service.accept("tok", "m-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
