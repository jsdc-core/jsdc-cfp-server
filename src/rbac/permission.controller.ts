import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionService } from "./permission.service";
import { CreatePermissionDto, UpdatePermissionDto } from "./dto/permission.dto";

@ApiTags("Permissions")
@Controller("permissions")
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Permissions("permission:manage")
  @Get()
  list() {
    return this.permissionService.list();
  }

  @Permissions("permission:manage")
  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionService.create(dto);
  }

  @Permissions("permission:manage")
  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionService.update(id, dto);
  }

  @Permissions("permission:manage")
  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.permissionService.delete(id);
  }
}
