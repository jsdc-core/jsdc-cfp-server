import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ArgumentMetadata, BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateActivityDto } from "./activity.dto";

const validPayload = () => ({
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
  name: "test",
  slug: "test-slug",
  startAt: new Date(),
  endAt: new Date(Date.now() + 86400000),
  supportedLanguages: ["zh-tw"],
  contents: [{ lang: "zh-tw", title: "test" }],
});

describe("CreateActivityDto validation", () => {
  describe("class-validator (validate)", () => {
    describe("organizationId UUID validation", () => {
      it('rejects organizationId "abc123" with the isUUID rule', async () => {
        const dto = plainToInstance(CreateActivityDto, {
          ...validPayload(),
          organizationId: "abc123",
        });

        const errors = await validate(dto);

        const orgIdError = errors.find((e) => e.property === "organizationId");
        expect(orgIdError?.constraints).toMatchObject({
          isUuid: expect.any(String),
        });
      });

      it('rejects organizationId "not-a-uuid" with the isUUID rule', async () => {
        const dto = plainToInstance(CreateActivityDto, {
          ...validPayload(),
          organizationId: "not-a-uuid",
        });

        const errors = await validate(dto);

        const orgIdError = errors.find((e) => e.property === "organizationId");
        expect(orgIdError?.constraints).toMatchObject({
          isUuid: expect.any(String),
        });
      });

      it("accepts a valid UUID organizationId", async () => {
        const dto = plainToInstance(CreateActivityDto, {
          ...validPayload(),
          organizationId: "550e8400-e29b-41d4-a716-446655440000",
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      });
    });

    it("rejects a payload missing organizationId", async () => {
      const { organizationId, ...withoutOrgId } = validPayload();
      const dto = plainToInstance(CreateActivityDto, withoutOrgId);

      const errors = await validate(dto);

      const orgIdError = errors.find((e) => e.property === "organizationId");
      expect(orgIdError).toBeDefined();
      expect(orgIdError?.constraints).toMatchObject({
        isNotEmpty: expect.any(String),
      });
    });

    it("accepts a fully-valid payload", async () => {
      const dto = plainToInstance(CreateActivityDto, validPayload());

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe("NestJS ValidationPipe", () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: CreateActivityDto,
      data: "",
    };

    describe("organizationId UUID validation", () => {
      it('rejects organizationId "abc123" with BadRequestException', async () => {
        await expect(
          pipe.transform(
            { ...validPayload(), organizationId: "abc123" },
            metadata,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('rejects organizationId "not-a-uuid" with BadRequestException', async () => {
        await expect(
          pipe.transform(
            { ...validPayload(), organizationId: "not-a-uuid" },
            metadata,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it("accepts a valid UUID organizationId", async () => {
        await expect(
          pipe.transform(
            {
              ...validPayload(),
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
            },
            metadata,
          ),
        ).resolves.toBeInstanceOf(CreateActivityDto);
      });
    });

    it("throws 400 (BadRequestException) when organizationId is missing", async () => {
      const { organizationId, ...withoutOrgId } = validPayload();

      await expect(pipe.transform(withoutOrgId, metadata)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("passes a fully-valid payload through", async () => {
      await expect(
        pipe.transform(validPayload(), metadata),
      ).resolves.toBeInstanceOf(CreateActivityDto);
    });
  });
});
