import type {
  Document,
  LoginInput,
  QueryRequest,
  QueryResponse,
  RegisterInput,
  SourceRef,
  SSEEventData,
  User,
} from './types';

// FastAPI backend URL.
//  - Production: set VITE_API_BASE_URL to the Render URL (e.g.
//    https://backend url.com). FastAPI routes are mounted
//    WITHOUT an /api prefix, so the base is used as-is.
//  - Local dev: leave unset and the Vite dev proxy forwards /api -> :8000
//    (see vite.config.ts), stripping the /api prefix — so '/api' stays the default.
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';
const BASE = API_BASE || '/api';

/** Auth handler installed once by the AuthProvider; called when an API returns 401. */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

let token: string | null = null;
export function setAuthToken(t: string | null) {
  token = t;
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    onUnauthorized?.();
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* keep statusText */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents/`, { headers: authHeaders() });
  return handle<Document[]>(res);
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${BASE}/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<unknown>(res);
}

export async function uploadDocument(file: File, onProgress?: (pct: number) => void): Promise<{ document_id: number; status: string }> {
  const form = new FormData();
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/upload/upload`);

    // Attach auth token after open, before send.
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Unexpected server response'));
        }
      } else {
        let detail = xhr.statusText;
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body?.detail ?? detail;
        } catch {
          /* ignore */
        }
        reject(new Error(detail || `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

export async function askQuestion(payload: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/chat/query`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handle<QueryResponse>(res);
}

/**
 * Stream a chat answer over Server-Sent Events.
 *
 * POSTs to the same /chat/query endpoint, but reads the response body as a
 * text/event-stream instead of a single JSON blob. Events arrive as:
 *   sources -> many token -> done   (or error instead of done on failure)
 *
 * `fetch` + a ReadableStream reader is required here because the browser's
 * EventSource API only supports GET and cannot send the Authorization header.
 */
export function askQuestionStream(
  payload: QueryRequest,
  callbacks: {
    onSources: (sources: SourceRef[]) => void;
    onDelta: (delta: string) => void;
    onDone: (documentId?: number) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const { onSources, onDelta, onDone, onError } = callbacks;

  return fetch(`${BASE}/chat/query`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  }).then(async (res) => {
    if (!res.ok) {
      // Auth (401) or pre-stream errors (404/409) come back as JSON, not SSE.
      if (res.status === 401) onUnauthorized?.();
      let detail = res.statusText;
      try {
        const body = await res.json();
        if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      } catch {
        /* keep statusText */
      }
      onError(detail || `Request failed (${res.status})`);
      return;
    }
    await readSSEStream(res, onSources, onDelta, onDone, onError, signal);
  });
}

/** Read a text/event-stream response, dispatching events as they arrive. */
async function readSSEStream(
  res: Response,
  onSources: (sources: SourceRef[]) => void,
  onDelta: (delta: string) => void,
  onDone: (documentId?: number) => void,
  onError: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = res.body!.getReader();
  // A single streaming decoder guarantees multi-byte UTF-8 characters split
  // across chunk boundaries are recombined correctly.
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (dataLines.length === 0) return; // heartbeat / blank frame
    try {
      const data = JSON.parse(dataLines.join('\n')) as SSEEventData;
      if (eventName === 'sources') onSources(data.sources ?? []);
      else if (eventName === 'token') onDelta(data.delta ?? '');
      else if (eventName === 'done') onDone(data.document_id);
      else if (eventName === 'error') onError(data.message ?? 'Stream error');
    } catch {
      onError('Malformed stream response');
    }
    eventName = '';
    dataLines = [];
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Accept both \n\n and \r\n\r\n.
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);

        if (line === '') {
          flushEvent();
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
        // ignore id:/retry:/comment lines
      }
    }
    // Final flush for any event that reached EOF without a trailing blank line.
    buffer += decoder.decode();
    while (buffer.length > 0) {
      const nl = buffer.indexOf('\n');
      const line = (nl === -1 ? buffer : buffer.slice(0, nl)).replace(/\r$/, '');
      buffer = nl === -1 ? '' : buffer.slice(nl + 1);
      if (line === '') flushEvent();
      else if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    flushEvent();
  } catch (e) {
    // Only surface real failures. A user-initiated Stop aborts the reader —
    // that's an intentional cancel, not an error.
    if (!signal?.aborted) {
      onError(e instanceof Error ? e.message : 'Stream interrupted');
    }
  }
}

// ---------- Auth ----------

export async function login(input: LoginInput): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<{ token: string }>(res);
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const res = await fetch(`${BASE}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<User>(res);
}

export async function me(): Promise<User> {
  const res = await fetch(`${BASE}/user/is_auth`, { headers: authHeaders() });
  return handle<User>(res);
}
