import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { withId } from "src/common/utils/db.util";
import { RoleScope, InvitationStatus } from "../../generated/prisma/enums";
import { MailService } from "./mail.service";
import { CreateInvitationDto } from "./dto/invitation.dto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (KKTIX behaviour)

interface InviteScope {
  scopeType: RoleScope;
  organizationId?: string;
  activityId?: string;
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mail: MailService,
  ) {}

  inviteToOrg(orgId: string, dto: CreateInvitationDto, invitedById: string) {
    return this.invite(
      { scopeType: RoleScope.ORG, organizationId: orgId },
      dto,
      invitedById,
    );
  }

  inviteToActivity(
    activityId: string,
    dto: CreateInvitationDto,
    invitedById: string,
  ) {
    return this.invite(
      { scopeType: RoleScope.EVENT, activityId },
      dto,
      invitedById,
    );
  }

  listForOrg(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: { scopeType: RoleScope.ORG, organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  listForActivity(activityId: string) {
    return this.prisma.invitation.findMany({
      where: { scopeType: RoleScope.EVENT, activityId },
      orderBy: { createdAt: "desc" },
    });
  }

  private async invite(
    scope: InviteScope,
    dto: CreateInvitationDto,
    invitedById: string,
  ) {
    await this.assertScopeAndRole(scope, dto.roleId);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invitation = await this.prisma.invitation.create({
      data: withId({
        email: dto.email.toLowerCase(),
        token,
        status: InvitationStatus.PENDING,
        scopeType: scope.scopeType,
        organizationId: scope.organizationId ?? null,
        activityId: scope.activityId ?? null,
        roleId: dto.roleId,
        invitedById,
        expiresAt,
      }),
    });

    await this.mail.sendInvitation({
      to: invitation.email,
      scopeLabel: await this.scopeLabel(scope),
      acceptUrl: this.acceptUrl(token),
      expiresAt,
    });

    return invitation;
  }

  /** Accept an invitation. The caller's email must match the invitee. */
  async accept(token: string, memberId: string) {
    const invitation = await this.loadPending(token);
    const member = await this.loadMember(memberId);
    this.assertRecipient(invitation.email, member.email);

    const existing = await this.prisma.membership.findFirst({
      where: {
        memberId,
        roleId: invitation.roleId,
        scopeType: invitation.scopeType,
        organizationId: invitation.organizationId,
        activityId: invitation.activityId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.membership.create({
          data: withId({
            memberId,
            roleId: invitation.roleId,
            scopeType: invitation.scopeType,
            organizationId: invitation.organizationId,
            activityId: invitation.activityId,
          }),
        });
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
      });
    });

    // New permissions → refresh the accepting member's session.
    await this.authService.bumpTokenVersion(memberId);
    return { ok: true };
  }

  async reject(token: string, memberId: string) {
    const invitation = await this.loadPending(token);
    const member = await this.loadMember(memberId);
    this.assertRecipient(invitation.email, member.email);
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REJECTED, respondedAt: new Date() },
    });
    return { ok: true };
  }

  private async loadMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, email: true },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  /** Re-send a pending/expired invitation with a fresh token and 7-day window. */
  async resend(id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException("Invitation has already been accepted");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const updated = await this.prisma.invitation.update({
      where: { id },
      data: {
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
        respondedAt: null,
      },
    });

    await this.mail.sendInvitation({
      to: updated.email,
      scopeLabel: await this.scopeLabel(updated),
      acceptUrl: this.acceptUrl(token),
      expiresAt,
    });
    return updated;
  }

  async revoke(id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    await this.prisma.invitation.delete({ where: { id } });
    return { ok: true };
  }

  /** Loads a token, enforcing the PENDING + not-expired state machine. */
  private async loadPending(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        `Invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException("Invitation has expired");
    }
    return invitation;
  }

  private assertRecipient(invitedEmail: string, userEmail: string) {
    if (invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        "This invitation was issued to a different email address",
      );
    }
  }

  private async assertScopeAndRole(scope: InviteScope, roleId: string) {
    if (scope.scopeType === RoleScope.ORG) {
      const org = await this.prisma.organization.findUnique({
        where: { id: scope.organizationId },
        select: { id: true },
      });
      if (!org) throw new NotFoundException("Organization not found");
    } else if (scope.scopeType === RoleScope.EVENT) {
      const activity = await this.prisma.activity.findUnique({
        where: { id: scope.activityId },
        select: { id: true },
      });
      if (!activity) throw new NotFoundException("Activity not found");
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { scope: true },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role.scope !== scope.scopeType) {
      throw new BadRequestException(
        `Role must be ${scope.scopeType}-scoped for this invitation`,
      );
    }
  }

  private async scopeLabel(scope: {
    scopeType: RoleScope;
    organizationId?: string | null;
    activityId?: string | null;
  }): Promise<string> {
    if (scope.scopeType === RoleScope.ORG && scope.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: scope.organizationId },
        select: { name: true },
      });
      return `organization ${org?.name ?? scope.organizationId}`;
    }
    if (scope.scopeType === RoleScope.EVENT && scope.activityId) {
      const activity = await this.prisma.activity.findUnique({
        where: { id: scope.activityId },
        select: { slug: true },
      });
      return `activity ${activity?.slug ?? scope.activityId}`;
    }
    return "the platform";
  }

  private acceptUrl(token: string): string {
    const base = process.env.CLIENT_URL || "http://localhost:3000";
    return `${base}/invitations/accept?token=${token}`;
  }
}
