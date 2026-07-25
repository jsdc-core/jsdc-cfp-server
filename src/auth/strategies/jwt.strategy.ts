import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { PermissionsCacheService } from "../services/permissions-cache.service";
import { AuthService } from "../auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ScopedPermissions } from "../types/scoped-permissions";

export interface JwtPayloadToken {
  sub: string;
  v: number; // tokenVersion
}

export interface AuthUser {
  id: string;
  permissions: ScopedPermissions;
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private permissionsCache: PermissionsCacheService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET") || "fallback-secret",
    });
  }

  async validate(payload: JwtPayloadToken): Promise<AuthUser> {
    let tokenVersion = await this.permissionsCache.getTokenVersion(payload.sub);

    if (tokenVersion === undefined) {
      const member = await this.prisma.member.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      });
      if (!member) {
        throw new UnauthorizedException("User no longer exists");
      }
      tokenVersion = member.tokenVersion;
      await this.permissionsCache.setTokenVersion(payload.sub, tokenVersion);
    }

    if (payload.v !== tokenVersion) {
      throw new UnauthorizedException("Token has been revoked");
    }

    let permissions = await this.permissionsCache.getPermissions(payload.sub);

    if (permissions === undefined) {
      permissions = await this.authService.getScopedPermissions(payload.sub);
      await this.permissionsCache.setPermissions(payload.sub, permissions);
    }

    return {
      id: payload.sub,
      permissions,
      tokenVersion: payload.v,
    };
  }
}
