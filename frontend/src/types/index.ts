export interface Node {
  id: string;
  session_id: string;
  parent_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model: string | null;
  is_active: boolean;
}

export interface Session {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ChatStreamChunk {
  token: string;
  node_id: string;
  user_node_id?: string;
  done: boolean;
  full_content?: string;
  error?: boolean;
}

export interface SiblingsResponse {
  siblings: Node[];
  current_index: number;
  total: number;
}

export interface TreeResponse {
  session_id: string;
  nodes: Node[];
}

export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
}
