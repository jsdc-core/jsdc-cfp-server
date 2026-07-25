import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { GitHub } from "arctic";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { withId } from "src/common/utils/db.util";
import { PermissionsCacheService } from "./services/permissions-cache.service";
import { RefreshTokenService } from "./services/refresh-token.service";
import { ScopedPermissions } from "./types/scoped-permissions";

interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  company: string | null;
  bio: string | null;
  html_url: string;
  location: string | null;
}

interface GithubSocial {
  provider: string;
  url: string;
}

interface JwtPayload {
  sub: string;
  v: number; // tokenVersion
}

@Injectable()
export class AuthService {
  private github: GitHub;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private permissionsCache: PermissionsCacheService,
    private refreshTokenService: RefreshTokenService,
  ) {
    this.github = new GitHub(
      process.env.GITHUB_CLIENT_ID!,
      process.env.GITHUB_CLIENT_SECRET!,
      process.env.GITHUB_REDIRECT_URI!,
    );
  }

  createGithubAuthUrl(state: string) {
    return this.github.createAuthorizationURL(state, ["user:email"]);
  }

  private async fetchGithub<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`https://api.github.com/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NestJS-Auth-App",
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    return response.json() as T;
  }

  async getScopedPermissions(memberId: string): Promise<ScopedPermissions> {
    const memberships = await this.prisma.membership.findMany({
      where: { memberId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const platform = new Set<string>();
    const org: Record<string, Set<string>> = {};
    const event: Record<string, Set<string>> = {};

    for (const m of memberships) {
      const codes = m.role.permissions.map((rp) => rp.permission.code);
      if (m.scopeType === "PLATFORM") {
        codes.forEach((c) => platform.add(c));
      } else if (m.scopeType === "ORG" && m.organizationId) {
        const bucket = (org[m.organizationId] ??= new Set());
        codes.forEach((c) => bucket.add(c));
      } else if (m.scopeType === "EVENT" && m.activityId) {
        const bucket = (event[m.activityId] ??= new Set());
        codes.forEach((c) => bucket.add(c));
      }
    }

    const materialize = (rec: Record<string, Set<string>>) =>
      Object.fromEntries(
        Object.entries(rec).map(([id, set]) => [id, Array.from(set)]),
      );

    return {
      platform: Array.from(platform),
      org: materialize(org),
      event: materialize(event),
    };
  }

  /**
   * Warm the cache for a member and sign a fresh access JWT.
   * Does NOT issue a refresh token — callers do that separately when needed.
   */
  async issueAccessToken(
    memberId: string,
  ): Promise<{ accessToken: string; permissions: ScopedPermissions }> {
    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: memberId },
    });
    const permissions = await this.getScopedPermissions(member.id);
    await this.permissionsCache.setPermissions(member.id, permissions);
    await this.permissionsCache.setTokenVersion(member.id, member.tokenVersion);

    const payload: JwtPayload = { sub: member.id, v: member.tokenVersion };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, permissions };
  }

  async issueSession(memberId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    permissions: ScopedPermissions;
  }> {
    const { accessToken, permissions } = await this.issueAccessToken(memberId);
    const refreshToken = await this.refreshTokenService.issue(memberId);
    return { accessToken, refreshToken, permissions };
  }

  async loginWithGithub(code: string) {
    try {
      const provider = "github";
      const tokens = await this.github.validateAuthorizationCode(code);
      const accessToken = tokens.accessToken();

      const [githubUser, githubEmails, socialAccounts] = await Promise.all([
        this.fetchGithub<GithubProfile>("user", accessToken),
        this.fetchGithub<{ email: string; primary: boolean }[]>(
          "user/emails",
          accessToken,
        ),
        this.fetchGithub<GithubSocial[]>("user/social_accounts", accessToken),
      ]);

      const email =
        githubUser.email || githubEmails.find((e) => e.primary)?.email;

      if (!email) {
        throw new UnauthorizedException(
          "Unable to obtain a valid email address from GitHub",
        );
      }

      const githubProfileLink = withId({
        type: "github",
        url: githubUser.html_url,
      });

      const otherSocialLinks = socialAccounts.map((account) =>
        withId({
          type: account.provider,
          url: account.url,
        }),
      );

      const allLinks = [githubProfileLink, ...otherSocialLinks];

      let user = await this.prisma.member.findUnique({
        where: { email },
        include: { providers: true },
      });

      if (!user) {
        user = await this.prisma.member.create({
          data: withId({
            email,
            displayName: githubUser.name || githubUser.login,
            avatarUrl: githubUser.avatar_url,
            organization: githubUser.company,
            bio: githubUser.bio,
            location: githubUser.location,
            memberLinks: { create: allLinks },
            providers: {
              create: withId({
                provider,
                providerUserId: String(githubUser.id),
              }),
            },
          }),

          include: { providers: true },
        });
      } else {
        const hasGithub = user.providers.some((p) => p.provider === provider);
        if (!hasGithub) {
          await this.prisma.memberProvider.create({
            data: withId({
              memberId: user.id,
              provider,
              providerUserId: String(githubUser.id),
            }),
          });
        }
      }

      const session = await this.issueSession(user.id);

      return {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown error";

      this.logger.error(
        `GitHub login error: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new UnauthorizedException(
        `GitHub Authentication Failed: ${message}`,
      );
    }
  }

  async devLogin(email: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("This endpoint is only available in development");
    }

    let member = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!member) {
      member = await this.prisma.member.create({
        data: withId({
          email,
          displayName: email.split("@")[0],
          providers: {
            create: withId({
              provider: "dev",
              providerUserId: `dev_${Date.now()}`,
            }),
          },
        }),
      });
    }

    const session = await this.issueSession(member.id);

    return {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      user: {
        id: member.id,
        email: member.email,
        permissions: session.permissions,
      },
    };
  }

  async bumpTokenVersion(memberId: string): Promise<void> {
    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.permissionsCache.invalidate(memberId);
    await this.permissionsCache.setTokenVersion(memberId, updated.tokenVersion);
    await this.refreshTokenService.revokeAllForMember(memberId);
  }

  async invalidateUserCache(memberId: string): Promise<void> {
    await this.permissionsCache.invalidate(memberId);
  }
}
