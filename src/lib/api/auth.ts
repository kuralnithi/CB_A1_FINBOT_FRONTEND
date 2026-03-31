/**
 * Auth API functions.
 */
import { API_BASE } from './client';
import { API_ROUTES } from '@/lib/routes';
import type { TokenResponse } from '@/lib/types';

export async function login(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}${API_ROUTES.AUTH.LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}
