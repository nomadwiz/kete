export class ApiError extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class SessionExpired extends Error {
  constructor() {
    super("Your session has ended. Sign in again.");
    this.name = "SessionExpired";
  }
}

export function messageFrom(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;

    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }

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

  return `The server returned an unexpected ${status} response.`;
}
