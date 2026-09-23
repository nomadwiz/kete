const TOKEN_KEY = "kete.token";

export function readToken(): string | null {
  try {
    // getItem answers null for an absent key, but something can still have
    // written an empty string. Both mean "no credential", so they collapse to
    // one falsy value and every caller has a single case to test.
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
    // Nothing to clear if storage was never reachable.
  }
}
