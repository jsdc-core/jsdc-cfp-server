import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Patch,
  Delete,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { MemberService } from "./member.service";
import { CreateMemberDto, UpdateMemberDto } from "./dto/member.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { RequirePermissions } from "../auth/decorators/scoped-permissions.decorator";

@ApiTags("Members")
@Controller("members")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Permissions("permission:manage")
  @Get()
  @ApiOperation({ summary: "Get all members" })
  async list() {
    return this.memberService.list();
  }

  @Permissions("permission:manage")
  @Post()
  @ApiOperation({ summary: "Create new member" })
  @ApiResponse({ status: 201, description: "Created successfully" })
  @ApiResponse({ status: 400, description: "Invalid input or validation failed" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  async create(@Body() dto: CreateMemberDto) {
    return this.memberService.create(dto);
  }

  @RequirePermissions({ scope: "ORG", param: "orgId", perms: ["org:member:manage"] })
  @Get("organization/:orgId")
  @ApiOperation({ summary: "List all members of an organization (with roles)" })
  async listByOrganization(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.memberService.listByOrganization(orgId);
  }

  @Permissions("permission:manage")
  @Get(":id")
  @ApiOperation({ summary: "Get member by ID" })
  @ApiResponse({ status: 404, description: "Member not found" })
  async get(@Param("id", ParseUUIDPipe) id: string) {
    return this.memberService.get(id);
  }

  @Permissions("permission:manage")
  @Patch(":id")
  @ApiOperation({ summary: "Update member" })
  @ApiResponse({ status: 200, description: "Member updated successfully" })
  @ApiResponse({ status: 404, description: "Member not found" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.memberService.update(id, dto);
  }

  @Permissions("permission:manage")
  @Delete(":id")
  @ApiOperation({ summary: "Delete member" })
  @ApiResponse({ status: 200, description: "Member deleted successfully" })
  @ApiResponse({ status: 404, description: "Member not found" })
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.memberService.remove(id);
  }
}
