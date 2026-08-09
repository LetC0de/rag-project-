import { useCallback, useEffect, useRef, useState } from 'react';
import { askQuestion, deleteDocument, listDocuments } from './lib/api';
import { useAuth } from './lib/auth';
import type { ChatMessage, Document } from './lib/types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { UploadModal } from './components/UploadModal';
import { DocumentPicker } from './components/DocumentPicker';
import { AuthScreen } from './components/AuthScreen';
import { Landing } from './components/Landing';
import { LogoMark } from './components/Icons';
import './App.css';
import './components/Sidebar.css';
import './components/ChatArea.css';
import './components/UploadModal.css';
import './components/DocumentPicker.css';
import './components/AuthScreen.css';
import './components/Landing.css';

// Where an unauthenticated visitor is sent: the marketing landing page by
// default, or the auth card once they tap Log in / Get started.
type GuestView = 'landing' | 'login' | 'register';

export default function App() {
  const { user, isBooting, logout } = useAuth();
  const [guestView, setGuestView] = useState<GuestView>('landing');
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

  // Fetch documents only once auth has finished booting and a user is confirmed.
  // Firing earlier would send an unauthenticated /documents request (no token yet),
  // which the backend rejects with 401 "Token not found" — the race that broke deploys.
  useEffect(() => {
    if (isBooting || !user) return;
    void refreshDocuments();
  }, [refreshDocuments, isBooting, user]);

  // If the selected document is deleted (or still processing), fall back to
  // the most recent processed document so the composer always has a target.
  useEffect(() => {
    if (selectedId !== null && !documents.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [documents, selectedId]);

  // Any switch of the signed-in user clears the previous session's chat state.
  // Without this, App stays mounted across logout→login and user 1's messages,
  // selection, composer text, etc. survive into user 2's session.
  useEffect(() => {
    setGuestView('landing');
    setMessages([]);
    setSelectedId(null);
    setComposerValue('');
    setIsThinking(false);
    setUploadOpen(false);
    setPickerOpen(false);
    setLoadError('');
    // Cancel any in-flight streaming answer so a stale request from the
    // previous user can't resolve and write back after the switch.
    abortRef.current?.abort();
    abortRef.current = null;
  }, [user?.id]);

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
      if (!text || isThinking) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        documentId: activeDocument?.id,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        documentId: activeDocument?.id,
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setComposerValue('');
      setIsThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // With no document selected, omit document_id so the backend answers
      // in concierge mode (about the product) instead of retrieving content.
      const payload = activeDocument
        ? { document_id: activeDocument.id, question: text }
        : { question: text };

      try {
        const res = await askQuestion(payload);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: res.answer, sources: res.sources, streaming: true }
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

  // Retry a failed answer: drop the failed assistant bubble and re-send the
  // user question that preceded it, keeping the rest of the thread intact.
  const handleRetry = useCallback(
    (failedId: string) => {
      const idx = messages.findIndex((m) => m.id === failedId);
      if (idx < 0) return;
      const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
      if (!question) return;
      setMessages((prev) => prev.filter((m) => m.id !== failedId));
      void handleSend(question.content);
    },
    [messages, handleSend]
  );

  const openPicker = (anchor?: HTMLElement | null) => {
    // Anchor the picker to whatever triggered it. If none was passed
    // (e.g. a follow-up suggestion click), fall back to the composer's
    // "+" button so the menu opens in the same place as a + click.
    const attachBtn = anchor ?? document.querySelector<HTMLElement>('.composer__attach');
    setPickerAnchor(attachBtn);
    setPickerOpen(true);
  };

  const closePicker = () => setPickerOpen(false);

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  // While restoring the session from the stored token, show a brief boot screen.
  if (isBooting) {
    return (
      <div className="app app--boot">
        <div className="app-bg" aria-hidden="true">
          <div className="blob blob--coral" />
          <div className="blob blob--sun" />
          <div className="blob blob--sky" />
          <div className="grain" />
        </div>
        <div className="boot">
          <span className="boot__mark"><LogoMark size={44} /></span>
          <span className="boot__bar"><span className="boot__bar-fill" /></span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (guestView === 'landing') {
      return (
        <Landing
          onLogin={() => setGuestView('login')}
          onRegister={() => setGuestView('register')}
        />
      );
    }
    return (
      <AuthScreen
        initialMode={guestView}
        onBack={() => setGuestView('landing')}
      />
    );
  }

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
        onDelete={handleDelete}
        onClose={() => setSidebarOpen(false)}
        onExpand={() => setSidebarOpen(true)}
        isMobile={isMobile}
        user={user}
        onLogout={logout}
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
          void handleSend(text);
        }}
        onUpload={() => setUploadOpen(true)}
        onStreamingDone={handleStreamingDone}
        onRetry={handleRetry}
        isMobile={isMobile}
        onToggleSidebar={toggleSidebar}
      />

      {loadError && (
        <div className="toast toast--error">
          {loadError} — please try again.
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
