import { ApiError, SessionExpired } from "./errors";
import { request } from "./http";
import { clearToken, readToken } from "./token";

export async function authed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readToken();

  if (!token) {
    clearToken();
    throw new SessionExpired();
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  try {
    return await request<T>(path, { ...init, headers });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearToken();
      throw new SessionExpired();
    }

    throw error;
  }
}
