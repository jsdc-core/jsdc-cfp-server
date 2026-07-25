import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { withId } from "src/common/utils/db.util";
import { RoleScope } from "../../generated/prisma/enums";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from "./dto/organization.dto";

export const ORG_OWNER_ROLE = "Owner";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** Organizations the member belongs to (any role). */
  listForMember(memberId: string) {
    return this.prisma.organization.findMany({
      where: { memberships: { some: { memberId } } },
      orderBy: { name: "asc" },
    });
  }

  async get(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  /** Create an organization; the creator becomes its Owner. */
  async create(dto: CreateOrganizationDto, creatorId: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`slug '${dto.slug}' is already taken`);
    }

    const ownerRole = await this.prisma.role.findUnique({
      where: { name_scope: { name: ORG_OWNER_ROLE, scope: RoleScope.ORG } },
      select: { id: true },
    });
    if (!ownerRole) {
      throw new NotFoundException(
        "Org Owner role is missing — run the database seed",
      );
    }

    const org = await this.prisma.organization.create({
      data: withId({
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        memberships: {
          create: withId({
            memberId: creatorId,
            roleId: ownerRole.id,
            scopeType: RoleScope.ORG,
          }),
        },
      }),
    });

    // Creator just gained org-scoped permissions → refresh their session.
    await this.authService.bumpTokenVersion(creatorId);
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.get(id);
    if (dto.slug) {
      const clash = await this.prisma.organization.findUnique({
        where: { slug: dto.slug },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException(`slug '${dto.slug}' is already taken`);
      }
    }
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.organization.delete({ where: { id } });
    return { ok: true };
  }
}
