import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Measure the real picker size and place it relative to the anchor.
  // Runs after paint so the dimensions are accurate (no guessing).
  useLayoutEffect(() => {
    if (!open || isMobile || !ref.current) return;

    const el = ref.current;
    const PICKER_W = el.offsetWidth || 280;
    const PICKER_H = el.offsetHeight;
    const MARGIN = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // No anchor (e.g. opened from a suggestion): center the picker.
    if (!anchor) {
      setPos({
        left: Math.max(MARGIN, (vw - PICKER_W) / 2),
        top: Math.max(MARGIN, (vh - PICKER_H) / 2),
      });
      return;
    }

    const r = anchor.getBoundingClientRect();

    // Horizontal: align to the anchor, clamped to the viewport.
    let left = r.left;
    if (left + PICKER_W > vw - MARGIN) left = vw - PICKER_W - MARGIN;
    if (left < MARGIN) left = MARGIN;

    // Vertical: prefer opening below the anchor; flip above when the
    // picker wouldn't fit below (the + button is near the bottom edge).
    let top = r.bottom + 8;
    if (top + PICKER_H > vh - MARGIN) {
      const above = r.top - PICKER_H - 8;
      if (above >= MARGIN) {
        top = above;
      } else {
        // Not enough room above either: clamp within the viewport.
        top = Math.max(MARGIN, Math.min(vh - PICKER_H - MARGIN, r.bottom + 8));
      }
    }

    setPos({ top, left });
  }, [open, anchor, isMobile, documents]);

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
  // Desktop only: apply measured position once known. Mobile uses CSS sheet.
  const style = isMobile ? {} : pos ? { top: pos.top, left: pos.left } : { opacity: 0 };

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