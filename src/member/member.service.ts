import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemberDto, UpdateMemberDto } from "./dto/member.dto";
import { withId } from "src/common/utils/db.util";
import { RoleScope } from "../../generated/prisma/enums";

@Injectable()
export class MemberService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.member.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  /** 列出組織的所有成員（包含角色） */
  async listByOrganization(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        scopeType: RoleScope.ORG,
        organizationId,
      },
      include: {
        member: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            scope: true,
          },
        },
      },
      orderBy: { member: { email: "asc" } },
    });

    // 按 memberId 分組合併角色
    const memberMap = new Map<string, any>();
    for (const m of memberships) {
      if (!memberMap.has(m.memberId)) {
        memberMap.set(m.memberId, {
          member: m.member,
          roles: [],
        });
      }
      memberMap.get(m.memberId).roles.push(m.role);
    }

    return Array.from(memberMap.values());
  }

  async create(dto: CreateMemberDto) {
    await this.checkEmailExists(dto.email);

    return this.prisma.member.create({
      data: withId({
        email: dto.email,
        displayName: dto.displayName ?? null,
        location: dto.location ?? null,
        jobTitle: dto.jobTitle ?? null,
        ...(dto.status && { status: dto.status }),
      }),
    });
  }

  async update(id: string, dto: UpdateMemberDto) {
    // Ensure member exists
    await this.get(id);

    // If email is being changed, ensure it's still unique
    if (dto.email) {
      const existing = await this.prisma.member.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Member with email "${dto.email}" already exists`,
        );
      }
    }

    return this.prisma.member.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async remove(id: string) {
    // Ensure member exists
    await this.get(id);

    await this.prisma.member.delete({ where: { id } });
    return { id };
  }

  // ========== Private Methods ==========

  private async checkEmailExists(email: string): Promise<void> {
    const existing = await this.prisma.member.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(
        `Member with email "${email}" already exists`,
      );
    }
  }
}
