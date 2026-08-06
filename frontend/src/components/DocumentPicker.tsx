import { useEffect, useRef, useState } from 'react';
import type { Document } from '../lib/types';
import { docColor, initialsFromFilename, STATUS_LABEL } from '../lib/palette';
import { UploadIcon, PlusIcon, XIcon } from './Icons';

interface DocumentPickerProps {
  open: boolean;
  anchor?: HTMLElement | null;
  documents: Document[];
  onSelect: (id: number) => void;
  onUpload: () => void;
  onClose: () => void;
  isMobile: boolean;
}

export function DocumentPicker({ open, anchor, documents, onSelect, onUpload, onClose, isMobile }: DocumentPickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || isMobile || !anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 300) });
  }, [open, anchor, isMobile]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ready = documents.filter((d) => d.status === 'processed');
  const style = isMobile ? {} : { top: pos.top, left: pos.left };

  const handleUpload = () => {
    onUpload();
    onClose();
  };

  return (
    <>
      {/* Mobile tap-outside backdrop (sits behind the sheet, above the app) */}
      {isMobile && (
        <button className="picker__backdrop" onClick={onClose} aria-label="Close menu" />
      )}

      <div className="picker" ref={ref} style={style} role="menu" aria-label="Add a document">
        <div className="picker__head">
          <span className="picker__title">Add a document</span>
          <button className="picker__close" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>

      {/* Option 1 — upload a new PDF */}
      <div className="picker__section">
        <button className="picker__upload-row" onClick={handleUpload}>
          <span className="picker__upload-ico"><PlusIcon size={17} /></span>
          <span className="picker__upload-meta">
            <span className="picker__upload-name">Upload new</span>
            <span className="picker__upload-sub">Add a PDF to chat</span>
          </span>
        </button>
      </div>

      {/* Option 2 — already uploaded documents */}
      <div className="picker__section">
        <div className="picker__subhead">
          <span className="picker__subhead-label">Uploaded</span>
          {ready.length > 0 && <span className="picker__count">{ready.length}</span>}
        </div>

        {ready.length === 0 ? (
          <div className="picker__empty">
            <p>No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="picker__list">
            {ready.map((doc) => {
              const color = docColor(doc.id);
              return (
                <button
                  key={doc.id}
                  className="picker__item"
                  onClick={() => { onSelect(doc.id); onClose(); }}
                >
                  <span className="picker__avatar" style={{ background: color.soft, color: color.ink }}>
                    {initialsFromFilename(doc.filename)}
                  </span>
                  <span className="picker__meta">
                    <span className="picker__name">{doc.filename}</span>
                    <span className="picker__sub"><span className="status-dot status-dot--processed" /> {STATUS_LABEL.processed}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </>
  );
}