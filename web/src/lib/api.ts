import axios, { type AxiosInstance } from "axios";

/**
 * Base URL for the NestJS backend.
 *
 * The backend listens on PORT=4000 with an `api/v1` global prefix and issues an
 * httpOnly `access_token` cookie on login, so every request must send cookies
 * (`withCredentials`). Configure via VITE_API_BASE_URL (see web/.env).
 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/** localStorage key holding the bearer token issued on login. */
export const AUTH_TOKEN_KEY = "form_platform_token";

/** Read the stored JWT, or `null` when the user is logged out. */
export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/** Persist the JWT so it survives reloads. */
export function setToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/** Drop the stored JWT (logout). */
export function clearToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Attach the bearer token to every request. The backend also accepts the
// httpOnly cookie, so this is complementary — belt and suspenders across
// browsers/contexts where third-party cookies are blocked.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handling: the JWT cookie is missing/expired or the token version
// was bumped server-side. Bounce to the login page (skip if already there).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearToken();
    }
    if (status === 401 && !window.location.pathname.startsWith("/login")) {
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.assign(`/login?redirect=${redirect}`);
    }
    return Promise.reject(error);
  },
);

export default api;
