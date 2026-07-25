import { isAxiosError } from "axios";

/**
 * Extract a human-readable message from an API error. NestJS error responses
 * carry `{ message: string | string[] }`; validation errors use the array form.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "操作失敗",
): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join("、");
    if (typeof message === "string") return message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
