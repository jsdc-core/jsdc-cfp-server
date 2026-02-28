import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ActivityContentDto,
  CreateActivityDto,
  UpdateActivityDto,
} from "./dto/activity.dto";
import { withId } from "src/common/utils/db.util";

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateActivityDto) {
    // Validate dates
    this.validateDates(dto.startAt, dto.endAt, dto.closedAt);

    // Check if slug already exists
    await this.checkSlugExists(dto.slug);

    // Validate content languages
    this.validateContentLanguages(dto.contents, dto.supportedLanguages);

    return this.prisma.activity.create({
      data: withId({
        name: dto.name,
        slug: dto.slug,
        startAt: dto.startAt,
        endAt: dto.endAt,
        closedAt: dto.closedAt || null,
        supportedLanguages: dto.supportedLanguages,
        contents: {
          create: dto.contents.map((content) =>
            withId({
              lang: content.lang,
              title: content.title,
              description: content.description,
            }),
          ),
        },
      }),
      include: { contents: true },
    });
  }
  async findAll() {
    return this.prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  // admin: get by ID
  async findOneById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { contents: true },
    });
    if (!activity) throw new NotFoundException("Activity not found");
    return activity;
  }

  // public: get by slug
  async findOneBySlug(slug: string, lang?: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { slug },
      select: {
        slug: true,
        startAt: true,
        endAt: true,
        closedAt: true,
        supportedLanguages: true,
        contents: {
          select: { lang: true, title: true, description: true },
          where: lang ? { lang: lang.toLowerCase() } : undefined,
        },
      },
    });
    if (!activity) throw new NotFoundException("Activity not found");

    return this.applySupportedLanguageFilter(activity);
  }

  async update(id: string, dto: UpdateActivityDto) {
    // Check if activity exists
    const activity = await this.findOneById(id);

    // Validate dates if any date field is being updated
    if (dto.startAt || dto.endAt || dto.closedAt !== undefined) {
      const startAt = dto.startAt || activity.startAt;
      const endAt = dto.endAt || activity.endAt;
      const closedAt =
        dto.closedAt !== undefined ? dto.closedAt : activity.closedAt;

      this.validateDates(startAt, endAt, closedAt);
    }

    // Check slug if it's being updated and different from current
    if (dto.slug && dto.slug !== activity.slug) {
      await this.checkSlugExists(dto.slug);
    }

    // Validate content languages if contents are being updated
    if (dto.contents) {
      const supportedLanguages =
        dto.supportedLanguages || activity.supportedLanguages;
      this.validateContentLanguages(dto.contents, supportedLanguages);
    }

    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Update activity main fields
      await tx.activity.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.startAt && { startAt: dto.startAt }),
          ...(dto.endAt && { endAt: dto.endAt }),
          ...(dto.closedAt !== undefined && { closedAt: dto.closedAt }),
          ...(dto.supportedLanguages && {
            supportedLanguages: dto.supportedLanguages,
          }),
        },
      });

      if (dto.contents) {
        await Promise.all(
          dto.contents.map((content) =>
            tx.activityContent.upsert({
              where: {
                activityId_lang: {
                  activityId: id,
                  lang: content.lang,
                },
              },
              update: {
                title: content.title,
                description: content.description,
              },
              create: withId({
                activityId: id,
                lang: content.lang,
                title: content.title,
                description: content.description,
              }),
            }),
          ),
        );
      }

      // Return complete activity data
      return tx.activity.findUnique({
        where: { id },
        include: { contents: true },
      });
    });
  }

  // ========== Private Methods (Validation Logic) ==========

  /**
   * Filter the contents to only include items with languages present in supportedLanguages
   */
  private applySupportedLanguageFilter<
    T extends {
      supportedLanguages: string[];
      contents?: Array<{ lang: string }>;
    },
  >(activity: T | null): T | null {
    if (!activity || !activity.contents) {
      return activity;
    }
    activity.contents = activity.contents.filter((c) =>
      activity.supportedLanguages.includes(c.lang),
    );
    return activity;
  }

  /**
   * Validate date logic
   */
  private validateDates(
    startAt: Date,
    endAt: Date,
    closedAt?: Date | null,
  ): void {
    if (endAt <= startAt) {
      throw new BadRequestException("End date must be after start date");
    }

    if (closedAt && closedAt >= startAt) {
      throw new BadRequestException("Closed date must be before start date");
    }
  }

  /**
   * Check if slug already exists
   */
  private async checkSlugExists(slug: string): Promise<void> {
    const existing = await this.prisma.activity.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(
        `Activity with slug "${slug}" already exists`,
      );
    }
  }

  /**
   * Validate that all content languages are in supportedLanguages
   */
  private validateContentLanguages(
    contents: ActivityContentDto[],
    supportedLanguages: string[],
  ): void {
    const contentLangs = contents.map((c) => c.lang);
    const unsupportedLangs = contentLangs.filter(
      (lang) => !supportedLanguages.includes(lang),
    );

    console.log("supportedLanguages", supportedLanguages);
    console.log("unsupportedLangs", unsupportedLangs);

    if (unsupportedLangs.length > 0) {
      throw new BadRequestException(
        `Contents contain unsupported languages: ${unsupportedLangs.join(", ")}`,
      );
    }

    // Check for duplicate languages
    const duplicateLangs = contentLangs.filter(
      (lang, index) => contentLangs.indexOf(lang) !== index,
    );

    if (duplicateLangs.length > 0) {
      throw new BadRequestException(
        `Duplicate languages in contents: ${duplicateLangs.join(", ")}`,
      );
    }
  }
}
