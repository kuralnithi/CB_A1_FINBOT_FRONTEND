/**
 * API client for the FinBot backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:8000';

export interface User {
  username: string;
  role: string;
  display_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SourceCitation {
  document: string;
  page_number: number;
  section: string;
  chunk_type: string;
  relevance_score: number;
}

export interface GuardrailWarning {
  type: string;
  message: string;
  severity: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  route_selected: string;
  user_role: string;
  accessible_collections: string[];
  guardrail_warnings: GuardrailWarning[];
  blocked: boolean;
  blocked_reason: string;
}

export interface DocumentInfo {
  filename: string;
  collection: string;
  chunk_count: number;
  status: string;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
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

// ─── Chat ──────────────────────────────────────────────────────────────────────

export async function sendMessage(
  query: string,
  sessionId: string,
  token: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Chat request failed');
  }
  return res.json();
}

// ─── Admin ─────────────────────────────────────────────────────────────────────

export async function triggerIngestion(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Ingestion failed');
  }
  return res.json();
}

export async function listDocuments(token: string): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/api/admin/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteDocument(filename: string, token: string) {
  const res = await fetch(`${API_BASE}/api/admin/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Delete failed');
  }
  return res.json();
}

export async function listUsers(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function updateUserRole(username: string, role: string, token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(username)}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Role update failed');
  }
  return res.json();
}

export async function updateUserExtraRoles(username: string, extra_roles: string[], token: string) {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(username)}/extra-roles`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ extra_roles }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Extra roles update failed');
  }
  return res.json();
}

export async function deleteUser(username: string, token: string) {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'User delete failed');
  }
  return res.json();
}

export async function uploadDocument(file: File, collection: string, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collection', collection);

  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export interface QueryLogInfo {
  id: number;
  username: string;
  query: string;
  answer: string;
  user_role: string;
  routing_selected: string;
  is_exported: boolean;
  created_at: string;
}

export async function listRecentQueries(token: string): Promise<QueryLogInfo[]> {
  const res = await fetch(`${API_BASE}/api/admin/queries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function addToLangsmithDataset(id: number, query: string, answer: string, ground_truth: string, token: string) {
  const res = await fetch(`${API_BASE}/api/admin/eval/add-to-dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ id, query, answer, ground_truth }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to add to dataset');
  }
  return res.json();
}

export async function bulkAddtoLangsmithDataset(items: { id: number; query: string; answer: string; ground_truth: string }[], token: string) {
  const res = await fetch(`${API_BASE}/api/admin/eval/bulk-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Bulk add failed');
  }
  return res.json();
}

export async function runLangsmithEvaluation(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/eval/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to run evaluation');
  }
  return res.json();
}

export interface EvalRunInfo {
  id: number;
  experiment_name: string;
  dataset_name: string;
  total_examples: number;
  avg_exact_match: number | null;
  results_url: string | null;
  per_example_results: string | null; // JSON string
  triggered_by: string;
  created_at: string;
}

export async function listEvalRuns(token: string): Promise<EvalRunInfo[]> {
  const res = await fetch(`${API_BASE}/api/admin/eval/runs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}
export async function deleteEvalRun(runId: number, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/eval/runs/${runId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function deleteQueryLog(queryId: number, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/queries/${queryId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}


export async function recommendGroundTruth(query: string, answer: string, token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/admin/eval/recommend-ground-truth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, answer }),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.recommendation;
}
