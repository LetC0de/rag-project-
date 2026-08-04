// Shared API types mirroring the FastAPI backend.

export interface Document {
  id: number;
  filename: string;
  user_id: number | null;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  created_at: string;
}

export interface QueryRequest {
  document_id: number;
  question: string;
}

export interface QueryResponse {
  document_id: number;
  question: string;
  answer: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  documentId?: number;
  streaming?: boolean;
  error?: boolean;
}
