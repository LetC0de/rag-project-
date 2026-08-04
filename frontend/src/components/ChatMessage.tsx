import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/types';
import { docColor, initialsFromFilename } from '../lib/palette';
import { Markdown } from '../lib/markdown';
import { CheckIcon, CopyIcon, RegenerateIcon, SparkIcon } from './Icons';

interface ChatMessageProps {
  message: ChatMessage;
  documentName?: string;
  isLast: boolean;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  onStreamingDone?: () => void;
}

export function ChatMessageView({ message, documentName, isLast, onCopy, onRegenerate, onStreamingDone }: ChatMessageProps) {
  const [revealed, setRevealed] = useState(message.content.length);
  const [copied, setCopied] = useState(false);
  const frame = useRef<number | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onStreamingDone);
  onDoneRef.current = onStreamingDone;

  // Typewriter reveal for the latest assistant answer only.
  useEffect(() => {
    if (!message.streaming) {
      setRevealed(message.content.length);
      return;
    }
    doneRef.current = false;
    setRevealed(0);
    let i = 0;
    const step = () => {
      i += 3;
      if (i < message.content.length) {
        setRevealed(i);
        frame.current = requestAnimationFrame(step);
      } else {
        setRevealed(message.content.length);
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current?.();
        }
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [message.streaming, message.content]);

  const isUser = message.role === 'user';
  const fullShown = revealed >= message.content.length;

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'} ${message.error ? 'msg--error' : ''}`}>
      <div className="msg__meta">
        <span className={`msg__avatar ${isUser ? 'msg__avatar--user' : 'msg__avatar--ai'}`}>
          {isUser ? 'You' : <SparkIcon size={15} />}
        </span>
        <span className="msg__author">{isUser ? 'You' : 'Knowledge'}</span>
        {!isUser && documentName && <span className="msg__doc">answered from “{documentName}”</span>}
      </div>

      <div className="msg__body">
        {isUser ? (
          <div className="msg__bubble">{message.content}</div>
        ) : (
          <div className="msg__answer">
            {message.streaming && !fullShown ? (
              <Markdown text={message.content.slice(0, revealed)} />
            ) : (
              <Markdown text={message.content} />
            )}

            {message.streaming && !fullShown && (
              <span className="msg__caret" aria-hidden="true" />
            )}

            {message.error && (
              <div className="msg__error-note">Something went wrong while answering. Try again.</div>
            )}
          </div>
        )}
      </div>

      {!isUser && fullShown && !message.streaming && !message.error && (
        <div className="msg__actions">
          <button className="msg__action" onClick={handleCopy}>
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {isLast && (
            <button className="msg__action" onClick={onRegenerate}>
              <RegenerateIcon size={13} />
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TypingDots({ color }: { color?: string }) {
  const style = color ? { background: color } : undefined;
  return (
    <span className="typing-dots" aria-label="Thinking">
      <span style={style} /><span style={style} /><span style={style} />
    </span>
  );
}

// Avatar used in the active-document chip in the composer area.
export function DocumentChipAvatar({ documentId, name }: { documentId: number; name: string }) {
  const color = docColor(documentId);
  return (
    <span className="doc-chip__avatar" style={{ background: color.soft, color: color.ink }}>
      {initialsFromFilename(name)}
    </span>
  );
}
