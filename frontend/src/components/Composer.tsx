import { useEffect, useRef, useState } from 'react';
import type { Document } from '../lib/types';
import { SendIcon, StopIcon, XIcon, PlusIcon } from './Icons';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  activeDocument?: Document;
  onClearDocument: () => void;
  onPickDocument: (e?: React.MouseEvent) => void;
  disabled?: boolean;
}

// Rotating placeholder phrases shown one at a time inside the text box.
// When a document is selected these steer follow-up prompts; otherwise they
// invite a concierge / product question, since chatting no longer requires a doc.
const PLACEHOLDER_PHRASES = [
  'Ask anything — or pick a document to chat with its content.',
  'What is Quill and what does it do?',
  'How do I upload and ask about a PDF?',
  'Summarize this document in a few bullet points.',
  'Extract the key numbers, dates, and data points.',
];

const ROTATE_MS = 3200;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  activeDocument,
  onClearDocument,
  onPickDocument,
  disabled,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const canSend = value.trim().length > 0 && !isBusy && !disabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }, [value]);

  // Rotate the placeholder phrases every ROTATE_MS, with a small fade in/out.
  useEffect(() => {
    if (isBusy || value.trim().length > 0) return;
    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PLACEHOLDER_PHRASES.length);
        setFading(false);
      }, 240);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isBusy, value]);

  const placeholder = activeDocument
    ? 'Ask anything about this document…'
    : PLACEHOLDER_PHRASES[phraseIndex];

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return (
    <div className={`composer ${focused ? 'composer--focused' : ''} ${disabled ? 'composer--disabled' : ''}`}>
      {activeDocument && (
        <div className="composer__doc">
          <span className="composer__doc-label">Chatting with</span>
          <span className="doc-chip">
            <span className="doc-chip__badge">PDF</span>
            <span className="doc-chip__name">{activeDocument.filename}</span>
            <button className="doc-chip__x" onClick={onClearDocument} aria-label="Deselect document">
              <XIcon size={13} />
            </button>
          </span>
        </div>
      )}

      <div className="composer__input-wrap">
        <textarea
          ref={ref}
          className="composer__input"
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
        {!activeDocument && !isBusy && value.trim().length === 0 && (
          <span className={`composer__phrases ${fading ? 'composer__phrases--fade' : ''}`} aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>

      <div className="composer__bar">
        <button
          className="composer__attach"
          onClick={(e) => onPickDocument(e)}
          disabled={disabled}
          aria-label="Attach a document"
          title={activeDocument ? 'Change document' : 'Add a document'}
        >
          <PlusIcon size={20} />
        </button>

        {isBusy ? (
          <button className="composer__send composer__send--stop" onClick={onStop} aria-label="Stop generating">
            <StopIcon size={15} />
          </button>
        ) : (
          <button
            className="composer__send"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendIcon size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
