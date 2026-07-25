import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitationService } from "./invitation.service";
import { MailService } from "./mail.service";
import {
  ActivityInvitationController,
  InvitationController,
  OrganizationInvitationController,
} from "./invitation.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationInvitationController,
    ActivityInvitationController,
    InvitationController,
  ],
  providers: [InvitationService, MailService],
  exports: [InvitationService],
})
export class InvitationModule {}
