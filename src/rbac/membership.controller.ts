import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/scoped-permissions.decorator";
import { MembershipService } from "./membership.service";
import { AssignRolesDto } from "./dto/role.dto";

@ApiTags("Organization Members")
@Controller("organizations/:orgId/members/:memberId/roles")
export class OrganizationMemberController {
  constructor(private readonly membershipService: MembershipService) {}

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Get()
  list(
    @Param("orgId", new ParseUUIDPipe()) orgId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.membershipService.listForOrg(orgId, memberId);
  }

  @RequirePermissions({
    scope: "ORG",
    param: "orgId",
    perms: ["org:member:manage"],
  })
  @Put()
  replace(
    @Param("orgId", new ParseUUIDPipe()) orgId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.membershipService.replaceForOrg(orgId, memberId, dto.roleIds);
  }
}

@ApiTags("Activity Members")
@Controller("activities/:activityId/members/:memberId/roles")
export class ActivityMemberController {
  constructor(private readonly membershipService: MembershipService) {}

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Get()
  list(
    @Param("activityId", new ParseUUIDPipe()) activityId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.membershipService.listForActivity(activityId, memberId);
  }

  @RequirePermissions({
    scope: "EVENT",
    param: "activityId",
    perms: ["event:member:manage"],
  })
  @Put()
  replace(
    @Param("activityId", new ParseUUIDPipe()) activityId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.membershipService.replaceForActivity(
      activityId,
      memberId,
      dto.roleIds,
    );
  }
}
