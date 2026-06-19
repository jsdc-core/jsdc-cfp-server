# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development (watch mode)
pnpm start:dev

# Build
pnpm build

# Lint (auto-fix)
pnpm lint

# Unit tests
pnpm test

# Run a single test file
pnpm test -- --testPathPattern=activity

# E2E tests
pnpm test:e2e

# Database migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Generate Prisma client (after schema changes)
npx prisma generate
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWTs
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` — GitHub OAuth app credentials
- `CLIENT_URL` — Frontend origin for CORS and OAuth redirect (default: `http://localhost:3000`)
- `PORT` — Server port (default: `4000`)

## Architecture

This is a NestJS + Prisma + PostgreSQL API server for a conference CFP (Call for Papers) platform.

**Global setup (`src/main.ts`):** The app runs on `api/v1` prefix. `JwtAuthGuard` and `PermissionGuard` are applied globally — all routes require a valid JWT unless decorated with `@Public()`.

**Auth flow (`src/auth/`):**
- GitHub OAuth via the `arctic` library. Callback sets an `access_token` httpOnly cookie containing a JWT.
- JWT payload carries `{ sub: memberId, email, permissions: string[] }`. Permissions are resolved at login time by walking `Member → MemberRole → Role → RolePermission → Permission`.
- `POST /auth/dev-login` is available in non-production for quick local testing without GitHub OAuth.
- To mark a route public: use the `@Public()` decorator. To require a permission: use `@Permissions('permission:code')`.

**Permission model (`prisma/models/role.prisma`):** `Member` → `MemberRole` (join) → `Role` → `RolePermission` (join) → `Permission`. Permissions use colon-namespaced codes (e.g., `activity:manage`). Seed creates an `admin` role with all permissions.

**Prisma setup:**
- Schema is split across `prisma/models/*.prisma` files; `prisma.config.ts` points Prisma at the `prisma/` directory.
- Generated client lives in `generated/prisma/` (not `node_modules`).
- Uses the `@prisma/adapter-pg` driver adapter (connection pool via `pg`).
- All IDs are UUIDv7 strings. Use the `withId()` helper from `src/common/utils/db.util.ts` when creating records.

**Activity module (`src/activity/`):** Demonstrates the standard pattern:
- Public route: `GET /activities/slug/:slug` — uses `@Public()`, returns only `supportedLanguages`-filtered contents.
- Admin routes: require `activity:manage` permission via `@Permissions(...)`.
- `ActivityContent` is the i18n table; each `Activity` has multiple `ActivityContent` rows keyed by `lang`.

**Swagger:** Available at `/docs` in development.
