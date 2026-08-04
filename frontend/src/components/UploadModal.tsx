import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadDocument } from '../lib/api';
import { UploadIcon, XIcon, FileIcon, CheckIcon } from './Icons';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

type Phase = 'idle' | 'uploading' | 'done' | 'error';

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase('idle');
      setProgress(0);
      setError('');
      setFileName('');
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'uploading') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const handleFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setPhase('error');
      setError('Please choose a PDF file.');
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setPhase('error');
      setError('PDF is larger than 40 MB.');
      return;
    }

    setFileName(file.name);
    setPhase('uploading');
    setProgress(0);
    try {
      await uploadDocument(file, (pct) => setProgress(pct));
      setProgress(100);
      setPhase('done');
      window.setTimeout(() => {
        onUploaded();
      }, 800);
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  }, [onUploaded]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={phase !== 'uploading' ? onClose : undefined}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Upload a PDF" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">Add a document</h2>
          {phase !== 'uploading' && (
            <button className="modal__close" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <div
            className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="dropzone__icon"><UploadIcon size={26} /></div>
            <p className="dropzone__title">Drag &amp; drop your PDF here</p>
            <p className="dropzone__sub">or <span className="dropzone__link">browse files</span> from your device</p>
            <span className="dropzone__hint">PDF · up to 40 MB</span>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {phase === 'uploading' && (
          <div className="upload-status">
            <div className="upload-status__file">
              <span className="upload-status__icon"><FileIcon size={20} /></span>
              <span className="upload-status__name">{fileName}</span>
            </div>
            <div className="upload-status__bar">
              <div className="upload-status__fill" style={{ width: `${Math.max(progress, 6)}%` }} />
            </div>
            <p className="upload-status__text">
              {progress < 100 ? `Indexing… ${progress}%` : 'Finishing up…'}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="upload-status">
            <div className="upload-status__done">
              <span className="upload-status__check"><CheckIcon size={22} /></span>
              <p className="upload-status__done-title">Document ready</p>
              <p className="upload-status__done-sub">“{fileName}” is indexed and ready to chat.</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="upload-status upload-status--error">
            <div className="upload-status__done">
              <span className="upload-status__check upload-status__check--error">
                <XIcon size={20} />
              </span>
              <p className="upload-status__done-title">Couldn’t upload</p>
              <p className="upload-status__done-sub">{error}</p>
            </div>
            <button className="modal__primary" onClick={() => { setPhase('idle'); setError(''); }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
