import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Post,
  Body,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { Response, Request } from "express";
import { generateState } from "arctic";
import { Public } from "./decorators/public.decorator";
import {
  RefreshTokenService,
  RefreshTokenReuseError,
} from "./services/refresh-token.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./strategies/jwt.strategy";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const ACCESS_TTL_MS = 15 * 60 * 1000; // 15m (matches JWT expiry)
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    maxAge: ACCESS_TTL_MS,
    path: "/",
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    maxAge: REFRESH_TTL_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get("github")
  githubLogin(@Res() res: Response) {
    const state = generateState();
    const url = this.authService.createGithubAuthUrl(state);

    res.cookie("github_oauth_state", state, {
      httpOnly: true,
      secure: isProd(),
      maxAge: 600000,
      path: "/",
    });

    return res.redirect(url.toString());
  }

  @Public()
  @Get("github/callback")
  async githubCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const storedState = req.cookies["github_oauth_state"] as string | undefined;

    if (!state || !storedState || state !== storedState) {
      return res.status(400).send("Invalid state");
    }

    res.clearCookie("github_oauth_state");

    try {
      const { access_token, refresh_token } =
        await this.authService.loginWithGithub(code);

      setAuthCookies(res, access_token, refresh_token);

      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '${clientUrl}');
              window.close();
            </script>
            <p>Login successful, redirecting...</p>
          </body>
        </html>
      `);
    } catch (error: unknown) {
      let message = "unexpected error";

      if (error instanceof Error) {
        message = error.message;
      }

      return res.send(`
        <script>
          window.opener.postMessage({ type: 'AUTH_ERROR', message: '${JSON.stringify(message)}' }, '${clientUrl}');
          window.close();
        </script>
      `);
    }
  }

  @Public()
  @Post("dev-login")
  async devLogin(@Body() body: { email: string }, @Res() res: Response) {
    const result = await this.authService.devLogin(body.email);
    setAuthCookies(res, result.access_token, result.refresh_token);
    return res.json({
      access_token: result.access_token,
      user: result.user,
    });
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies[REFRESH_COOKIE] as string | undefined;
    if (!rawToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      const rotated = await this.refreshTokenService.rotate(rawToken);
      const { accessToken } = await this.authService.issueAccessToken(
        rotated.memberId,
      );
      setAuthCookies(res, accessToken, rotated.rawToken);
      return res.json({ ok: true });
    } catch (err) {
      if (err instanceof RefreshTokenReuseError) {
        await this.authService.bumpTokenVersion(err.memberId);
        clearAuthCookies(res);
        throw new UnauthorizedException("Refresh token reuse detected");
      }
      clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies[REFRESH_COOKIE] as string | undefined;
    if (rawToken) {
      await this.refreshTokenService.revoke(rawToken);
    }
    clearAuthCookies(res);
    return res.json({ ok: true });
  }

  @Get("me")
  async me(@Req() req: Request) {
    const user = req.user as AuthUser;
    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    return {
      id: member.id,
      email: member.email,
      displayName: member.displayName,
      avatar: member.avatarUrl,
      permissions: user.permissions,
    };
  }
}
