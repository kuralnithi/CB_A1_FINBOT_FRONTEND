/**
 * Application-wide constants.
 */

export const ROLES = ['employee', 'finance', 'engineering', 'marketing', 'c_level'] as const;

export type RoleKey = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  finance: 'Finance',
  engineering: 'Engineering',
  marketing: 'Marketing',
  c_level: 'Admin',
};

export const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  finance: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  engineering: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  marketing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  c_level: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

export const ROLE_COLLECTIONS: Record<string, string[]> = {
  employee: ['general'],
  finance: ['finance', 'general'],
  engineering: ['engineering', 'general'],
  marketing: ['marketing', 'general'],
  c_level: ['finance', 'engineering', 'marketing', 'general'],
};

export const VALID_COLLECTIONS = ['general', 'hr', 'finance', 'engineering', 'marketing'] as const;

export const PAGE_SIZE = 8;
export const RESULTS_PAGE_SIZE = 5;
export const POLL_INTERVAL_MS = 2000;

/** Resolve the full list of accessible collections for a user. */
export function resolveCollections(role: string, extraRoles: string[]): string[] {
  const all = new Set<string>(ROLE_COLLECTIONS[role] ?? ['general']);
  extraRoles.forEach((r) => (ROLE_COLLECTIONS[r] ?? []).forEach((c) => all.add(c)));
  return Array.from(all).sort();
}

/** Get the Tailwind badge classes for a role. */
export function getRoleBadgeColor(role: string): string {
  return ROLE_COLORS[role] || ROLE_COLORS.employee;
}
