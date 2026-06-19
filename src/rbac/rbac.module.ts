import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PermissionController } from "./permission.controller";
import { PermissionService } from "./permission.service";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";
import {
  ActivityMemberController,
  OrganizationMemberController,
} from "./membership.controller";
import { MembershipService } from "./membership.service";

@Module({
  imports: [AuthModule],
  controllers: [
    PermissionController,
    RoleController,
    OrganizationMemberController,
    ActivityMemberController,
  ],
  providers: [PermissionService, RoleService, MembershipService],
  exports: [MembershipService],
})
export class RbacModule {}
