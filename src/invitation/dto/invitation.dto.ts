import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsUUID } from "class-validator";

export class CreateInvitationDto {
  @ApiProperty({ example: "teammate@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Role to grant on acceptance (must match scope)",
  })
  @IsUUID()
  roleId: string;
}

export class RespondInvitationDto {
  @ApiProperty({ description: "Invitation token from the email" })
  @IsString()
  token: string;
}
