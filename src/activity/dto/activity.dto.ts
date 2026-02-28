import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsString,
  IsArray,
  Length,
  Matches,
  ArrayMinSize,
  IsLocale,
  IsOptional,
  IsDate,
  MaxLength,
  IsNotEmpty,
  ValidateNested,
} from "class-validator";

export class ActivityContentDto {
  @ApiProperty({ example: "zh-TW" })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }): string =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @MaxLength(15)
  lang: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateActivityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }): string =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @Length(3, 64, { message: "Slug must be between 3 and 64 characters long" })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "Slug must contain only lowercase letters, numbers, and hyphens (-), and cannot start or end with a hyphen",
  })
  slug: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startAt: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  endAt: Date;

  @ApiProperty({
    type: [String],
    example: ["zh-tw", "en-us"],
    description: "List of supported language codes",
  })
  @IsArray()
  @IsNotEmpty()
  @Transform(({ value }: { value: string[] }): string[] =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === "string" ? v.toLowerCase() : v))
      : value,
  )
  @ArrayMinSize(1, {
    message: "At least one supported language must be provided",
  })
  @IsString({ each: true })
  @IsLocale({
    each: true,
    message: "Each language code must be a valid locale (e.g., zh-TW, en-US)",
  })
  supportedLanguages: string[];

  @ApiPropertyOptional({ description: "Manual closure timestamp" })
  @IsOptional()
  @Type(() => Date)
  closedAt?: Date;

  @ApiProperty({ type: [ActivityContentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityContentDto)
  contents: ActivityContentDto[];
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}
