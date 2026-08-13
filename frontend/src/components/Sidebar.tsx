import { useEffect, useRef, useState } from 'react';
import type { Conversation, Document, User } from '../lib/types';
import { docColor, formatDate, formatTime, initialsFromFilename, STATUS_LABEL } from '../lib/palette';
import { LogoMark, NewChatIcon, TrashIcon, ChevronIcon, XIcon, LogoutIcon, UserIcon, FileIcon, HistoryIcon, ChatIcon, PencilIcon } from './Icons';

interface SidebarProps {
  documents: Document[];
  selectedId: number | null;
  conversations: Conversation[];
  activeConversationId: number | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  collapsed: boolean;
  onSelect: (id: number) => void;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onDelete: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  onRenameConversation: (id: number, title: string) => Promise<void>;
  onClose: () => void;
  onExpand: () => void;
  isMobile: boolean;
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({
  documents,
  selectedId,
  conversations,
  activeConversationId,
  loadingConversations,
  loadingMessages,
  collapsed,
  onSelect,
  onSelectConversation,
  onNewChat,
  onDelete,
  onDeleteConversation,
  onRenameConversation,
  onClose,
  onExpand,
  isMobile,
  user,
  onLogout,
}: SidebarProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  const handleDelete = async (doc: Document) => {
    if (confirmingId === doc.id) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirmingId(null);
      setDeletingId(doc.id);
      try {
        await onDelete(doc.id);
      } finally {
        setDeletingId(null);
      }
    } else {
      setConfirmingId(doc.id);
      confirmTimer.current = window.setTimeout(() => setConfirmingId(null), 3500);
    }
  };

  const [confirmConvoId, setConfirmConvoId] = useState<number | null>(null);
  const [deletingConvoId, setDeletingConvoId] = useState<number | null>(null);
  const convoTimer = useRef<number | null>(null);

  const handleDeleteConversation = async (convo: Conversation) => {
    if (confirmConvoId === convo.conversation_id) {
      if (convoTimer.current) window.clearTimeout(convoTimer.current);
      setConfirmConvoId(null);
      setDeletingConvoId(convo.conversation_id);
      try {
        await onDeleteConversation(convo.conversation_id);
      } finally {
        setDeletingConvoId(null);
      }
    } else {
      setConfirmConvoId(convo.conversation_id);
      convoTimer.current = window.setTimeout(() => setConfirmConvoId(null), 3500);
    }
  };

  // Inline rename: one conversation is in "editing" mode at a time. The title is
  // committed via PATCH /conversations/{id} on Enter / blur, and cancelled on Esc.
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const startRename = (convo: Conversation) => {
    setRenamingId(convo.conversation_id);
    setRenameValue(convo.title);
    setConfirmConvoId(null);
    // Focus + select after the input mounts.
    requestAnimationFrame(() => renameInputRef.current?.select());
  };

  const commitRename = async (id: number) => {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    const target = conversations.find((c) => c.conversation_id === id);
    setRenamingId(null);
    // Skip the round-trip if nothing actually changed.
    if (target && target.title === title) return;
    try {
      await onRenameConversation(id, title);
    } catch {
      /* keep the local title; the failure toast is surfaced by App */
    }
  };

  useEffect(() => () => {
    if (convoTimer.current) window.clearTimeout(convoTimer.current);
  }, []);

  const readyCount = documents.filter((d) => d.status === 'processed').length;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <button className="brand" onClick={onNewChat} aria-label="Quill home">
          <span className="brand__mark"><LogoMark size={30} /></span>
          <span className="brand__text">
            <span className="brand__name">Quill Assistant</span>
            <span className="brand__tag">chat with your docs</span>
          </span>
        </button>

        {/* Close button — cross icon, mobile + desktop */}
        {isMobile && (
          <button
            className="sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon size={20} />
          </button>
        )}

        {/* Collapse (close) toggle — cross icon, desktop when open */}
        {!isMobile && !collapsed && (
          <button
            className="sidebar__collapse"
            onClick={onClose}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <XIcon size={18} />
          </button>
        )}
      </div>

      {/* Collapsed icon rail — desktop only: colorful, informative shortcuts */}
      {!isMobile && collapsed && (
        <div className="sidebar__rail">
          <button className="sidebar__rail-btn sidebar__rail-btn--chat" onClick={onExpand} aria-label="New chat" title="New chat — open sidebar">
            <NewChatIcon size={18} />
          </button>
          <button className="sidebar__rail-btn sidebar__rail-btn--history" onClick={onExpand} aria-label="History" title="History — open sidebar">
            <HistoryIcon size={18} />
          </button>
          <button className="sidebar__rail-btn sidebar__rail-btn--docs" onClick={onExpand} aria-label="Documents" title="Documents — open sidebar">
            <FileIcon size={18} />
          </button>
          <div className="sidebar__rail-spacer" />
          {/* User above expand */}
          <button className="sidebar__rail-btn sidebar__rail-btn--user" onClick={onExpand} aria-label="Account" title="Account — open sidebar">
            <UserIcon size={18} />
          </button>
          {/* Expand pinned at the very bottom */}
          <button className="sidebar__rail-btn sidebar__rail-btn--expand" onClick={onExpand} aria-label="Expand sidebar" title="Expand sidebar">
            <ChevronIcon />
          </button>
        </div>
      )}

      <div className="sidebar__body">
        <button className="new-chat" onClick={onNewChat}>
          <NewChatIcon size={17} />
          <span>New chat</span>
        </button>

        <div className="sidebar__section sidebar__section--scroll">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">Documents</span>
            <span className="sidebar__count">{readyCount} ready</span>
          </div>

          <div className="doc-list">
            {documents.length === 0 && (
              <div className="doc-list__empty">
                <p>No documents yet.</p>
                <p>Upload a document to start asking questions.</p>
              </div>
            )}

            {documents.map((doc) => {
              const color = docColor(doc.id);
              const active = doc.id === selectedId;
              const isConfirming = confirmingId === doc.id;
              const isDeleting = deletingId === doc.id;
              const status = doc.status;

              return (
                <div
                  key={doc.id}
                  className={`doc-item ${active ? 'doc-item--active' : ''}`}
                >
                  <button
                    className="doc-item__main"
                    onClick={() => onSelect(doc.id)}
                    disabled={status !== 'processed'}
                  >
                    <span className="doc-item__avatar" style={{ background: color.soft, color: color.ink }}>
                      {initialsFromFilename(doc.filename)}
                    </span>
                    <span className="doc-item__meta">
                      <span className="doc-item__name">{doc.filename}</span>
                      <span className="doc-item__sub">
                        <span className={`status-dot status-dot--${status}`} />
                        {STATUS_LABEL[status] ?? status}
                        <span className="doc-item__sep">·</span>
                        {formatDate(doc.created_at)}
                      </span>
                    </span>
                  </button>

                  <button
                    className={`doc-item__del ${isConfirming ? 'doc-item__del--confirm' : ''} ${isDeleting ? 'doc-item__del--busy' : ''}`}
                    onClick={() => handleDelete(doc)}
                    disabled={isDeleting}
                    title={isConfirming ? 'Click again to confirm' : 'Delete document'}
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <TrashIcon size={14} />
                    {isConfirming && <span className="doc-item__confirm">Sure?</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidebar__section sidebar__section--scroll">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">Conversations</span>
            <span className="sidebar__count">{conversations.length}</span>
          </div>

          <div className="convo-list">
            {loadingConversations && (
              <div className="convo-list__loading">Loading conversations…</div>
            )}

            {!loadingConversations && conversations.length === 0 && (
              <div className="doc-list__empty">
                <p>No chats yet.</p>
                <p>Start a new chat to begin a conversation.</p>
              </div>
            )}

            {conversations.map((convo) => {
              const active = convo.conversation_id === activeConversationId;
              const isConfirming = confirmConvoId === convo.conversation_id;
              const isDeleting = deletingConvoId === convo.conversation_id;
              const isRenaming = renamingId === convo.conversation_id;
              return (
                <div
                  key={convo.conversation_id}
                  className={`convo-item ${active ? 'convo-item--active' : ''} ${isRenaming ? 'convo-item--renaming' : ''}`}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="convo-item__rename"
                      value={renameValue}
                      maxLength={200}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(convo.conversation_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(convo.conversation_id);
                        else if (e.key === 'Escape') setRenamingId(null);
                      }}
                      aria-label="Rename conversation"
                    />
                  ) : (
                    <button
                      className="convo-item__main"
                      onClick={() => onSelectConversation(convo.conversation_id)}
                      title={convo.title}
                    >
                      <span className="convo-item__icon">
                        <ChatIcon size={15} />
                      </span>
                      <span className="convo-item__meta">
                        <span className="convo-item__name">{convo.title}</span>
                        <span className="convo-item__sub">{formatTime(convo.updated_at)}</span>
                      </span>
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      className="convo-item__rename-btn"
                      onClick={() => startRename(convo)}
                      title="Rename conversation"
                      aria-label={`Rename ${convo.title}`}
                    >
                      <PencilIcon size={13} />
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      className={`convo-item__del ${isConfirming ? 'convo-item__del--confirm' : ''} ${isDeleting ? 'convo-item__del--busy' : ''}`}
                      onClick={() => handleDeleteConversation(convo)}
                      disabled={isDeleting}
                      title={isConfirming ? 'Click again to confirm' : 'Delete conversation'}
                      aria-label={`Delete ${convo.title}`}
                    >
                      <TrashIcon size={14} />
                      {isConfirming && <span className="doc-item__confirm">Sure?</span>}
                    </button>
                  )}
                  {active && loadingMessages && !isRenaming && (
                    <span className="convo-item__spinner" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sidebar__foot">
        {user && (
          <div className="sidebar__account">
            <button className="account-btn" aria-label="Account menu" title={user.username}>
              <span className="account-btn__avatar">
                {initialsFromFilename(user.name || user.username)}
              </span>
              <span className="account-btn__meta">
                <span className="account-btn__name">{user.name || user.username}</span>
                <span className="account-btn__sub">@{user.username}</span>
              </span>
              <span className="account-btn__role"><UserIcon size={14} /></span>
            </button>
            <button
              className="account-logout"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogoutIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
