import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { withId } from "src/common/utils/db.util";
import { AuthService } from "../auth/auth.service";
import { CreatePermissionDto, UpdatePermissionDto } from "./dto/permission.dto";

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  list() {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  async create(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Permission '${dto.code}' already exists`);
    }
    return this.prisma.permission.create({ data: withId(dto) });
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) throw new NotFoundException("Permission not found");

    const updated = await this.prisma.permission.update({
      where: { id },
      data: dto,
    });

    // If code changed, affected members' cached permissions are now stale.
    if (dto.code && dto.code !== permission.code) {
      await this.bumpMembersWithPermission(id);
    }
    return updated;
  }

  async delete(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) throw new NotFoundException("Permission not found");

    await this.bumpMembersWithPermission(id);
    await this.prisma.permission.delete({ where: { id } });
    return { ok: true };
  }

  private async bumpMembersWithPermission(permissionId: string) {
    const members = await this.prisma.member.findMany({
      where: {
        memberships: {
          some: {
            role: { permissions: { some: { permission_id: permissionId } } },
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      members.map((m) => this.authService.bumpTokenVersion(m.id)),
    );
  }
}
