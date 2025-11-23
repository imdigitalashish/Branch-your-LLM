import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, GitBranch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Node, SiblingsResponse } from '../types';
import * as api from '../api';

interface MessageBubbleProps {
  node: Node;
  isStreaming?: boolean;
  streamingContent?: string;
  onRegenerate: (nodeId: string) => void;
  onNavigate: (nodeId: string) => void;
}

export function MessageBubble({
  node,
  isStreaming,
  streamingContent,
  onRegenerate,
  onNavigate,
}: MessageBubbleProps) {
  const [siblings, setSiblings] = useState<SiblingsResponse | null>(null);
  const isUser = node.role === 'user';
  const content = isStreaming ? streamingContent : node.content;

  useEffect(() => {
    // Load siblings info
    api.getNodeSiblings(node.id).then(setSiblings);
  }, [node.id]);

  const handlePrevSibling = () => {
    if (siblings && siblings.current_index > 0) {
      const prevSibling = siblings.siblings[siblings.current_index - 1];
      onNavigate(prevSibling.id);
    }
  };

  const handleNextSibling = () => {
    if (siblings && siblings.current_index < siblings.total - 1) {
      const nextSibling = siblings.siblings[siblings.current_index + 1];
      onNavigate(nextSibling.id);
    }
  };

  const hasSiblings = siblings && siblings.total > 1;

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-header">
        <span className="message-role">
          {isUser ? 'You' : node.model || 'Assistant'}
        </span>
        {!isUser && hasSiblings && (
          <div className="sibling-nav">
            <button
              className="btn-sibling"
              onClick={handlePrevSibling}
              disabled={siblings.current_index === 0}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="sibling-count">
              {siblings.current_index + 1} / {siblings.total}
            </span>
            <button
              className="btn-sibling"
              onClick={handleNextSibling}
              disabled={siblings.current_index === siblings.total - 1}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="message-content">
        {content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <span className="text-muted">No content</span>
        )}
        {isStreaming && <span className="cursor-blink">▊</span>}
      </div>

      {!isUser && !isStreaming && (
        <div className="message-actions">
          <button
            className="btn-action"
            onClick={() => onRegenerate(node.id)}
            title="Regenerate (creates a new branch)"
          >
            <RefreshCw size={14} />
            <span>Regenerate</span>
          </button>
          {hasSiblings && (
            <span className="branch-indicator">
              <GitBranch size={12} />
              {siblings.total} branches
            </span>
          )}
        </div>
      )}
    </div>
  );
}
