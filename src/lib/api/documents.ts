/**
 * Document management API functions.
 */
import { API_ROUTES } from '@/lib/routes';
import { authFetch, handleError } from './client';
import type { DocumentInfo, IngestionStatus } from '@/lib/types';

export async function triggerIngestion(token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.INGEST, token, { method: 'POST' });
  if (!res.ok) await handleError(res, 'Ingestion failed');
  return res.json();
}

export async function getIngestionStatus(token: string): Promise<IngestionStatus> {
  const res = await authFetch(API_ROUTES.ADMIN.INGEST_STATUS, token);
  if (!res.ok) return { status: 'error', progress: 0, message: 'Failed to fetch status' };
  return res.json();
}

export async function listDocuments(token: string): Promise<DocumentInfo[]> {
  const res = await authFetch(API_ROUTES.ADMIN.DOCUMENTS, token);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteDocument(filename: string, token: string) {
  const res = await authFetch(API_ROUTES.ADMIN.DOCUMENT(filename), token, { method: 'DELETE' });
  if (!res.ok) await handleError(res, 'Delete failed');
  return res.json();
}

export async function uploadDocument(file: File, collection: string, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collection', collection);

  const res = await authFetch(API_ROUTES.ADMIN.UPLOAD, token, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) await handleError(res, 'Upload failed');
  return res.json();
}
