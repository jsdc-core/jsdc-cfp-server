// E2E tests don't exercise the GitHub OAuth flow — mock arctic to dodge its
// transitive ESM-only deps (@oslojs/*) which Jest can't parse.
jest.mock("arctic", () => ({
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  })),
  generateState: jest.fn(() => "test-state"),
}));
