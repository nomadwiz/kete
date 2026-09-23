import { redirect } from "react-router";

import { PATHS } from "../routes";
import { ApiError, messageFromDetails } from "./errors";
import { clearToken, readToken } from "./token";

// Read once, at module scope. The client addresses a local server during
// development and the deployed one afterwards without a code change, which is
// only true while there is exactly one binding for the address.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function withHeaders(init: RequestInit, token?: string): RequestInit {
  const headers = new Headers(init.headers);

  // Only a string body is JSON here. FormData sets its own content type with
  // a multipart boundary, and overriding it makes the upload unparseable.
  if (typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return { ...init, headers };
}

async function bodyOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);

  // The three DELETE endpoints answer 204 with no body at all, and reading
  // one as JSON throws.
  if (res.status === 204) {
    return undefined as T;
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  throw new ApiError(
    res.status,
    messageFromDetails(await bodyOf(res), res.status),
  );
}

// For /login and /register only. Carries no credential and never redirects.
// POST /login answers 401 by design, so that an attacker cannot discover
// which usernames exist; a redirect here would bounce a failed sign-in back
// to its own page and swallow the server's message.
export function apiPublic<T>(path: string, init: RequestInit = {}): Promise<T> {
  return send<T>(path, withHeaders(init));
}

// For every other endpoint. Called from a route loader or action, never from
// a component.
export async function apiAuth<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readToken();

  // Checked before a request is built, not after one comes back. FastAPI's
  // HTTPBearer(auto_error=True) answers a missing header with 403 rather than
  // 401, so a wrapper that sent the request anyway and watched for 401 would
  // never sign this user out. Throwing a redirect from here reaches the
  // router through whichever loader called it.
  if (!token) {
    clearToken();
    throw redirect(PATHS.sign_in);
  }

  try {
    return await send<T>(path, withHeaders(init, token));
  } catch (error) {
    // A 401 now means a credential that was present and rejected — expired,
    // almost always, since the token lasts twelve hours and there is no
    // refresh, so it dies mid-session rather than only at startup.
    //
    // A 403 is deliberately not caught here. After the check above it can no
    // longer mean "no credential sent", so it is something the user should
    // see rather than be silently signed out over.
    if (error instanceof ApiError && error.status === 401) {
      clearToken();
      throw redirect(PATHS.sign_in);
    }

    throw error;
  }
}
