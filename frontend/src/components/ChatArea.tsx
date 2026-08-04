import { useEffect, useRef } from 'react';
import type { ChatMessage, Document } from '../lib/types';
import { ChatMessageView, DocumentChipAvatar, TypingDots } from './ChatMessage';
import { Composer } from './Composer';
import { LogoMark, SparkIcon, UploadIcon } from './Icons';

interface ChatAreaProps {
  messages: ChatMessage[];
  activeDocument?: Document;
  isThinking: boolean;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: () => void;
  onClearDocument: () => void;
  onPickDocument: (e?: React.MouseEvent) => void;
  onSuggestion: (text: string) => void;
  onUpload: () => void;
  onStreamingDone: (messageId: string) => void;
}

const SUGGESTIONS = [
  { icon: '📄', text: 'Summarize this document in a few bullet points.' },
  { icon: '🔍', text: 'What are the main key takeaways and conclusions?' },
  { icon: '📊', text: 'Extract the key numbers, dates, and data points.' },
  { icon: '💡', text: 'Explain the most important concepts in plain language.' },
];

export function ChatArea({
  messages,
  activeDocument,
  isThinking,
  composerValue,
  onComposerChange,
  onSend,
  onStop,
  onRegenerate,
  onClearDocument,
  onPickDocument,
  onSuggestion,
  onUpload,
  onStreamingDone,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasChat = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  return (
    <main className="chat">
      {hasChat ? (
        <div className="chat__thread" ref={scrollRef}>
          <div className="chat__thread-inner">
            {messages.map((m, i) => (
              <ChatMessageView
                key={m.id}
                message={m}
                documentName={m.documentId === activeDocument?.id ? activeDocument?.filename : undefined}
                isLast={i === messages.length - 1}
                onCopy={(content) => navigator.clipboard?.writeText(content)}
                onRegenerate={onRegenerate}
                onStreamingDone={() => onStreamingDone(m.id)}
              />
            ))}
            {isThinking && (
              <div className="msg msg--assistant msg--thinking">
                <div className="msg__meta">
                  <span className="msg__avatar msg__avatar--ai"><SparkIcon size={15} /></span>
                  <span className="msg__author">Knowledge</span>
                </div>
                <div className="msg__body">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      ) : (
        <div className="chat__welcome">
          <div className="welcome__inner">
            <div className="welcome__mark"><LogoMark size={46} /></div>
            <h1 className="welcome__title">
              {activeDocument ? (
                <>Ask anything about <em>“{activeDocument.filename}”</em></>
              ) : (
                <>Chat with your <em>documents</em></>
              )}
            </h1>
            <p className="welcome__sub">
              {activeDocument
                ? 'Questions are answered from the content of this PDF — grounded, not guessed.'
                : 'Upload a PDF, then ask questions. Answers are grounded in your document.'}
            </p>

            {activeDocument && (
              <div className="welcome__doc">
                <DocumentChipAvatar documentId={activeDocument.id} name={activeDocument.filename} />
                <span className="welcome__doc-name">{activeDocument.filename}</span>
              </div>
            )}

            {!activeDocument && (
              <button className="welcome__upload" onClick={onUpload}>
                <UploadIcon size={18} />
                Upload your first PDF
              </button>
            )}

            <div className="welcome__suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion"
                  onClick={() => onSuggestion(s.text)}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <span className="suggestion__icon">{s.icon}</span>
                  <span className="suggestion__text">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="chat__composer-wrap">
        <Composer
          value={composerValue}
          onChange={onComposerChange}
          onSubmit={onSend}
          onStop={onStop}
          isBusy={isThinking}
          activeDocument={activeDocument}
          onClearDocument={onClearDocument}
          onPickDocument={onPickDocument}
          disabled={hasChat && !activeDocument}
        />
        <p className="chat__footnote">Knowledge answers from your uploaded documents only.</p>
      </div>
    </main>
  );
}
