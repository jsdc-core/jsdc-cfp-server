/**
 * Auth e2e — covers the rotating-refresh + RBAC flows.
 *
 * Requirements:
 *   - DATABASE_URL points at a test DB you don't mind wiping.
 *   - NODE_ENV !== "production" (we force "development" here).
 *
 * Run with:  pnpm test:e2e
 */
import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { PermissionsCacheService } from "../src/auth/services/permissions-cache.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { withId } from "../src/common/utils/db.util";

const API = "/api/v1";

function getCookie(
  setCookie: string[] | undefined,
  name: string,
): string | null {
  if (!setCookie) return null;
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    if (k === name) return v;
  }
  return null;
}

describe("Auth e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "development";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    const reflector = app.get(Reflector);
    const prismaForGuard = app.get(PrismaService);
    const cacheForGuard = app.get(PermissionsCacheService);
    app.useGlobalGuards(
      new JwtAuthGuard(reflector),
      new PermissionGuard(reflector, prismaForGuard, cacheForGuard),
    );
    await app.init();
    await app.listen(0);
    const server = app.getHttpServer();
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Order respects FK constraints.
    await prisma.refreshToken.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.activityContent.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});
    await prisma.memberLink.deleteMany({});
    await prisma.memberProvider.deleteMany({});
    await prisma.member.deleteMany({});
  });

  describe("auth lifecycle", () => {
    it("dev-login → /me → refresh → logout", async () => {
      const agent = request.agent(baseUrl);

      const login = await agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "alice@example.com" });
      expect(login.status).toBe(201);
      expect(login.body.user.email).toBe("alice@example.com");

      const setCookies = login.headers["set-cookie"] as unknown as
        | string[]
        | undefined;
      expect(getCookie(setCookies, "access_token")).toBeTruthy();
      expect(getCookie(setCookies, "refresh_token")).toBeTruthy();

      const me1 = await agent.get(`${API}/auth/me`);
      expect(me1.status).toBe(200);
      expect(me1.body.email).toBe("alice@example.com");

      const oldRefresh = getCookie(setCookies, "refresh_token");

      const refresh = await agent.post(`${API}/auth/refresh`);
      expect(refresh.status).toBe(201);
      const refreshCookies = refresh.headers["set-cookie"] as unknown as
        | string[]
        | undefined;
      const newAccess = getCookie(refreshCookies, "access_token");
      const newRefresh = getCookie(refreshCookies, "refresh_token");
      expect(newAccess).toBeTruthy();
      expect(newRefresh).toBeTruthy();
      // Access JWT may equal the original if signed within the same second
      // (same sub+v+iat). Refresh token is random — it must rotate.
      expect(newRefresh).not.toBe(oldRefresh);

      const me2 = await agent.get(`${API}/auth/me`);
      expect(me2.status).toBe(200);

      const logout = await agent.post(`${API}/auth/logout`);
      expect(logout.status).toBe(201);

      const me3 = await agent.get(`${API}/auth/me`);
      expect(me3.status).toBe(401);
    });
  });

  describe("refresh-token reuse detection", () => {
    it("replaying a rotated refresh token kills all sessions", async () => {
      const agent = request.agent(baseUrl);

      const login = await agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "bob@example.com" });
      const loginCookies = login.headers["set-cookie"] as unknown as string[];
      const stolenRefresh = getCookie(loginCookies, "refresh_token")!;
      expect(stolenRefresh).toBeTruthy();

      // Legitimate rotation — agent's cookie jar advances.
      const ok = await agent.post(`${API}/auth/refresh`);
      expect(ok.status).toBe(201);

      // /me still works on the rotated session.
      const meWarm = await agent.get(`${API}/auth/me`);
      expect(meWarm.status).toBe(200);

      // Attacker replays the OLD (now-revoked) refresh token from a clean client.
      const replay = await request(baseUrl)
        .post(`${API}/auth/refresh`)
        .set("Cookie", `refresh_token=${stolenRefresh}`);
      expect(replay.status).toBe(401);

      // Reuse detection bumped tokenVersion → the legit agent's access is now invalid too.
      const meCold = await agent.get(`${API}/auth/me`);
      expect(meCold.status).toBe(401);
    });
  });

  describe("scoped RBAC", () => {
    // Builds the org/event permission catalogue + roles used by the scoped tests.
    async function seedScopedFixtures() {
      const codes = ["org:member:manage", "event:member:manage", "event:edit"];
      const perm: Record<string, string> = {};
      for (const code of codes) {
        const p = await prisma.permission.create({ data: withId({ code }) });
        perm[code] = p.id;
      }

      // Org role that also carries event:member:manage so it cascades to events.
      const orgManager = await prisma.role.create({
        data: withId({
          name: "OrgManager",
          scope: "ORG",
          permissions: {
            create: [
              { permission_id: perm["org:member:manage"] },
              { permission_id: perm["event:member:manage"] },
            ],
          },
        }),
      });
      const eventEditor = await prisma.role.create({
        data: withId({
          name: "EventEditor",
          scope: "EVENT",
          permissions: { create: [{ permission_id: perm["event:edit"] }] },
        }),
      });

      const org = await prisma.organization.create({
        data: withId({ name: "JSDC", slug: "jsdc" }),
      });
      const activity = await prisma.activity.create({
        data: withId({
          name: "JSDC 2026",
          slug: "jsdc-2026",
          organizationId: org.id,
          startAt: new Date(),
          endAt: new Date(),
          supportedLanguages: ["en"],
        }),
      });

      return { org, activity, orgManager, eventEditor, perm };
    }

    async function login(email: string) {
      const agent = request.agent(baseUrl);
      const res = await agent.post(`${API}/auth/dev-login`).send({ email });
      return { agent, body: res.body };
    }

    it("org role cascades to events: org manager assigns an event role", async () => {
      const { org, activity, orgManager, eventEditor } =
        await seedScopedFixtures();

      const admin = await login("orgadmin@example.com");
      await prisma.membership.create({
        data: withId({
          memberId: admin.body.user.id,
          roleId: orgManager.id,
          scopeType: "ORG",
          organizationId: org.id,
        }),
      });
      // Re-login to refresh the cached scoped permissions.
      const adminReLogin = await admin.agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "orgadmin@example.com" });
      expect(adminReLogin.body.user.permissions.org[org.id]).toEqual(
        expect.arrayContaining(["org:member:manage", "event:member:manage"]),
      );

      const target = await login("speaker@example.com");
      const targetId = target.body.user.id;
      expect(target.body.user.permissions.event).toEqual({});

      // Org manager manages an EVENT member via the org→event cascade.
      const assign = await admin.agent
        .put(`${API}/activities/${activity.id}/members/${targetId}/roles`)
        .send({ roleIds: [eventEditor.id] });
      expect(assign.status).toBe(200);

      // Target's old cookie is revoked; re-login shows the event permission.
      expect((await target.agent.get(`${API}/auth/me`)).status).toBe(401);
      const targetReLogin = await target.agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "speaker@example.com" });
      expect(targetReLogin.body.user.permissions.event[activity.id]).toEqual([
        "event:edit",
      ]);
    });

    it("an event-only member cannot manage a different activity", async () => {
      const { activity, eventEditor, perm } = await seedScopedFixtures();

      // A second activity with no shared org.
      const otherActivity = await prisma.activity.create({
        data: withId({
          name: "Other",
          slug: "other",
          startAt: new Date(),
          endAt: new Date(),
          supportedLanguages: ["en"],
        }),
      });

      // An EVENT role that can manage activity members.
      const eventManagerRole = await prisma.role.create({
        data: withId({
          name: "EventManager",
          scope: "EVENT",
          permissions: {
            create: [{ permission_id: perm["event:member:manage"] }],
          },
        }),
      });

      const user = await login("eventonly@example.com");
      await prisma.membership.create({
        data: withId({
          memberId: user.body.user.id,
          roleId: eventManagerRole.id,
          scopeType: "EVENT",
          activityId: activity.id,
        }),
      });
      await user.agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "eventonly@example.com" });

      // Can manage its own activity…
      const ownTarget = await login("t1@example.com");
      const ok = await user.agent
        .put(
          `${API}/activities/${activity.id}/members/${ownTarget.body.user.id}/roles`,
        )
        .send({ roleIds: [eventEditor.id] });
      expect(ok.status).toBe(200);

      // …but not a different activity.
      const denied = await user.agent
        .put(
          `${API}/activities/${otherActivity.id}/members/${ownTarget.body.user.id}/roles`,
        )
        .send({ roleIds: [eventEditor.id] });
      expect(denied.status).toBe(403);
    });

    it("invitation accept grants the scoped role; expired invite returns 410", async () => {
      const { org, orgManager } = await seedScopedFixtures();

      const admin = await login("owner@example.com");
      await prisma.membership.create({
        data: withId({
          memberId: admin.body.user.id,
          roleId: orgManager.id,
          scopeType: "ORG",
          organizationId: org.id,
        }),
      });
      await admin.agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "owner@example.com" });

      // Invite a teammate to the org.
      const invite = await admin.agent
        .post(`${API}/organizations/${org.id}/invitations`)
        .send({ email: "invitee@example.com", roleId: orgManager.id });
      expect(invite.status).toBe(201);
      const token = invite.body.token;
      expect(token).toBeTruthy();

      // Invitee logs in and accepts.
      const invitee = await login("invitee@example.com");
      const accept = await invitee.agent
        .post(`${API}/invitations/accept`)
        .send({ token });
      expect(accept.status).toBe(201);

      const inviteeReLogin = await invitee.agent
        .post(`${API}/auth/dev-login`)
        .send({ email: "invitee@example.com" });
      expect(inviteeReLogin.body.user.permissions.org[org.id]).toEqual(
        expect.arrayContaining(["org:member:manage"]),
      );

      // An expired invitation is rejected with 410 Gone.
      const expired = await prisma.invitation.create({
        data: withId({
          email: "late@example.com",
          token: "expired-token-123",
          status: "PENDING",
          scopeType: "ORG",
          organizationId: org.id,
          roleId: orgManager.id,
          invitedById: admin.body.user.id,
          expiresAt: new Date(Date.now() - 1000),
        }),
      });
      const late = await login("late@example.com");
      const acceptLate = await late.agent
        .post(`${API}/invitations/accept`)
        .send({ token: expired.token });
      expect(acceptLate.status).toBe(410);
    });

    it("a member with no roles cannot call protected RBAC endpoints", async () => {
      const { org } = await seedScopedFixtures();
      const nobody = await login("nobody@example.com");

      const list = await nobody.agent.get(
        `${API}/organizations/${org.id}/invitations`,
      );
      expect(list.status).toBe(403);
    });
  });
});
