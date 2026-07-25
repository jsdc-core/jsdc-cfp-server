import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { RoleService } from "./role.service";
import { CreateRoleDto, UpdateRoleDto } from "./dto/role.dto";
import { RoleScope } from "../../generated/prisma/enums";

@ApiTags("Roles")
@Controller("roles")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  // Dev-only convenience for the mock UI: list all roles (id/name/scope/perms)
  // without needing platform `role:manage`. Disabled in production.
  @Public()
  @Get("catalog")
  @ApiOperation({ summary: "List all roles (dev only — for the test UI)" })
  catalog() {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("Not available in production");
    }
    return this.roleService.list();
  }

  @Permissions("role:manage")
  @ApiQuery({ name: "scope", enum: RoleScope, required: false })
  @Get()
  list(@Query("scope") scope?: RoleScope) {
    return this.roleService.list(scope);
  }

  @Permissions("role:manage")
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Permissions("role:manage")
  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto);
  }

  @Permissions("role:manage")
  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.roleService.delete(id);
  }
}
