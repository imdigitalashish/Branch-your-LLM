import { useState } from 'react';
import { Plus, Trash2, MessageSquare, Pencil, Check, X } from 'lucide-react';
import type { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, name: string) => void;
}

export function Sidebar({
  sessions,
  currentSession,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditName(session.name);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName('');
  };

  const saveEditing = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim()) {
      onRenameSession(sessionId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (sessionId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editName.trim()) {
        onRenameSession(sessionId, editName.trim());
      }
      setEditingId(null);
      setEditName('');
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this chat? This cannot be undone.')) {
      onDeleteSession(sessionId);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">
          <span className="logo-icon">⎇</span>
          <span>Multiverse</span>
        </h1>
        <button className="btn-new" onClick={onNewSession}>
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="sessions-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
            onClick={() => !editingId && onSelectSession(session)}
          >
            <MessageSquare size={16} />

            {editingId === session.id ? (
              <input
                type="text"
                className="session-edit-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(session.id, e)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="session-name">{session.name}</span>
            )}

            <div className="session-actions">
              {editingId === session.id ? (
                <>
                  <button
                    className="btn-session-action btn-save"
                    onClick={(e) => saveEditing(session.id, e)}
                    title="Save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="btn-session-action btn-cancel"
                    onClick={cancelEditing}
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-session-action btn-edit"
                    onClick={(e) => startEditing(session, e)}
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-session-action btn-delete"
                    onClick={(e) => handleDelete(session.id, e)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="brand-tag">Chat is a Tree, not a Line</div>
      </div>
    </aside>
  );
}
