// Shared API types mirroring the FastAPI backend.

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role?: string;
}

export interface RegisterInput {
  name: string;
  username: string;
  password: string;
  email: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface Document {
  id: number;
  filename: string;
  user_id: number | null;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  created_at: string;
}

export interface QueryRequest {
  // Optional: when omitted, the assistant answers in concierge mode
  // (about the product) rather than retrieving from a document.
  document_id?: number;
  question: string;
}

export interface QueryResponse {
  document_id: number;
  question: string;
  answer: string;
  sources?: SourceRef[];
}

// A single page the retriever used to answer — shown as a citation chip.
export interface SourceRef {
  page?: number;
  filename?: string;
}

// Payload carried by each Server-Sent Events frame from /chat/query.
// The backend emits `sources`, then many `token`, then a `done` event.
export interface SSEEventData {
  document_id?: number;
  sources?: SourceRef[];
  delta?: string;
  message?: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  documentId?: number;
  streaming?: boolean;
  error?: boolean;
  sources?: SourceRef[];
}
