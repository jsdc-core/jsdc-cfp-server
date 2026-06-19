import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateOrganizationDto {
  @ApiProperty({ example: "JSDC" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: "jsdc" })
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9-]+$/, {
    message: "slug must be lowercase letters, numbers and hyphens",
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
