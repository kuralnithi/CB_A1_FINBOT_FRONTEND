/**
 * Chat API functions.
 */
import { API_BASE } from './client';
import { API_ROUTES } from '@/lib/routes';
import { authFetch, handleError } from './client';
import type { ChatResponse, StreamChunk } from '@/lib/types';

export async function sendMessage(
  query: string,
  sessionId: string,
  token: string
): Promise<ChatResponse> {
  const res = await authFetch(API_ROUTES.CHAT.SEND, token, {
    method: 'POST',
    body: JSON.stringify({ query, session_id: sessionId }),
  });
  if (!res.ok) await handleError(res, 'Chat request failed');
  return res.json();
}

/**
 * Streaming chat client — consumes SSE and yields token/status chunks.
 */
export async function* streamChat(
  query: string,
  sessionId: string,
  token: string
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}${API_ROUTES.CHAT.STREAM}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, session_id: sessionId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Streaming failed' }));
    throw new Error(err.detail || 'Streaming connection failed');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('Failed to open stream reader');

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6));
        } catch (e) {
          console.error('Failed to parse stream chunk:', e);
        }
      }
    }
  }
}
