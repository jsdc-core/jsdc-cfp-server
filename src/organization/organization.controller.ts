import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { OrganizationService } from "./organization.service";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from "./dto/organization.dto";
import { RequirePermissions } from "../auth/decorators/scoped-permissions.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";

@ApiTags("Organizations")
@Controller("organizations")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // Any authenticated user can create an organization (becomes its Owner).
  @Post()
  create(@Body() dto: CreateOrganizationDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.organizationService.create(dto, user.id);
  }

  // Organizations the current user belongs to.
  @Get()
  listMine(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.organizationService.listForMember(user.id);
  }

  @RequirePermissions({ scope: "ORG", param: "id", perms: ["org:profile"] })
  @Get(":id")
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.organizationService.get(id);
  }

  @RequirePermissions({ scope: "ORG", param: "id", perms: ["org:profile"] })
  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  @RequirePermissions({ scope: "ORG", param: "id", perms: ["org:profile"] })
  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.organizationService.remove(id);
  }
}
