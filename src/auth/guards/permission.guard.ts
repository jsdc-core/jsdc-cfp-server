import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AuthUser } from "../strategies/jwt.strategy";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsCacheService } from "../services/permissions-cache.service";
import {
  SCOPED_PERMISSIONS_KEY,
  ScopedPermissionRequirement,
} from "../decorators/scoped-permissions.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cache: PermissionsCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped =
      this.reflector.getAllAndOverride<ScopedPermissionRequirement>(
        SCOPED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );
    // Legacy @Permissions(...) → treated as a PLATFORM-scope requirement.
    const legacy = this.reflector.getAllAndOverride<string[]>("permissions", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!scoped && !legacy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      return false;
    }

    const requirement: ScopedPermissionRequirement = scoped ?? {
      scope: "PLATFORM",
      perms: legacy,
    };

    // PLATFORM grants always count.
    const allowed = new Set<string>(user.permissions.platform);
    const satisfied = () => requirement.perms.every((p) => allowed.has(p));

    if (requirement.scope === "PLATFORM" || satisfied()) {
      return satisfied();
    }

    const scopeId = requirement.param
      ? (request.params[requirement.param] as string | undefined)
      : undefined;
    if (!scopeId) {
      return false;
    }

    if (requirement.scope === "ORG") {
      (user.permissions.org[scopeId] ?? []).forEach((c) => allowed.add(c));
      return satisfied();
    }

    // EVENT: try direct grants on the activity first, then cascade from its org.
    (user.permissions.event[scopeId] ?? []).forEach((c) => allowed.add(c));
    if (satisfied()) {
      return true;
    }
    const orgId = await this.resolveActivityOrg(scopeId);
    if (orgId) {
      (user.permissions.org[orgId] ?? []).forEach((c) => allowed.add(c));
    }
    return satisfied();
  }

  private async resolveActivityOrg(activityId: string): Promise<string | null> {
    const cached = await this.cache.getActivityOrg(activityId);
    if (cached !== undefined) {
      return cached === "" ? null : cached;
    }
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { organizationId: true },
    });
    const orgId = activity?.organizationId ?? null;
    await this.cache.setActivityOrg(activityId, orgId);
    return orgId;
  }
}
