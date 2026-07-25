import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, Matches, MaxLength } from "class-validator";

export class CreatePermissionDto {
  @ApiProperty({ example: "activity:manage" })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_-]+:[a-z0-9_-]+$/, {
    message: "Permission code must look like 'resource:action'",
  })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
