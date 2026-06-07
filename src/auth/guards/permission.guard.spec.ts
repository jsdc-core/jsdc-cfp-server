import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { PermissionGuard } from "./permission.guard";
import { AuthUser } from "../strategies/jwt.strategy";

describe("PermissionGuard", () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockExecutionContext = (
    user?: AuthUser,
    handlerPermissions?: string[],
    classPermissions?: string[],
  ): ExecutionContext => {
    const request = { user } as any;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: reflectorMock },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow access when no permissions are required", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockExecutionContext(undefined);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should deny access when user is not authenticated", () => {
    reflector.getAllAndOverride.mockReturnValue(["activity:manage"]);

    const context = createMockExecutionContext(undefined);
    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should allow access when user has all required permissions", () => {
    reflector.getAllAndOverride.mockReturnValue([
      "activity:manage",
      "submission:read",
    ]);

    const user: AuthUser = {
      id: "member-1",
      permissions: ["activity:manage", "submission:read", "user:read"],
      tokenVersion: 1,
    };

    const context = createMockExecutionContext(user);
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should deny access when user lacks one required permission", () => {
    reflector.getAllAndOverride.mockReturnValue([
      "activity:manage",
      "submission:read",
    ]);

    const user: AuthUser = {
      id: "member-1",
      permissions: ["activity:manage"],
      tokenVersion: 1,
    };

    const context = createMockExecutionContext(user);
    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should deny access when user has empty permissions", () => {
    reflector.getAllAndOverride.mockReturnValue(["activity:manage"]);

    const user: AuthUser = {
      id: "member-1",
      permissions: [],
      tokenVersion: 1,
    };

    const context = createMockExecutionContext(user);
    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });
});
