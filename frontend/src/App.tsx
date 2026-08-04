import { useCallback, useEffect, useRef, useState } from 'react';
import { askQuestion, deleteDocument, listDocuments } from './lib/api';
import type { ChatMessage, Document } from './lib/types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { UploadModal } from './components/UploadModal';
import { DocumentPicker } from './components/DocumentPicker';
import './App.css';
import './components/Sidebar.css';
import './components/ChatArea.css';
import './components/UploadModal.css';
import './components/DocumentPicker.css';

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 860 : false
  );
  const abortRef = useRef<AbortController | null>(null);

  const activeDocument = documents.find((d) => d.id === selectedId) ?? null;
  const needsDocument = messages.length > 0 && !activeDocument;

  // Track viewport width for mobile mode
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On mobile, start with sidebar collapsed
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isMobile]);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load documents.');
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  // If the selected document is deleted (or still processing), fall back to
  // the most recent processed document so the composer always has a target.
  useEffect(() => {
    if (selectedId !== null && !documents.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [documents, selectedId]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    // Close sidebar on mobile after selection
    if (isMobile) setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setSelectedId(null);
    setComposerValue('');
    setPickerOpen(false);
    if (isMobile) setSidebarOpen(false);
  };

  const handleDelete = async (id: number) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUploaded = async () => {
    setUploadOpen(false);
    await refreshDocuments();
    // Auto-select the newest processed document after upload.
    const docs = await listDocuments();
    const newest = docs.find((d) => d.status === 'processed');
    if (newest) setSelectedId(newest.id);
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? composerValue).trim();
      if (!text || !activeDocument || isThinking) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        documentId: activeDocument.id,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        documentId: activeDocument.id,
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setComposerValue('');
      setIsThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await askQuestion({ document_id: activeDocument.id, question: text });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: res.answer, streaming: true }
              : m
          )
        );
        // The ChatMessageView typewriter calls onStreamingDone when it finishes.
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: msg, streaming: false, error: true }
              : m
          )
        );
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [composerValue, activeDocument, isThinking]
  );

  const handleStreamingDone = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, streaming: false } : m))
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsThinking(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  };

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // Remove the trailing assistant answer, then re-send.
    setMessages((prev) => prev.filter((m) => m.role === 'user'));
    void handleSend(lastUser.content);
  }, [messages, handleSend]);

  const openPicker = (anchor?: HTMLElement | null) => {
    if (anchor) setPickerAnchor(anchor);
    else setPickerAnchor(null);
    setPickerOpen(true);
  };

  const closePicker = () => setPickerOpen(false);

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true">
        <div className="blob blob--coral" />
        <div className="blob blob--sun" />
        <div className="blob blob--sky" />
        <div className="grain" />
      </div>

      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay sidebar-overlay--visible"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        documents={documents}
        selectedId={selectedId}
        collapsed={!sidebarOpen}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onUpload={() => {
          setUploadOpen(true);
          if (isMobile) setSidebarOpen(false);
        }}
        onDelete={handleDelete}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />

      <ChatArea
        messages={messages}
        activeDocument={activeDocument ?? undefined}
        isThinking={isThinking}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onSend={() => void handleSend()}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        onClearDocument={() => setSelectedId(null)}
        onPickDocument={(e) => openPicker(e?.target as HTMLElement | null)}
        onSuggestion={(text) => {
          setComposerValue(text);
          if (activeDocument) {
            void handleSend(text);
          } else {
            openPicker();
          }
        }}
        onUpload={() => setUploadOpen(true)}
        onStreamingDone={handleStreamingDone}
        isMobile={isMobile}
        onToggleSidebar={toggleSidebar}
      />

      {loadError && (
        <div className="toast toast--error">
          {loadError} — make sure the backend is running on :8000.
        </div>
      )}
      {needsDocument && (
        <div className="toast toast--warn">
          Pick a document to continue this conversation.
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />

      <DocumentPicker
        open={pickerOpen}
        anchor={pickerAnchor}
        documents={documents}
        onSelect={handleSelect}
        onUpload={() => setUploadOpen(true)}
        onClose={closePicker}
        isMobile={isMobile}
      />
    </div>
  );
}
