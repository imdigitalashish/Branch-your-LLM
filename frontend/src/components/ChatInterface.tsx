import { useState, useRef, useEffect } from 'react';
import { Send, Network, Split } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Node, OllamaModel } from '../types';

interface ChatInterfaceProps {
  currentPath: Node[];
  isStreaming: boolean;
  streamingContent: string;
  pendingUserMessage: string | null;
  selectedModel: string;
  models: OllamaModel[];
  onSendMessage: (content: string) => void;
  onRegenerate: (nodeId: string) => void;
  onNavigate: (nodeId: string) => void;
  onSetModel: (model: string) => void;
  onOpenGraph: () => void;
  onSplitThread: () => void;
}

export function ChatInterface({
  currentPath,
  isStreaming,
  streamingContent,
  pendingUserMessage,
  selectedModel,
  models,
  onSendMessage,
  onRegenerate,
  onNavigate,
  onSetModel,
  onOpenGraph,
  onSplitThread,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentPath, streamingContent, pendingUserMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-controls">
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onSetModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
            {models.length === 0 && (
              <option value={selectedModel}>{selectedModel}</option>
            )}
          </select>

          <button className="btn-view" onClick={onOpenGraph} title="Graph View">
            <Network size={18} />
            <span>God Mode</span>
          </button>
        </div>
      </div>

      <div className="messages-container">
        {currentPath.length === 0 && !pendingUserMessage ? (
          <div className="empty-state">
            <div className="empty-icon">⎇</div>
            <h2>Welcome to Multiverse</h2>
            <p>Every message can branch into infinite possibilities.</p>
            <p className="hint">Start chatting to explore the tree of thoughts.</p>
          </div>
        ) : (
          <>
            {/* Render existing messages in the path */}
            {currentPath.map((node) => (
              <MessageBubble
                key={node.id}
                node={node}
                isStreaming={false}
                onRegenerate={onRegenerate}
                onNavigate={onNavigate}
              />
            ))}

            {/* Pending user message (shown during streaming) */}
            {pendingUserMessage && (
              <div className="message message-user">
                <div className="message-header">
                  <span className="message-role">You</span>
                </div>
                <div className="message-content">
                  {pendingUserMessage}
                </div>
              </div>
            )}

            {/* Streaming assistant response */}
            {isStreaming && (
              <div className="message message-assistant">
                <div className="message-header">
                  <span className="message-role">{selectedModel}</span>
                </div>
                <div className="message-content">
                  {streamingContent || <span className="text-muted">Thinking...</span>}
                  <span className="cursor-blink">▊</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-container" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isStreaming}
            rows={1}
          />
          <div className="input-actions">
            <button
              type="button"
              className="btn-split"
              onClick={onSplitThread}
              title="Split Thread - Compare two prompts"
              disabled={isStreaming || currentPath.length === 0}
            >
              <Split size={18} />
            </button>
            <button
              type="submit"
              className="btn-send"
              disabled={!input.trim() || isStreaming}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
