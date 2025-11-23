import { useState, useCallback } from 'react';
import type { Node, Session } from '../types';
import * as api from '../api';

interface UseChatReturn {
  sessions: Session[];
  currentSession: Session | null;
  nodes: Node[];
  activeNodeId: string | null;
  currentPath: Node[];
  isStreaming: boolean;
  streamingContent: string;
  pendingUserMessage: string | null;
  selectedModel: string;
  loadSessions: () => Promise<void>;
  createNewSession: (name?: string) => Promise<Session>;
  selectSession: (session: Session) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  regenerate: (nodeId: string) => Promise<void>;
  navigateToNode: (nodeId: string) => Promise<void>;
  setSelectedModel: (model: string) => void;
  refreshTree: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<Node[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemma3:4b');

  const loadSessions = useCallback(async () => {
    const data = await api.getSessions();
    setSessions(data);
  }, []);

  const refreshTree = useCallback(async () => {
    if (!currentSession) return;
    const tree = await api.getSessionTree(currentSession.id);
    setNodes(tree.nodes);
  }, [currentSession]);

  const updatePath = useCallback(async (nodeId: string) => {
    const { path } = await api.getNodePath(nodeId);
    setCurrentPath(path);
    setActiveNodeId(nodeId);
  }, []);

  const selectSession = useCallback(async (session: Session) => {
    setCurrentSession(session);
    const tree = await api.getSessionTree(session.id);
    setNodes(tree.nodes);

    // Find the latest leaf node (most recent message with no children)
    if (tree.nodes.length > 0) {
      const parentIds = new Set(tree.nodes.map(n => n.parent_id).filter(Boolean));
      const leafNodes = tree.nodes.filter(n => !parentIds.has(n.id));

      if (leafNodes.length > 0) {
        // Get the most recent leaf
        const latestLeaf = leafNodes.reduce((a, b) =>
          new Date(a.created_at) > new Date(b.created_at) ? a : b
        );
        await updatePath(latestLeaf.id);
      }
    } else {
      setCurrentPath([]);
      setActiveNodeId(null);
    }
  }, [updatePath]);

  const createNewSession = useCallback(async (name?: string) => {
    const session = await api.createSession(name);
    await loadSessions();
    await selectSession(session);
    return session;
  }, [loadSessions, selectSession]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await api.deleteSession(sessionId);
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setNodes([]);
      setCurrentPath([]);
      setActiveNodeId(null);
    }
    await loadSessions();
  }, [currentSession, loadSessions]);

  const renameSession = useCallback(async (sessionId: string, name: string) => {
    await api.renameSession(sessionId, name);
    await loadSessions();
    // Update current session if it's the one being renamed
    if (currentSession?.id === sessionId) {
      setCurrentSession(prev => prev ? { ...prev, name } : null);
    }
  }, [currentSession, loadSessions]);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession || isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');
    setPendingUserMessage(content); // Show user message immediately

    try {
      // Find the current leaf node to use as parent
      const parentId = activeNodeId;

      let newAssistantNodeId: string | null = null;
      let fullContent = '';

      for await (const chunk of api.streamChat(
        currentSession.id,
        content,
        parentId,
        selectedModel
      )) {
        if (chunk.node_id) {
          newAssistantNodeId = chunk.node_id;
        }
        if (!chunk.done) {
          fullContent += chunk.token;
          setStreamingContent(fullContent);
        }
      }

      // Refresh and navigate to new node
      await refreshTree();
      if (newAssistantNodeId) {
        await updatePath(newAssistantNodeId);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setPendingUserMessage(null);
    }
  }, [currentSession, activeNodeId, selectedModel, isStreaming, refreshTree, updatePath]);

  const regenerate = useCallback(async (nodeId: string) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');

    try {
      let newNodeId: string | null = null;
      let fullContent = '';

      for await (const chunk of api.streamBranch(nodeId, selectedModel)) {
        if (chunk.node_id) {
          newNodeId = chunk.node_id;
        }
        if (!chunk.done) {
          fullContent += chunk.token;
          setStreamingContent(fullContent);
        }
      }

      await refreshTree();
      if (newNodeId) {
        await updatePath(newNodeId);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [selectedModel, isStreaming, refreshTree, updatePath]);

  const navigateToNode = useCallback(async (nodeId: string) => {
    await updatePath(nodeId);
  }, [updatePath]);

  return {
    sessions,
    currentSession,
    nodes,
    activeNodeId,
    currentPath,
    isStreaming,
    streamingContent,
    pendingUserMessage,
    selectedModel,
    loadSessions,
    createNewSession,
    selectSession,
    deleteSession,
    renameSession,
    sendMessage,
    regenerate,
    navigateToNode,
    setSelectedModel,
    refreshTree,
  };
}
