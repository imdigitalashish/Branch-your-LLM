import type { Session, Node, ChatStreamChunk, SiblingsResponse, TreeResponse, OllamaModel } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8923';

// ============ Health & Models ============

export async function checkHealth(): Promise<{ api: string; ollama: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function getModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${API_BASE}/models`);
  const data = await res.json();
  return data.models;
}

// ============ Sessions ============

export async function getSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  const data = await res.json();
  return data.sessions;
}

export async function createSession(name: string = 'New Chat'): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function renameSession(sessionId: string, name: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

// ============ Chat ============

export async function* streamChat(
  sessionId: string,
  content: string,
  parentId: string | null,
  model: string
): AsyncGenerator<ChatStreamChunk> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      parent_id: parentId,
      content,
      model,
    }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

export async function* streamBranch(
  nodeId: string,
  model: string
): AsyncGenerator<ChatStreamChunk> {
  const res = await fetch(`${API_BASE}/node/${nodeId}/branch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId, model }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

export async function* streamContinue(
  parentId: string,
  content: string,
  sessionId: string,
  model: string
): AsyncGenerator<ChatStreamChunk> {
  const res = await fetch(`${API_BASE}/node/${parentId}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      content,
      model,
    }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

// ============ Tree & Nodes ============

export async function getSessionTree(sessionId: string): Promise<TreeResponse> {
  const res = await fetch(`${API_BASE}/session/${sessionId}/tree`);
  return res.json();
}

export async function getNodePath(nodeId: string): Promise<{ path: Node[] }> {
  const res = await fetch(`${API_BASE}/node/${nodeId}/path`);
  return res.json();
}

export async function getNodeSiblings(nodeId: string): Promise<SiblingsResponse> {
  const res = await fetch(`${API_BASE}/node/${nodeId}/siblings`);
  return res.json();
}

export async function getNodeChildren(nodeId: string): Promise<{ children: Node[] }> {
  const res = await fetch(`${API_BASE}/node/${nodeId}/children`);
  return res.json();
}
