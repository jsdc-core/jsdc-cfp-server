import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

export interface JwtPayloadToken {
  sub: string;
  permissions: string[];
  v: number; // tokenVersion
}

export interface AuthUser {
  id: string;
  permissions: string[];
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
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

  validate(payload: JwtPayloadToken): AuthUser {
    return {
      id: payload.sub,
      permissions: payload.permissions,
      tokenVersion: payload.v,
    };
  }
}
