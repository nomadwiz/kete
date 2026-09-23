import { ApiError, SessionExpired } from "./errors";
import { request } from "./http";
import { clearToken, readToken } from "./token";

// A call that carries the signed-in user's credential. Public endpoints do
// not need a counterpart here — they call `request` directly, which cannot
// sign anyone out because it knows nothing about credentials.
export async function authed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readToken();

  // Checked before a request is built, not after one comes back. FastAPI's
  // HTTPBearer(auto_error=True) answers a missing Authorization header with
  // 403 rather than 401, so waiting for a 401 would never sign out a user
  // whose credential had vanished.
  if (!token) {
    clearToken();
    throw new SessionExpired();
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  try {
    return await request<T>(path, { ...init, headers });
  } catch (error) {
    // A 401 here means a credential that was present and rejected — expired,
    // almost always, since the token lasts twelve hours with no refresh.
    //
    // A 403 is deliberately not caught. After the check above it can no
    // longer mean "no credential sent", so it is something the user should
    // see rather than be silently signed out over.
    if (error instanceof ApiError && error.status === 401) {
      clearToken();
      throw new SessionExpired();
    }

    throw error;
  }
}
