import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { withId } from "src/common/utils/db.util";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RotateResult {
  memberId: string;
  rawToken: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  private generateRaw(): string {
    return randomBytes(32).toString("base64url");
  }

  async issue(memberId: string): Promise<string> {
    const rawToken = this.generateRaw();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: withId({
        memberId,
        tokenHash: this.hash(rawToken),
        expiresAt,
      }),
    });

    return rawToken;
  }

  /**
   * Rotate a refresh token. Returns the new raw token + memberId.
   * If the presented token is already revoked, treats it as theft:
   * the caller should bump tokenVersion to kill all sessions.
   */
  async rotate(
    rawToken: string,
  ): Promise<RotateResult & { reuseDetectedMemberId?: string }> {
    const tokenHash = this.hash(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (existing.revokedAt) {
      // Reuse detected — caller must bump tokenVersion.
      throw new RefreshTokenReuseError(existing.memberId);
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const newRaw = this.generateRaw();
    const newExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const created = await this.prisma.refreshToken.create({
      data: withId({
        memberId: existing.memberId,
        tokenHash: this.hash(newRaw),
        expiresAt: newExpires,
      }),
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: created.id },
    });

    return { memberId: existing.memberId, rawToken: newRaw };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForMember(memberId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export class RefreshTokenReuseError extends Error {
  constructor(public readonly memberId: string) {
    super("Refresh token reuse detected");
  }
}
