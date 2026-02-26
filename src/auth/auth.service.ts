import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { GitHub } from "arctic";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { withId } from "src/common/utils/db.util";

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
  email: string;
  permissions: string[];
}

@Injectable()
export class AuthService {
  private github: GitHub;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

  private async getUserPermissions(memberId: string): Promise<string[]> {
    const permissions = new Set<string>();

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          members: {
            some: { memberId },
          },
        },
      },
      include: {
        permission: true,
      },
    });

    rolePermissions.forEach((rp) => {
      permissions.add(rp.permission.code);
    });

    return Array.from(permissions);
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

      const permissions = await this.getUserPermissions(user.id);

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        permissions,
      };

      return {
        access_token: await this.jwtService.signAsync(payload),
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

    const permissions = await this.getUserPermissions(member.id);

    const payload: JwtPayload = {
      sub: member.id,
      email: member.email,
      permissions,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: member.id,
        email: member.email,
        permissions,
      },
    };
  }
}
