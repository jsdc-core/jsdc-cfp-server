/**
 * E2E global setup — runs (via `setupFiles`) BEFORE any test module is imported.
 *
 * The e2e suite WIPES the database it connects to (see `beforeEach` in the
 * specs). It must therefore NEVER be allowed to point at a real / remote DB.
 * This file is the single choke point that guarantees that:
 *
 *   1. E2E always uses TEST_DATABASE_URL, never the app's DATABASE_URL.
 *   2. If TEST_DATABASE_URL is unset, we abort — no silent fallback.
 *   3. If TEST_DATABASE_URL points anywhere other than localhost, we abort.
 *
 * Because this runs before the specs' `import "dotenv/config"`, and dotenv does
 * not override already-set vars, forcing DATABASE_URL here makes it stick for
 * the whole run (PrismaService reads process.env.DATABASE_URL at construction).
 */
import { config as loadEnv } from "dotenv";

// Load .env so TEST_DATABASE_URL is available. `override` defaults to false, so
// any value already exported in the shell wins — and we set DATABASE_URL
// ourselves below regardless.
loadEnv();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// Explicit deny-list of known remote hosts, checked before the generic rule as
// a belt-and-suspenders guard against typos / partial matches.
const REMOTE_MARKERS = [
  "hnd1.clusters.zeabur.com",
  "clusters.zeabur.com",
  "zeabur.com",
];

function abort(message: string): never {
  // Throwing from setupFiles fails the entire suite before any DB call.
  throw new Error(
    `\n\n❌ E2E aborted — refusing to run against an unsafe database.\n   ${message}\n` +
      `   Set TEST_DATABASE_URL to a local, disposable Postgres, e.g.\n` +
      `   TEST_DATABASE_URL="postgresql://user@localhost:5432/form_platform_test"\n`,
  );
}

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl || testUrl.trim() === "") {
  abort(
    "TEST_DATABASE_URL is not set. E2E will NOT fall back to DATABASE_URL.",
  );
}

let host: string;
try {
  // Postgres URLs parse fine with the WHATWG URL parser.
  host = new URL(testUrl).hostname.toLowerCase();
} catch {
  abort(`TEST_DATABASE_URL is not a valid URL: "${testUrl}"`);
}

for (const marker of REMOTE_MARKERS) {
  if (testUrl.toLowerCase().includes(marker)) {
    abort(`TEST_DATABASE_URL contains a known remote host ("${marker}").`);
  }
}

if (!LOCAL_HOSTS.has(host)) {
  abort(
    `TEST_DATABASE_URL host "${host}" is not local. Only localhost/127.0.0.1 are allowed.`,
  );
}

// Passed every check — force the app (PrismaService, prisma.config.ts) onto the
// test DB. This overrides any DATABASE_URL loaded from .env.
process.env.DATABASE_URL = testUrl;

// E2E tests don't exercise the GitHub OAuth flow — mock arctic to dodge its
// transitive ESM-only deps (@oslojs/*) which Jest can't parse.
jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  })),
  generateState: jest.fn(() => "test-state"),
}));
