import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { RoleScope } from "../../../generated/prisma/enums";

export class CreateRoleDto {
  @ApiProperty({ example: "editor" })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ enum: RoleScope, default: RoleScope.PLATFORM })
  @IsOptional()
  @IsEnum(RoleScope)
  scope?: RoleScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ type: [String], description: "Permission IDs" })
  @IsArray()
  @IsUUID("all", { each: true })
  permissionIds: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class AssignRolesDto {
  @ApiProperty({ type: [String], description: "Role IDs to assign to member" })
  @IsArray()
  @IsUUID("all", { each: true })
  roleIds: string[];
}
