// A failed call, carrying the status alongside a message a screen can show. A
// class rather than a plain object so that the route error boundary can tell
// it apart with `instanceof` from the TypeError `fetch` rejects with when the
// server is unreachable.
export class ApiError extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Raised when the stored credential is absent or the server rejects it. It
// says what happened, not what to do about it: turning it into a redirect is
// the router's job, because only the router knows the addresses.
export class SessionExpired extends Error {
  constructor() {
    super("Your session has ended. Sign in again.");
    this.name = "SessionExpired";
  }
}

// The one place an error body becomes a message.
export function messageFrom(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;

    // Every HTTPException in backend/main.py. Written for a person to read,
    // so they pass through untouched.
    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }

    // FastAPI raises its own 422 with `detail` as a list of validation
    // objects rather than a string. This branch reads as dead code against
    // any description of the API that mentions only the string form — it is
    // not. Removing it renders "[object Object]" on the first bad request.
    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) =>
          typeof entry === "object" && entry !== null && "msg" in entry
            ? (entry as { msg: unknown }).msg
            : null,
        )
        .filter((msg): msg is string => typeof msg === "string");

      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
  }

  // A proxy's HTML error page, an empty body, or a body that was never JSON.
  // Built from the status alone: HTTP/2 dropped the reason phrase, so
  // Response.statusText is empty on any such connection.
  return `The server returned an unexpected ${status} response.`;
}
