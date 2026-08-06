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
  onPickDocument: () => void;
  disabled?: boolean;
}

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

  const canSend = value.trim().length > 0 && !isBusy && !disabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }, [value]);

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

      <textarea
        ref={ref}
        className="composer__input"
        rows={1}
        value={value}
        placeholder={activeDocument ? 'Ask anything about this document…' : 'Pick a document, then ask anything…'}
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

      <div className="composer__bar">
        <button
          className="composer__attach"
          onClick={onPickDocument}
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
