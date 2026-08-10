import { useEffect } from 'react';
import { LogoMark, SparkIcon, FileIcon, UploadIcon, CheckIcon, PlusIcon } from './Icons';
import './Landing.css';

export interface LandingProps {
  onLogin: () => void;     // open auth in login mode
  onRegister: () => void;  // open auth in register mode
}

const FEATURES = [
  {
    icon: 'file',
    title: 'Cited answers',
    body: 'Every reply is linked to the exact pages it came from, so you can verify each claim against your own document.',
  },
  {
    icon: 'bolt',
    title: 'Indexed in seconds',
    body: 'Drop in a PDF, report, or notes and Quill chunks, embeds, and indexes it automatically — start asking moments later.',
  },
  {
    icon: 'lock',
    title: 'Private to you',
    body: 'Your documents are scoped to your account and used only to answer you. Nothing leaves your workspace, nothing trains on your files.',
  },
];

const STEPS = [
  {
    icon: 'upload',
    title: 'Upload',
    body: 'Add PDFs, Word documents, or plain text — Quill reads and indexes them automatically.',
  },
  {
    icon: 'ask',
    title: 'Ask',
    body: 'Type your question in plain language. No prompts, no special formatting.',
  },
  {
    icon: 'answer',
    title: 'Get cited answers',
    body: 'Quill retrieves the most relevant passages and answers with page references you can check.',
  },
];

const FORMATS = ['PDF', 'DOCX', 'PPTX', 'TXT', 'Markdown'];

function FeatureIcon({ name }: { name: string }) {
  if (name === 'lock') {
    return (
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="3" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  }
  if (name === 'bolt') return <SparkIcon size={19} />;
  return <FileIcon size={19} />;
}

function StepIcon({ name }: { name: string }) {
  if (name === 'upload') return <UploadIcon size={18} />;
  if (name === 'answer') return <CheckIcon size={18} />;
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function Landing({ onLogin, onRegister }: LandingProps) {
  // Reveal-on-scroll: [data-reveal] elements fade up once as they enter view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      {/* ---------- Nav ---------- */}
      <header className="landing__nav">
        <div className="landing__nav-inner">
          <a className="landing__brand" href="#top" aria-label="Quill home">
            <LogoMark size={26} />
            <span className="landing__brand-name">Quill</span>
          </a>

          <nav className="landing__nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </nav>

          <div className="landing__nav-cta">
            <button className="landing__nav-login" type="button" onClick={onLogin}>
              Log in
            </button>
            <button className="landing__nav-join" type="button" onClick={onRegister}>
              Get started
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="landing__hero">
          <div className="landing__hero-inner">
            <div className="hero__copy">
              <p className="eyebrow">Document Q&amp;A</p>

              <h1 className="hero__title">
                Chat with your documents.
                <span className="hero__title-line">Every answer cites its <em>source.</em></span>
              </h1>

              <p className="hero__sub">
                Quill is a retrieval-augmented assistant: it reads your documents, indexes every page, and
                answers questions in plain language with citations back to the pages it used.
              </p>

              <div className="hero__cta">
                <button className="btn btn--primary" type="button" onClick={onRegister}>
                  Get started
                </button>
                <button className="btn btn--ghost" type="button" onClick={onLogin}>
                  Log in
                </button>
              </div>

              <p className="hero__trust">
                Private to your account&nbsp;&nbsp;·&nbsp;&nbsp;No training on your files&nbsp;&nbsp;·&nbsp;&nbsp;Free to start
              </p>
            </div>

            {/* A quiet, static product example — no animation. A tab bar with
                the open file (icon + name + format chip), then the standard
                upload → ask → cited-answer thread. */}
            <figure className="hero__mock" aria-label="Quill example: a question and its cited answer.">
              <div className="mock__bar">
                <div className="mock__tabs">
                  <span className="mock__tab mock__tab--active">
                    <FileIcon size={15} />
                    <span className="mock__tab-name">Annual_Report</span>
                    <span className="mock__tab-chip">PDF</span>
                  </span>
                  <span className="mock__tab mock__tab--add" aria-hidden="true">
                    <PlusIcon size={14} />
                  </span>
                </div>
                <span className="mock__meta">24 pages · indexed</span>
              </div>
              <div className="mock__thread">
                <div className="mock__msg mock__msg--user">
                  What were the key revenue takeaways?
                </div>
                <div className="mock__msg mock__msg--ai">
                  <span className="mock__avatar"><LogoMark size={18} /></span>
                  <div className="mock__bubble">
                    <p><strong>Revenue up 22%</strong> — revenue grew 22% year over year to $4.2M,
                      driven by enterprise renewals and a strong Q3. Gross margin held at 71%,
                      and the board noted an encouraging shift toward annual contracts.</p>
                    <div className="mock__sources">
                      <span className="mock__src">p. 3</span>
                      <span className="mock__src">p. 7</span>
                      <span className="mock__src">p. 12</span>
                    </div>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* ---------- Formats ---------- */}
        <div className="landing__formats">
          <div className="landing__formats-inner">
            <span className="landing__formats-label">Works with</span>
            {FORMATS.map((f) => (
              <span className="landing__format" key={f}>{f}</span>
            ))}
          </div>
        </div>

        {/* ---------- Features ---------- */}
        <section className="landing__section" id="features">
          <div className="landing__section-head" data-reveal>
            <p className="eyebrow">Features</p>
            <h2 className="landing__title">Answers you can trust — and verify.</h2>
            <p className="landing__lede">
              Quill builds on retrieval-augmented generation: your files stay yours, and every
              answer points back to the page it came from.
            </p>
          </div>

          <div className="features__grid">
            {FEATURES.map((f, i) => (
              <article className="feature-card" key={f.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}>
                <span className="feature-card__icon">
                  <FeatureIcon name={f.icon} />
                </span>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__body">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing__section landing__section--alt" id="how">
          <div className="landing__section-head" data-reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="landing__title">From upload to answer, in three steps.</h2>
          </div>

          <div className="how__grid">
            {STEPS.map((s, i) => (
              <div className="how__step" key={s.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}>
                <span className="how__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="how__icon"><StepIcon name={s.icon} /></span>
                <h3 className="how__title">{s.title}</h3>
                <p className="how__body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="landing__cta">
          <div className="landing__cta-inner" data-reveal>
            <p className="hero__eyebrow landing__cta-eyebrow">Quill</p>
            <h2 className="landing__cta-title">Start chatting with your files.</h2>
            <p className="landing__cta-sub">Create a free account and get cited answers in under a minute.</p>
            <button className="btn btn--primary landing__cta-btn" type="button" onClick={onRegister}>
              Get started — it&rsquo;s free
            </button>
            <p className="landing__cta-alt">
              Already have an account?{' '}
              <button type="button" onClick={onLogin}>Log in</button>
            </p>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="landing__foot">
        <span className="landing__foot-brand"><LogoMark size={20} /> Quill</span>
        <span className="landing__foot-tag">Chat with your documents.</span>
      </footer>
    </div>
  );
}