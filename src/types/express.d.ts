import { AuthUser } from "../auth/strategies/jwt.strategy";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
