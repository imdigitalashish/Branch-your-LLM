import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { GraphView } from './components/GraphView';
import { SplitView } from './components/SplitView';
import { useChat } from './hooks/useChat';
import * as api from './api';
import type { OllamaModel } from './types';
import './App.css';

function App() {
  const {
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
  } = useChat();

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'ok' | 'unavailable' | 'checking'>('checking');

  useEffect(() => {
    // Initial load
    loadSessions();
    api.getModels().then(setModels);
    api.checkHealth().then((status) => {
      setOllamaStatus(status.ollama === 'ok' ? 'ok' : 'unavailable');
    });
  }, [loadSessions]);

  const handleGraphNodeClick = async (nodeId: string) => {
    await navigateToNode(nodeId);
    setShowGraph(false);
  };

  const handleNewSession = async () => {
    await createNewSession();
  };

  // Get the parent node for split view (last user message or last message)
  const getParentForSplit = () => {
    if (currentPath.length === 0) return null;
    // Find the last node to branch from
    return currentPath[currentPath.length - 1];
  };

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        currentSession={currentSession}
        onSelectSession={selectSession}
        onNewSession={handleNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
      />

      <main className="main-content">
        {ollamaStatus === 'unavailable' && (
          <div className="ollama-warning">
            <span>⚠️</span>
            Ollama is not running. Start it with <code>ollama serve</code>
          </div>
        )}

        {currentSession ? (
          <>
            {showGraph ? (
              <GraphView
                nodes={nodes}
                activeNodeId={activeNodeId}
                onNodeClick={handleGraphNodeClick}
                onClose={() => setShowGraph(false)}
              />
            ) : showSplit ? (
              <SplitView
                sessionId={currentSession.id}
                parentNode={getParentForSplit()}
                currentPath={currentPath}
                selectedModel={selectedModel}
                models={models}
                onClose={() => setShowSplit(false)}
                onRefresh={refreshTree}
              />
            ) : (
              <ChatInterface
                currentPath={currentPath}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                pendingUserMessage={pendingUserMessage}
                selectedModel={selectedModel}
                models={models}
                onSendMessage={sendMessage}
                onRegenerate={regenerate}
                onNavigate={navigateToNode}
                onSetModel={setSelectedModel}
                onOpenGraph={() => setShowGraph(true)}
                onSplitThread={() => setShowSplit(true)}
              />
            )}
          </>
        ) : (
          <div className="no-session">
            <div className="no-session-content">
              <div className="hero-icon">⎇</div>
              <h1>Multiverse Chat</h1>
              <p>Every conversation is a tree of possibilities</p>
              <button className="btn-start" onClick={handleNewSession}>
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
