import { useEffect, useRef, useState } from 'react';
import type { Document } from '../lib/types';
import { docColor, formatDate, initialsFromFilename, STATUS_LABEL } from '../lib/palette';
import { LogoMark, NewChatIcon, TrashIcon, UploadIcon, ChevronIcon } from './Icons';

interface SidebarProps {
  documents: Document[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onUpload: () => void;
  onDelete: (id: number) => Promise<void>;
}

export function Sidebar({ documents, selectedId, onSelect, onNewChat, onUpload, onDelete }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
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

  const readyCount = documents.filter((d) => d.status === 'processed').length;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <button className="brand" onClick={onNewChat} aria-label="Knowledge home">
          <span className="brand__mark"><LogoMark size={30} /></span>
          <span className="brand__text">
            <span className="brand__name">Knowledge</span>
            <span className="brand__tag">chat with your docs</span>
          </span>
        </button>
        <button
          className="sidebar__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon />
        </button>
      </div>

      <div className="sidebar__body">
        <button className="new-chat" onClick={onNewChat}>
          <NewChatIcon size={17} />
          <span>New chat</span>
        </button>

        <div className="sidebar__section">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">Documents</span>
            <span className="sidebar__count">{readyCount} ready</span>
          </div>

          <div className="doc-list">
            {documents.length === 0 && (
              <div className="doc-list__empty">
                <p>No documents yet.</p>
                <p>Upload a PDF to start asking questions.</p>
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
      </div>

      <div className="sidebar__foot">
        <button className="upload-btn" onClick={onUpload}>
          <span className="upload-btn__icon"><UploadIcon size={17} /></span>
          <span className="upload-btn__text">
            <span className="upload-btn__title">Upload PDF</span>
            <span className="upload-btn__sub">Add a document to chat</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
