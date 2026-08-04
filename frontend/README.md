# Knowledge — Frontend

A warm, vibrant ChatGPT-style interface for chatting with your documents.
Built with **React + TypeScript + Vite** against your FastAPI RAG backend.

## Aesthetic

**"Sunlit Garden Study"** — a light, warm cream base (`#FAF6EF`) with sun-warmed
ambient blobs and a subtle grain overlay. Each document wears a vibrant color
identity (tangerine, kiwi, sky, berry…) chosen deterministically from its id.
Typography pairs **Fraunces** (a characterful display serif) with **Outfit**
(a humanist sans) — no generic Inter/system stack. Micro-motion is used for
high-impact moments: staggered welcome reveal, typewriter answer reveal,
live typing indicator, and hover lifts.

## Features

- **Document library** — sidebar lists uploaded PDFs with per-doc color avatars,
  status badges (Queued / Indexing / Ready / Failed), upload date, and delete.
- **Chat with a document** — pick a document, ask questions; answers are grounded
  in that PDF's content. Each message remembers which doc it came from.
- **Typewriter answers** — the LLM reply reveals with a typewriter effect, then
  action buttons (Copy / Regenerate) appear.
- **Suggestion prompts** — one-click starter questions on the welcome screen.
- **Upload flow** — drag & drop or browse, with real upload progress and a
  "Document ready" state; the new document is auto-selected for chat.
- **Vite dev proxy** — `/api` → `http://127.0.0.1:8000` so no CORS headaches
  (CORS is also enabled on the backend).

## Run it

1. Start the backend (FastAPI/uvicorn) on port **8000**.
2. `cd frontend`
3. `npm install`
4. `npm run dev` → open http://localhost:5173

## Project structure

```
src/
  App.tsx                 # state + wiring
  lib/
    types.ts              # API/Document/Chat types
    api.ts                # list, upload, delete, ask
    palette.ts            # per-document color identity + helpers
    markdown.tsx          # tiny markdown renderer for answers
  components/
    Sidebar.tsx/.css      # brand, doc list, upload CTA
    ChatArea.tsx/.css     # welcome, thread, composer
    ChatMessage.tsx       # bubbles + typewriter + actions
    Composer.tsx          # auto-grow textarea + send/stop
    UploadModal.tsx/.css  # drag-drop + progress
    DocumentPicker.tsx    # choose a doc while composing
    Icons.tsx             # inline SVG set
```
