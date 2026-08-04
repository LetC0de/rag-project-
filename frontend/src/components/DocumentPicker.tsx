import { useEffect, useRef, useState } from 'react';
import type { Document } from '../lib/types';
import { docColor, initialsFromFilename, STATUS_LABEL } from '../lib/palette';
import { UploadIcon } from './Icons';

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

  return (
    <div className="picker" ref={ref} style={style} role="listbox" aria-label="Choose a document">
      <div className="picker__head">
        <span className="picker__title">Chat with a document</span>
      </div>
      <div className="picker__list">
        {ready.length === 0 && (
          <div className="picker__empty">
            <p>No ready documents.</p>
            <button className="picker__upload" onClick={() => { onUpload(); onClose(); }}>
              <UploadIcon size={14} /> Upload a PDF
            </button>
          </div>
        )}
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
    </div>
  );
}
