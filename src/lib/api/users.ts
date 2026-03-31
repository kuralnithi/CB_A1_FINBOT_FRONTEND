/**
 * User management API functions.
 */
import { API_ROUTES } from '@/lib/routes';
import { authFetch, handleError } from './client';
import type { User } from '@/lib/types';

export async function listUsers(token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.USERS, token);
  if (!res.ok) return [];
  return res.json();
}

export async function createUser(
  newUser: { username: string; password: string; role: string; display_name: string },
  token: string
): Promise<User> {
  const res = await authFetch(API_ROUTES.ADMIN.USERS, token, {
    method: 'POST',
    body: JSON.stringify(newUser),
  });
  if (!res.ok) await handleError(res, 'Failed to create user');
  return res.json();
}

export async function updateUserRole(username: string, role: string, token: string): Promise<User> {
  const res = await authFetch(API_ROUTES.ADMIN.USER_ROLE(username), token, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) await handleError(res, 'Role update failed');
  return res.json();
}

export async function updateUserExtraRoles(username: string, extra_roles: string[], token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.USER_EXTRA_ROLES(username), token, {
    method: 'PATCH',
    body: JSON.stringify({ extra_roles }),
  });
  if (!res.ok) await handleError(res, 'Extra roles update failed');
  return res.json();
}

export async function deleteUser(username: string, token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.USER(username), token, { method: 'DELETE' });
  if (!res.ok) await handleError(res, 'User delete failed');
  return res.json();
}
