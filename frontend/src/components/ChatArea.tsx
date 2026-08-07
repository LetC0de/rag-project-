import { useEffect, useRef } from 'react';
import type { ChatMessage, Document } from '../lib/types';
import { ChatMessageView, DocumentChipAvatar, TypingDots } from './ChatMessage';
import { Composer } from './Composer';
import { LogoMark, MenuIcon, SparkIcon, UploadIcon } from './Icons';

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
  isMobile: boolean;
  onToggleSidebar: () => void;
}

const SUGGESTIONS = [
  { icon: '📄', text: 'Summarize this document in a few bullet points.' },
  { icon: '🔍', text: 'What are the main key takeaways and conclusions?' },
  { icon: '📊', text: 'Extract the key numbers, dates, and data points.' },
  { icon: '💡', text: 'Explain the most important concepts in plain language.' },
];

// Concierge prompts shown when no document is selected. These introduce the
// product and guide the user instead of assuming a doc is already in context.
const CONCIERGE_SUGGESTIONS = [
  { icon: '✨', text: 'What is Quill and what does it do?' },
  { icon: '📥', text: 'How do I upload and ask about a document?' },
  { icon: '🗂', text: 'What can I ask about my uploaded PDFs?' },
  { icon: '💬', text: 'Can you help me get started?' },
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
  isMobile,
  onToggleSidebar,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasChat = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  return (
    <main className="chat">
      {/* Mobile header bar */}
      {isMobile && (
        <div className="chat__mobile-header">
          <button
            className="chat__hamburger"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
          >
            <MenuIcon size={22} />
          </button>

          <div className="chat__mobile-brand">
            <span className="chat__mobile-logo"><LogoMark size={22} /></span>
            <span className="chat__mobile-title">
              {activeDocument ? (
                activeDocument.filename
              ) : (
                <>Quill<span className="chat__mobile-accent">Assistant</span></>
              )}
            </span>
            {activeDocument && (
              <span className="chat__mobile-sub">
                {activeDocument.status === 'processed' ? 'Ready' : activeDocument.status}
              </span>
            )}
          </div>
        </div>
      )}

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
                  <span className="msg__author">Quill</span>
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
                <>Ask anything about <em>"{activeDocument.filename}"</em></>
              ) : (
                <>Your <em>document assistant</em></>
              )}
            </h1>
            <p className="welcome__sub">
              {activeDocument
                ? 'Questions are answered from the content of this PDF — grounded, not guessed.'
                : 'Chat with Quill about the app, or upload a PDF to ask questions grounded in its pages.'}
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
                {(activeDocument ? SUGGESTIONS : CONCIERGE_SUGGESTIONS).map((s, i) => (
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
        />
        <p className="chat__footnote">
          {activeDocument
            ? 'Quill answers from this document, with page citations.'
            : 'Ask about Quill, or upload a document to chat with its content.'}
        </p>
      </div>
    </main>
  );
}
