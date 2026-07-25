import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ActivityModule } from "./activity/activity.module";
import { RbacModule } from "./rbac/rbac.module";
import { OrganizationModule } from "./organization/organization.module";
import { InvitationModule } from "./invitation/invitation.module";
import { MemberModule } from "./member/member.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ActivityModule,
    RbacModule,
    OrganizationModule,
    InvitationModule,
    MemberModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
