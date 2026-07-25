import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  MaxLength,
} from "class-validator";
import { MemberStatus } from "../../../generated/prisma/enums";

export class CreateMemberDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ enum: MemberStatus })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
