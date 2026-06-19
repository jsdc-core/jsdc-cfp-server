import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { withId } from "src/common/utils/db.util";
import { AuthService } from "../auth/auth.service";
import { CreateRoleDto, UpdateRoleDto } from "./dto/role.dto";
import { RoleScope } from "../../generated/prisma/enums";

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  list(scope?: RoleScope) {
    return this.prisma.role.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: "asc" }, { name: "asc" }],
      include: { permissions: { include: { permission: true } } },
    });
  }

  async create(dto: CreateRoleDto) {
    const scope = dto.scope ?? RoleScope.PLATFORM;
    const existing = await this.prisma.role.findUnique({
      where: { name_scope: { name: dto.name, scope } },
    });
    if (existing) {
      throw new ConflictException(
        `Role '${dto.name}' already exists in scope '${scope}'`,
      );
    }

    await this.assertPermissionsExist(dto.permissionIds);

    return this.prisma.role.create({
      data: withId({
        name: dto.name,
        scope,
        description: dto.description,
        permissions: {
          create: dto.permissionIds.map((permission_id) => ({ permission_id })),
        },
      }),
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");

    const permissionsChanged = dto.permissionIds !== undefined;
    if (dto.permissionIds) {
      await this.assertPermissionsExist(dto.permissionIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { role_id: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permission_id) => ({
            role_id: id,
            permission_id,
          })),
        });
      }
      return tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: { permissions: { include: { permission: true } } },
      });
    });

    if (permissionsChanged) {
      await this.bumpMembersOfRole(id);
    }
    return updated;
  }

  async delete(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");

    await this.bumpMembersOfRole(id);
    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }

  private async assertPermissionsExist(ids: string[]) {
    if (ids.length === 0) return;
    const count = await this.prisma.permission.count({
      where: { id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new NotFoundException("One or more permissionIds are invalid");
    }
  }

  private async bumpMembersOfRole(roleId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { roleId },
      select: { memberId: true },
      distinct: ["memberId"],
    });
    await Promise.all(
      memberships.map((m) => this.authService.bumpTokenVersion(m.memberId)),
    );
  }
}
