import { ApiError, messageFrom } from "./errors";

// Read once. The client addresses a local server during development and the
// deployed one afterwards without a code change, which is only true while
// there is exactly one binding for the address.
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function bodyOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Every call to the Kete API goes through here. It knows how to talk HTTP to
// this API and nothing else: no credential, no storage, no routing. That is
// what lets the session rules sit in one place above it instead of being
// tangled through the transport.
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Three DELETE endpoints answer 204 with no body, and reading one as JSON
  // throws. The API's contract includes them whether or not a caller uses one
  // today, so the shared client honours it.
  if (res.status === 204) {
    return undefined as T;
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  throw new ApiError(res.status, messageFrom(await bodyOf(res), res.status));
}
