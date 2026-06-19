import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { withId } from "src/common/utils/db.util";
import { RoleScope } from "../../generated/prisma/enums";

/**
 * Manages scoped role bindings (memberships). A member can hold different roles
 * in different organizations / activities. Replacing roles bumps the member's
 * tokenVersion so any live session re-resolves permissions immediately.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  listForOrg(organizationId: string, memberId: string) {
    return this.list({ scopeType: RoleScope.ORG, organizationId, memberId });
  }

  async replaceForOrg(
    organizationId: string,
    memberId: string,
    roleIds: string[],
  ) {
    await this.assertOrganization(organizationId);
    return this.replace({
      scopeType: RoleScope.ORG,
      organizationId,
      memberId,
      roleIds,
    });
  }

  listForActivity(activityId: string, memberId: string) {
    return this.list({ scopeType: RoleScope.EVENT, activityId, memberId });
  }

  async replaceForActivity(
    activityId: string,
    memberId: string,
    roleIds: string[],
  ) {
    await this.assertActivity(activityId);
    return this.replace({
      scopeType: RoleScope.EVENT,
      activityId,
      memberId,
      roleIds,
    });
  }

  private list(scope: {
    scopeType: RoleScope;
    memberId: string;
    organizationId?: string;
    activityId?: string;
  }) {
    return this.prisma.membership.findMany({
      where: {
        memberId: scope.memberId,
        scopeType: scope.scopeType,
        organizationId: scope.organizationId ?? null,
        activityId: scope.activityId ?? null,
      },
      include: { role: true },
    });
  }

  private async replace(scope: {
    scopeType: RoleScope;
    memberId: string;
    organizationId?: string;
    activityId?: string;
    roleIds: string[];
  }) {
    await this.assertMember(scope.memberId);
    await this.assertRolesMatchScope(scope.roleIds, scope.scopeType);

    const organizationId = scope.organizationId ?? null;
    const activityId = scope.activityId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.deleteMany({
        where: {
          memberId: scope.memberId,
          scopeType: scope.scopeType,
          organizationId,
          activityId,
        },
      });
      if (scope.roleIds.length > 0) {
        await tx.membership.createMany({
          data: scope.roleIds.map((roleId) =>
            withId({
              memberId: scope.memberId,
              roleId,
              scopeType: scope.scopeType,
              organizationId,
              activityId,
            }),
          ),
        });
      }
    });

    await this.authService.bumpTokenVersion(scope.memberId);
    return this.list(scope);
  }

  private async assertRolesMatchScope(roleIds: string[], scopeType: RoleScope) {
    if (roleIds.length === 0) return;
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, scope: true },
    });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException("One or more roleIds are invalid");
    }
    const mismatch = roles.filter((r) => r.scope !== scopeType);
    if (mismatch.length > 0) {
      throw new BadRequestException(
        `All roles must be ${scopeType}-scoped for this assignment`,
      );
    }
  }

  private async assertMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException("Member not found");
  }

  private async assertOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
  }

  private async assertActivity(activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true },
    });
    if (!activity) throw new NotFoundException("Activity not found");
  }
}
