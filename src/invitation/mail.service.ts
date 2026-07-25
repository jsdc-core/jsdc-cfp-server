import { Injectable, Logger } from "@nestjs/common";

export interface InvitationEmail {
  to: string;
  scopeLabel: string; // e.g. "organization JSDC" / "activity jsdc-2026"
  acceptUrl: string;
  expiresAt: Date;
}

/**
 * Stub mailer. Logs the invitation instead of sending a real email.
 * Swap the implementation for a real provider (SES/SendGrid/SMTP) later;
 * callers depend only on `sendInvitation`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendInvitation(email: InvitationEmail): Promise<void> {
    this.logger.log(
      `[invitation] to=${email.to} scope="${email.scopeLabel}" ` +
        `expires=${email.expiresAt.toISOString()} url=${email.acceptUrl}`,
    );
    await Promise.resolve();
  }
}
