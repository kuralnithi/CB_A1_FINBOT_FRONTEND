/**
 * Evaluation & LangSmith API functions.
 */
import { API_ROUTES } from '@/lib/routes';
import { authFetch, handleError } from './client';
import type { EvalRunInfo, EvalStatus } from '@/lib/types';

export async function addToLangsmithDataset(
  id: number,
  query: string,
  answer: string,
  ground_truth: string,
  token: string
) {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.ADD_TO_DATASET, token, {
    method: 'POST',
    body: JSON.stringify({ id, query, answer, ground_truth }),
  });
  if (!res.ok) await handleError(res, 'Failed to add to dataset');
  return res.json();
}

export async function bulkAddToLangsmithDataset(
  items: { id: number; query: string; answer: string; ground_truth: string }[],
  token: string
) {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.BULK_ADD, token, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  if (!res.ok) await handleError(res, 'Bulk add failed');
  return res.json();
}

export async function runLangsmithEvaluation(token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.RUN, token, { method: 'POST' });
  if (!res.ok) await handleError(res, 'Failed to run evaluation');
  return res.json();
}

export async function getEvalStatus(token: string): Promise<EvalStatus> {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.STATUS, token);
  if (!res.ok) return { status: 'error', progress: 0, current: 0, total: 0, message: 'Failed to fetch status' };
  return res.json();
}

export async function listEvalRuns(token: string): Promise<EvalRunInfo[]> {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.RUNS, token);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteEvalRun(runId: number, token: string): Promise<boolean> {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.RUN_BY_ID(runId), token, { method: 'DELETE' });
  return res.ok;
}

export async function deleteQueryLog(queryId: number, token: string): Promise<boolean> {
  const res = await authFetch(API_ROUTES.ADMIN.QUERY(queryId), token, { method: 'DELETE' });
  return res.ok;
}

export async function listRecentQueries(token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.QUERIES, token);
  if (!res.ok) return [];
  return res.json();
}

export async function recommendGroundTruth(query: string, answer: string, token: string): Promise<string> {
  const res = await authFetch(API_ROUTES.ADMIN.EVAL.RECOMMEND_GROUND_TRUTH, token, {
    method: 'POST',
    body: JSON.stringify({ query, answer }),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.recommendation;
}
