import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Node, OllamaModel } from '../types';
import * as api from '../api';

interface SplitViewProps {
  sessionId: string;
  parentNode: Node | null;
  currentPath: Node[];
  selectedModel: string;
  models: OllamaModel[];
  onClose: () => void;
  onRefresh: () => void;
}

interface ThreadState {
  input: string;
  messages: Node[];
  isStreaming: boolean;
  streamingContent: string;
}

export function SplitView({
  sessionId,
  parentNode,
  currentPath,
  selectedModel,
  models,
  onClose,
  onRefresh,
}: SplitViewProps) {
  const [leftThread, setLeftThread] = useState<ThreadState>({
    input: '',
    messages: [],
    isStreaming: false,
    streamingContent: '',
  });

  const [rightThread, setRightThread] = useState<ThreadState>({
    input: '',
    messages: [],
    isStreaming: false,
    streamingContent: '',
  });

  const [model, setModel] = useState(selectedModel);
  const leftEndRef = useRef<HTMLDivElement>(null);
  const rightEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    leftEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [leftThread.messages, leftThread.streamingContent]);

  useEffect(() => {
    rightEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rightThread.messages, rightThread.streamingContent]);

  const handleSendBoth = async () => {
    if (!leftThread.input.trim() || !rightThread.input.trim()) return;
    if (leftThread.isStreaming || rightThread.isStreaming) return;

    const parentId = parentNode?.id || null;

    // Start both streams simultaneously
    setLeftThread((t) => ({ ...t, isStreaming: true, streamingContent: '' }));
    setRightThread((t) => ({ ...t, isStreaming: true, streamingContent: '' }));

    // Stream left
    const streamLeft = async () => {
      let fullContent = '';
      try {
        for await (const chunk of api.streamChat(
          sessionId,
          leftThread.input,
          parentId,
          model
        )) {
          if (!chunk.done) {
            fullContent += chunk.token;
            setLeftThread((t) => ({ ...t, streamingContent: fullContent }));
          }
        }
        // Refresh to get the new nodes
        await onRefresh();
      } finally {
        setLeftThread((t) => ({
          ...t,
          isStreaming: false,
          streamingContent: '',
          input: '',
        }));
      }
    };

    // Stream right
    const streamRight = async () => {
      let fullContent = '';
      try {
        for await (const chunk of api.streamChat(
          sessionId,
          rightThread.input,
          parentId,
          model
        )) {
          if (!chunk.done) {
            fullContent += chunk.token;
            setRightThread((t) => ({ ...t, streamingContent: fullContent }));
          }
        }
        await onRefresh();
      } finally {
        setRightThread((t) => ({
          ...t,
          isStreaming: false,
          streamingContent: '',
          input: '',
        }));
      }
    };

    // Run both in parallel
    await Promise.all([streamLeft(), streamRight()]);
  };

  // Show context from current path
  const contextMessages = currentPath.slice(-4); // Show last 4 messages as context

  return (
    <div className="split-view">
      <div className="split-header">
        <h2>
          <span>⚡</span>
          Diverge Mode
        </h2>
        <p>
          Both prompts branch from:{' '}
          <strong>{parentNode?.content.slice(0, 50) || 'Start'}...</strong>
        </p>
        <div className="split-controls">
          <select
            className="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="split-context">
        <h3>Context</h3>
        <div className="context-messages">
          {contextMessages.map((msg) => (
            <div key={msg.id} className={`context-msg context-${msg.role}`}>
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>{' '}
              {msg.content.slice(0, 150)}
              {msg.content.length > 150 ? '...' : ''}
            </div>
          ))}
        </div>
      </div>

      <div className="split-columns">
        {/* Left Thread */}
        <div className="split-column">
          <div className="column-header">
            <span className="column-label">Thread A</span>
          </div>
          <div className="column-input">
            <textarea
              value={leftThread.input}
              onChange={(e) =>
                setLeftThread((t) => ({ ...t, input: e.target.value }))
              }
              placeholder="Your first prompt..."
              disabled={leftThread.isStreaming}
            />
          </div>
          <div className="column-response">
            {leftThread.streamingContent && (
              <div className="streaming-response">
                <ReactMarkdown>{leftThread.streamingContent}</ReactMarkdown>
                <span className="cursor-blink">▊</span>
              </div>
            )}
            <div ref={leftEndRef} />
          </div>
        </div>

        {/* Right Thread */}
        <div className="split-column">
          <div className="column-header">
            <span className="column-label">Thread B</span>
          </div>
          <div className="column-input">
            <textarea
              value={rightThread.input}
              onChange={(e) =>
                setRightThread((t) => ({ ...t, input: e.target.value }))
              }
              placeholder="Your second prompt..."
              disabled={rightThread.isStreaming}
            />
          </div>
          <div className="column-response">
            {rightThread.streamingContent && (
              <div className="streaming-response">
                <ReactMarkdown>{rightThread.streamingContent}</ReactMarkdown>
                <span className="cursor-blink">▊</span>
              </div>
            )}
            <div ref={rightEndRef} />
          </div>
        </div>
      </div>

      <div className="split-actions">
        <button
          className="btn-diverge"
          onClick={handleSendBoth}
          disabled={
            !leftThread.input.trim() ||
            !rightThread.input.trim() ||
            leftThread.isStreaming ||
            rightThread.isStreaming
          }
        >
          <Send size={18} />
          <span>Diverge</span>
        </button>
      </div>
    </div>
  );
}
