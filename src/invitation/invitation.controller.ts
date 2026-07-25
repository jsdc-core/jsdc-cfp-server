import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { InvitationService } from "./invitation.service";
import {
  CreateInvitationDto,
  RespondInvitationDto,
} from "./dto/invitation.dto";
import { RequirePermissions } from "../auth/decorators/scoped-permissions.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";

@ApiTags("Organization Invitations")
@Controller("organizations/:orgId/invitations")
export class OrganizationInvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Get()
  list(@Param("orgId", new ParseUUIDPipe()) orgId: string) {
    return this.invitationService.listForOrg(orgId);
  }

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Post()
  invite(
    @Param("orgId", new ParseUUIDPipe()) orgId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.invitationService.inviteToOrg(orgId, dto, user.id);
  }

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Post(":id/resend")
  resend(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.invitationService.resend(id);
  }

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Delete(":id")
  revoke(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.invitationService.revoke(id);
  }
}

@ApiTags("Activity Invitations")
@Controller("activities/:activityId/invitations")
export class ActivityInvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Get()
  list(@Param("activityId", new ParseUUIDPipe()) activityId: string) {
    return this.invitationService.listForActivity(activityId);
  }

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Post()
  invite(
    @Param("activityId", new ParseUUIDPipe()) activityId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.invitationService.inviteToActivity(activityId, dto, user.id);
  }

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Post(":id/resend")
  resend(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.invitationService.resend(id);
  }

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Delete(":id")
  revoke(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.invitationService.revoke(id);
  }
}

// Invitee-facing endpoints. Require auth (we match the caller's email), but no
// special permission — the token + email pairing is the authorization.
@ApiTags("Invitations")
@Controller("invitations")
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post("accept")
  accept(@Body() dto: RespondInvitationDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.accept(dto.token, user.id);
  }

  @Post("reject")
  reject(@Body() dto: RespondInvitationDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.reject(dto.token, user.id);
  }
}
