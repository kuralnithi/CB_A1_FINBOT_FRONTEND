/**
 * Shared TypeScript interfaces for the FinBot frontend.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  username: string;
  role: string;
  display_name: string;
  extra_roles?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

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

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  response?: Partial<ChatResponse>;
  timestamp: Date;
  status?: string;
}

export interface StreamChunk {
  token?: string;
  status?: string;
  error?: string;
  done?: boolean;
  blocked?: boolean;
  reason?: string;
  accessible_collections?: string[];
  sources?: SourceCitation[];
  guardrail_warnings?: GuardrailWarning[];
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface DocumentInfo {
  filename: string;
  collection: string;
  chunk_count: number;
  status: string;
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

export interface EvalRunInfo {
  id: number;
  experiment_name: string;
  dataset_name: string;
  total_examples: number;
  avg_exact_match: number | null;
  results_url: string | null;
  per_example_results: string | null;
  triggered_by: string;
  created_at: string;
}

export interface IngestionStatus {
  status: string;
  progress: number;
  message: string;
}

export interface EvalStatus {
  status: string;
  progress: number;
  current: number;
  total: number;
  message: string;
}
