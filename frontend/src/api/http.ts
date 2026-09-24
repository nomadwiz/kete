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

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  throw new ApiError(res.status, messageFrom(await bodyOf(res), res.status));
}
