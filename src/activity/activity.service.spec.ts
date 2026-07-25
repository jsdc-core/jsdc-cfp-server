import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateActivityDto } from "./dto/activity.dto";

describe("ActivityService", () => {
  let service: ActivityService;
  let prisma: any;

  const baseDto: CreateActivityDto = {
    organizationId: "org-1",
    name: "JSDC 2026",
    slug: "jsdc-2026",
    startAt: new Date("2026-01-02T00:00:00Z"),
    endAt: new Date("2026-01-03T00:00:00Z"),
    supportedLanguages: ["zh-tw"],
    contents: [{ lang: "zh-tw", title: "JSDC" }],
  };

  beforeEach(async () => {
    prisma = {
      activity: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ActivityService);
  });

  describe("create", () => {
    it("passes organizationId through to prisma.activity.create", async () => {
      // No existing slug
      prisma.activity.findUnique.mockResolvedValue(null);
      prisma.activity.create.mockResolvedValue({ id: "act-1" });

      await service.create(baseDto);

      const createArg = prisma.activity.create.mock.calls[0][0];
      expect(createArg.data).toEqual(
        expect.objectContaining({ organizationId: "org-1" }),
      );
    });
  });

  describe("findOneById", () => {
    it("returns the activity including its organizationId", async () => {
      const activity = {
        id: "act-1",
        organizationId: "org-1",
        slug: "jsdc-2026",
        contents: [],
      };
      prisma.activity.findUnique.mockResolvedValue(activity);

      const result = await service.findOneById("act-1");

      expect(prisma.activity.findUnique).toHaveBeenCalledWith({
        where: { id: "act-1" },
        include: { contents: true },
      });
      expect(result.organizationId).toBe("org-1");
    });

    it("throws NotFoundException when the activity does not exist", async () => {
      prisma.activity.findUnique.mockResolvedValue(null);

      await expect(service.findOneById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
