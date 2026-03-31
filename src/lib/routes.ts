/**
 * Centralized route registry for the entire application.
 *
 * PAGE_ROUTES  — Next.js client-side navigation paths.
 * API_ROUTES   — Backend API endpoint paths (appended to API_BASE).
 *
 * Usage:
 *   import { PAGE_ROUTES, API_ROUTES } from '@/lib/routes';
 *   router.push(PAGE_ROUTES.CHAT);
 *   fetch(`${API_BASE}${API_ROUTES.ADMIN.USERS}`);
 *   fetch(`${API_BASE}${API_ROUTES.ADMIN.USER_ROLE('john')}`);
 */

// ─── Page Routes ─────────────────────────────────────────────────────────────

export const PAGE_ROUTES = {
  LOGIN: '/',
  CHAT: '/chat',
  ADMIN: '/admin',
} as const;

// ─── API Routes ──────────────────────────────────────────────────────────────

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    SETUP_ADMIN: '/api/auth/setup-admin',
    ME: '/api/auth/me',
  },

  CHAT: {
    SEND: '/api/chat',
    STREAM: '/api/chat/stream',
  },

  ADMIN: {
    // Ingestion
    INGEST: '/api/admin/ingest',
    INGEST_STATUS: '/api/admin/ingest/status',

    // Documents
    DOCUMENTS: '/api/admin/documents',
    DOCUMENT: (filename: string) =>
      `/api/admin/documents/${encodeURIComponent(filename)}`,
    UPLOAD: '/api/admin/upload',

    // Users
    USERS: '/api/admin/users',
    USER: (username: string) =>
      `/api/admin/users/${encodeURIComponent(username)}`,
    USER_ROLE: (username: string) =>
      `/api/admin/users/${encodeURIComponent(username)}/role`,
    USER_EXTRA_ROLES: (username: string) =>
      `/api/admin/users/${encodeURIComponent(username)}/extra-roles`,

    // Query Logs
    QUERIES: '/api/admin/queries',
    QUERY: (id: number) => `/api/admin/queries/${id}`,

    // Evaluation
    EVAL: {
      ADD_TO_DATASET: '/api/admin/eval/add-to-dataset',
      BULK_ADD: '/api/admin/eval/bulk-add',
      RUN: '/api/admin/eval/run',
      STATUS: '/api/admin/eval/status',
      RUNS: '/api/admin/eval/runs',
      RUN_BY_ID: (id: number) => `/api/admin/eval/runs/${id}`,
      RECOMMEND_GROUND_TRUTH: '/api/admin/eval/recommend-ground-truth',
    },
  },
} as const;
