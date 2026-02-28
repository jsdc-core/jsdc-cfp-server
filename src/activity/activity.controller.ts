import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Patch,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from "@nestjs/swagger";
import { ActivityService } from "./activity.service";
import { CreateActivityDto, UpdateActivityDto } from "./dto/activity.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Public } from "src/auth/decorators/public.decorator";

@ApiTags("Activities")
@Controller("activities")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  // ========== Public API ==========

  // public: get by slug (only active)
  @Public()
  @Get("slug/:slug")
  @ApiOperation({ summary: "Get activity by slug (public)" })
  @ApiQuery({
    name: "lang",
    required: false,
    description: "Optional language code to filter contents",
  })
  @ApiResponse({
    status: 200,
    description:
      "Returns the activity metadata and, when a language is provided, only the corresponding content",
  })
  @ApiResponse({ status: 404, description: "Activity not found" })
  async findBySlug(@Param("slug") slug: string, @Query("lang") lang?: string) {
    return this.activityService.findOneBySlug(slug, lang);
  }

  // ========== Admin API ==========

  @Permissions("activity:manage")
  @Post()
  @ApiOperation({ summary: "Create new activity with contents" })
  @ApiResponse({ status: 201, description: "Created successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid input or validation failed",
  })
  @ApiResponse({ status: 409, description: "Slug already exists" })
  async create(@Body() dto: CreateActivityDto) {
    return this.activityService.create(dto);
  }

  @Permissions("activity:manage")
  @Get()
  @ApiOperation({ summary: "Get all activities" })
  async findAll() {
    return this.activityService.findAll();
  }

  // admin: get by ID (includes all languages)
  @Permissions("activity:manage")
  @Get(":id")
  @ApiOperation({ summary: "Get activity by ID (for admin)" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.activityService.findOneById(id);
  }

  @Permissions("activity:manage")
  @Patch(":id")
  @ApiOperation({ summary: "Update activity" })
  @ApiResponse({ status: 200, description: "Activity updated successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid input or validation failed",
  })
  @ApiResponse({ status: 404, description: "Activity not found" })
  @ApiResponse({ status: 409, description: "Slug already exists" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activityService.update(id, dto);
  }
}
