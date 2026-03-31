/**
 * Base API client — shared fetch wrapper and configuration.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env as any).VITE_API_URL ||
  'http://localhost:8000';

/**
 * Authenticated fetch wrapper.
 * Automatically prepends API_BASE and attaches the Bearer token.
 */
export async function authFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  // Only set Content-Type for JSON bodies (not FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/**
 * Throws with the error detail from a failed response.
 */
export async function handleError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ detail: fallback }));
  throw new Error(err.detail || fallback);
}
