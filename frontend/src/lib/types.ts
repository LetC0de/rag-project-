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

// Conversation = one chat session owned by a user. Messages are checkpointed
// server-side under this id (via LangGraph + PostgresSaver); the client only
// needs the id to identify which thread to send to.
export interface Conversation {
  conversation_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

// One turn loaded from GET /conversations/{id}/messages. The backend reads the
// LangGraph checkpoint and flattens it to this shape, so the client never
// depends on LangGraph's internal message format.
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryRequest {
  // Required: identifies which chat session memory belongs to.
  conversation_id: number;
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