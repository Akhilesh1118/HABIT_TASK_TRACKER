/**
 * Client-side authentication and session token manager.
 * Ensures session resilience across page reloads, iframe environments, and network conditions.
 */

const TOKEN_STORAGE_KEY = 'habits_app_jwt_token';
const SESSION_ACTIVE_KEY = 'auth_session_active';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
  } catch {
    // Non-blocking storage error
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  } catch {
    // Non-blocking storage error
  }
}

/**
 * Standard authenticated fetch helper that attaches credentials and Bearer token automatically.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    credentials: init.credentials || 'include',
    headers,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    // Session has expired or token is invalid
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth:session_expired'));
  }

  return response;
}
