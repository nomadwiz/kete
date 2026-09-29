import { ApiError, messageFrom } from "./errors";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function bodyOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // C29 (nomadwiz/kete#288). The address is built through the URL parser and
  // refused if parsing changed it. react-router decodes a path parameter
  // before a loader or action sees it, so a request for /recipes/..%2Fprofile
  // arrives here as the path /recipes/../profile, which the parser normalises
  // to /profile -- a different endpoint under the same bearer token. Comparing
  // the parsed pathname against the one that was asked for catches every
  // spelling of that wherever the path was assembled, including the two a
  // check on the raw string would miss: `%2e%2e` and a backslash both
  // normalise the same way, verified in node rather than assumed.
  //
  // BASE_URL may carry a path component, so the comparison is against the
  // base's own pathname rather than the root -- under which nothing can escape
  // and the check would pass everything. A trailing slash on it is dropped so
  // that configuring one is not a refusal of every request.
  //
  // A plain Error, not an ApiError: no server answered. This is a malformed
  // request the client built, and it belongs to the ErrorBoundary that the
  // loader and action machinery throws it to, not to a screen's validation
  // surface.
  const base = new URL(BASE_URL);
  const basePath = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${base.origin}${basePath}${path}`);

  if (url.pathname !== `${basePath}${path.split(/[?#]/)[0]}`) {
    throw new Error(`Refusing to request an address that is not ${path}.`);
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  throw new ApiError(res.status, messageFrom(await bodyOf(res), res.status));
}
