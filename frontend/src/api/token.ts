const TOKEN_KEY = "kete.token";

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function writeToken(token: string): boolean {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}
