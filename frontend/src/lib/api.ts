import type {
  Document,
  LoginInput,
  QueryRequest,
  QueryResponse,
  RegisterInput,
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
