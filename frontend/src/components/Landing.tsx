import { useEffect, useRef, useState } from 'react';
import { LogoMark, SparkIcon, UploadIcon, CheckIcon, FileIcon, NewChatIcon } from './Icons';
import { initialsFromFilename, docColor } from '../lib/palette';
import './Landing.css';

export interface LandingProps {
  onLogin: () => void;     // open auth in login mode
  onRegister: () => void;  // open auth in register mode
}

// Floating document chips that orbit the chat mockup. Each wears a color
// from the same palette the app uses for real documents.
const FLOATERS = [
  { name: 'Annual_Report.pdf', color: docColor(1).main, x: -8, y: -16, d: '0s' },
  { name: 'Research_Paper.pdf', color: docColor(3).main, x: 110, y: -24, d: '1.2s' },
  { name: 'Meeting_Notes.docx', color: docColor(4).main, x: 116, y: 62, d: '2.1s' },
  { name: 'Product_Spec.md', color: docColor(6).main, x: -12, y: 64, d: '0.6s' },
];

const FEATURES = [
  {
    icon: 'citations',
    title: 'Answers you can trace',
    body: 'Every reply is grounded in your uploaded pages and shown with citation chips, so you always know exactly where an answer came from.',
  },
  {
    icon: 'bolt',
    title: 'Indexed in seconds',
    body: 'Drop in a PDF, report, or notes and Quill chunks, embeds, and indexes it automatically. Start asking moments later.',
  },
  {
    icon: 'lock',
    title: 'Yours only',
    body: 'Documents are scoped to your account and used to answer you — nothing leaves your workspace, nothing trains on your files.',
  },
];

type StepKey = 'upload' | 'ask' | 'answer';

const STEPS: Array<{ icon: StepKey; title: string; body: string }> = [
  {
    icon: 'upload',
    title: 'Upload your document',
    body: 'PDFs, Word files, slide decks, or plain text — drag it in and Quill takes it from there.',
  },
  {
    icon: 'ask',
    title: 'Ask in plain language',
    body: 'No prompts, no formatting. Ask “what are the risks?” the way you would ask a colleague.',
  },
  {
    icon: 'answer',
    title: 'Get cited answers',
    body: 'Every answer comes with page references, so you can jump straight to the source and verify.',
  },
];

const FILE_TYPES = ['PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'Contracts', 'Research', 'Reports'];

// Canned exchanges the hero mock cycles through when tapped.
const MOCK_PLAYS = [
  {
    question: 'What were the key revenue takeaways?',
    lead: [
      { text: 'Revenue up ', strong: true },
      { text: '22%', strong: false },
    ] as const,
    answer:
      'Revenue grew 22% year over year to $4.2M, driven by enterprise renewals and a strong Q3. Gross margin held at 71%, and the board noted an encouraging shift toward annual contracts.',
    sources: [
      { label: 'pg', num: '3' },
      { label: 'pg', num: '7' },
      { label: 'pg', num: '12' },
    ],
  },
  {
    question: 'Summarize the risks section in under 30 words.',
    lead: [
      { text: 'Key risks ', strong: true },
      { text: 'identified', strong: false },
    ] as const,
    answer:
      'Main risks: reliance on a single cloud region, FX exposure on APAC revenue, and a key-man dependency on the data team. Mitigations are documented in §4.2.',
    sources: [
      { label: 'pg', num: '9' },
      { label: '§', num: '4.2' },
    ],
  },
  {
    question: 'Pull out the launch dates from the roadmap.',
    lead: [
      { text: 'Launch dates ', strong: true },
      { text: 'extracted', strong: false },
    ] as const,
    answer:
      'Public beta ships June 3, GA is targeted for August 17, and the enterprise tier lands in late Q4 alongside the mobile companion app.',
    sources: [
      { label: 'pg', num: '5' },
      { label: 'pg', num: '21' },
    ],
  },
];

function FeatureIcon({ name }: { name: string }) {
  if (name === 'bolt') {
    return <SparkIcon size={19} />;
  }
  if (name === 'lock') {
    return (
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="3" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  }
  return <FileIcon size={19} />;
}

function StepIcon({ name }: { name: StepKey }) {
  if (name === 'ask') return <NewChatIcon size={20} />;
  if (name === 'answer') return <CheckIcon size={20} />;
  return <UploadIcon size={20} />;
}

export function Landing({ onLogin, onRegister }: LandingProps) {
  const [playIndex, setPlayIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'done'>('typing');
  const [scrolled, setScrolled] = useState(false);
  const [marqueePaused, setMarqueePaused] = useState(false);

  const timerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef(0);
  const playIndexRef = useRef(playIndex);
  playIndexRef.current = playIndex;

  const play = MOCK_PLAYS[playIndex];

  // Reveal-on-scroll: the observer toggles .is-revealed on [data-reveal] elms.
  useEffect(() => {
    const observed = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      observed.forEach((el) => el.classList.add('is-revealed'));
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
      { threshold: 0.18, root: null, rootMargin: '0px 0px -8% 0px' }
    );
    observed.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Type the current play's answer, fresh each time the play changes.
  useEffect(() => {
    const answer = MOCK_PLAYS[playIndexRef.current].answer;
    window.clearTimeout(timerRef.current);
    window.cancelAnimationFrame(frameRef.current);

    setPhase('typing');
    setTyped('');

    timerRef.current = window.setTimeout(() => {
      let i = 0;
      const step = () => {
        i += 2;
        if (i < answer.length) {
          setTyped(answer.slice(0, i));
          frameRef.current = window.requestAnimationFrame(step);
        } else {
          setTyped(answer);
          setPhase('done');
        }
      };
      frameRef.current = window.requestAnimationFrame(step);
    }, 420);
  }, [playIndex]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Tighten the nav once the user scrolls down.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('.landing');
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > 16);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const replay = () => setPlayIndex((i) => (i + 1) % MOCK_PLAYS.length);

  const marquee = FILE_TYPES.concat(FILE_TYPES);

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="blob blob--coral landing__blob--coral" />
        <div className="blob blob--sun landing__blob--sun" />
        <div className="blob blob--sky landing__blob--sky" />
        <div className="grain" />
      </div>

      {/* ---------- Nav ---------- */}
      <header className={`landing__nav${scrolled ? ' landing__nav--scrolled' : ''}`}>
        <div className="landing__nav-inner">
          <a className="landing__brand" href="#" aria-label="Quill home">
            <span className="landing__brand-mark"><LogoMark size={30} /></span>
            <span className="landing__brand-name">
              Quill<span className="landing__brand-dot">.</span>
            </span>
          </a>

          <nav className="landing__nav-links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
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

      {/* ---------- Hero ---------- */}
      <section className="landing__hero">
        <div className="landing__hero-inner">
          <div className="hero__copy">
            <span className="hero__eyebrow">
              <span className="hero__eyebrow-dot" aria-hidden="true" />
              Quill · chat with your documents
            </span>

            <h1 className="hero__title">
              Your documents,
              <br />
              <em>read back</em> to you.
            </h1>

            <p className="hero__sub">
              Upload a PDF, report, or notes — Quill indexes every page, then answers
              your questions with grounded, cited replies. No guessing, no hallucination.
            </p>

            <div className="hero__cta">
              <button className="hero__btn hero__btn--primary" type="button" onClick={onRegister}>
                <SparkIcon size={17} />
                Get started — it&rsquo;s free
              </button>
              <button className="hero__btn hero__btn--ghost" type="button" onClick={onLogin}>
                Log in
              </button>
            </div>

            <ul className="hero__points" aria-label="What you get">
              <li><CheckIcon size={14} /> Grounded answers with page citations</li>
              <li><CheckIcon size={14} /> Upload PDF, DOCX, PPTX &amp; more</li>
              <li><CheckIcon size={14} /> Private to your account</li>
            </ul>
          </div>

          {/* ---------- Chat mockup ---------- */}
          <div className="hero__stage">
            <div
              className="hero-mock"
              role="button"
              tabIndex={0}
              onClick={replay}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  replay();
                }
              }}
              aria-label="A chat with Quill. Tap or press Enter to play another example."
            >
              <div className="hero-mock__bar">
                <span className="hero-mock__traffic"><i /><i /><i /></span>
                <span className="hero-mock__title">
                  <span className="hero-mock__logo"><LogoMark size={16} /></span>
                  Quill
                  <span className="hero-mock__doc"> · Annual_Report.pdf</span>
                </span>
                <span className="hero-mock__status"><i aria-hidden="true" /> Ready</span>
              </div>

              <div className="hero-mock__body">
                <div className="mock-msg mock-msg--user">
                  {play.question}
                </div>

                <div className="mock-msg mock-msg--ai">
                  <span className="mock-msg__avatar"><SparkIcon size={14} /></span>
                  <div className="mock-msg__answer">
                    <p className="mock-msg__lead">
                      {play.lead.map((part, i) => (
                        <span className={part.strong ? 'mock-lead__up' : 'mock-lead__strong'} key={i}>
                          {part.text}
                        </span>
                      ))}
                      <span className="mock-msg__caret" aria-hidden="true" />
                      <br />
                      <span className="mock-msg__typed">{typed}</span>
                    </p>
                    {phase === 'done' && (
                      <div className="mock-msg__sources" aria-label="Sources">
                        {play.sources.map((s) => (
                          <span className="mock-msg__source" key={`${s.label}${s.num}`}>
                            <span className="mock-msg__source-label">{s.label}</span>
                            {s.num}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {phase !== 'done' && (
                  <div className="mock-msg mock-msg--typing">
                    <span className="mock-msg__avatar"><SparkIcon size={14} /></span>
                    <span className="mock-msg__dots"><i /><i /><i /></span>
                  </div>
                )}
              </div>

              <div className="hero-mock__refresh">
                <span>Tap to replay</span>
              </div>
            </div>

            {/* Floating document chips */}
            {FLOATERS.map((f, i) => (
              <span
                className="hero-float"
                key={f.name}
                style={{
                  ['--fx' as string]: `${f.x}%`,
                  ['--fy' as string]: `${f.y}%`,
                  ['--fd' as string]: f.d,
                  zIndex: 10 - i,
                }}
              >
                <span className="hero-float__chip">
                  <span className="hero-float__initials" style={{ background: f.color }}>{initialsFromFilename(f.name)}</span>
                  <span className="hero-float__meta">
                    <span className="hero-float__name">{f.name}</span>
                    <span className="hero-float__tag">
                      <i style={{ background: f.color }} aria-hidden="true" />
                      Ready
                    </span>
                  </span>
                </span>
              </span>
            ))}

            <span className="hero__glow" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ---------- Marquee ---------- */}
      <div
        className="landing__marquee"
        aria-hidden="true"
        onMouseEnter={() => setMarqueePaused(true)}
        onMouseLeave={() => setMarqueePaused(false)}
        onPointerDown={() => setMarqueePaused(true)}
        onPointerUp={() => setMarqueePaused(false)}
      >
        <div className={`landing__marquee-track${marqueePaused ? ' landing__marquee-track--paused' : ''}`}>
          {marquee.map((t, i) => (
            <span className="landing__marquee-item" key={`${t}-${i}`}>
              <FileIcon size={15} />
              {t}
              <i aria-hidden="true">✦</i>
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Features ---------- */}
      <section className="landing__features" id="features">
        <div className="landing__features-inner">
          <span className="hero__eyebrow" data-reveal><span className="hero__eyebrow-dot" aria-hidden="true" /> Why Quill</span>
          <h2 className="landing__section-title" data-reveal>
            Everything to ask your files, <em>nothing to lose.</em>
          </h2>

          <div className="features__grid">
            {FEATURES.map((f, i) => (
              <article className="feature-card" key={f.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 100}ms` }}>
                <span className="feature-card__icon">
                  <FeatureIcon name={f.icon} />
                </span>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__body">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="landing__how" id="how">
        <div className="landing__how-inner">
          <span className="hero__eyebrow" data-reveal><span className="hero__eyebrow-dot" aria-hidden="true" /> How it works</span>
          <h2 className="landing__section-title" data-reveal>From upload to answer, <em>in three steps.</em></h2>

          <ol className="how__steps">
            {STEPS.map((s, i) => (
              <li className="how__step" key={s.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 100}ms` }}>
                <span className="how__step-num">0{i + 1}</span>
                <span className="how__step-icon"><StepIcon name={s.icon} /></span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="landing__cta">
        <div className="landing__cta-inner" data-reveal>
          <div className="cta__spark" aria-hidden="true"><LogoMark size={46} /></div>
          <h2 className="cta__title">Give your documents a <em>voice.</em></h2>
          <p className="cta__sub">Create a free account and start chatting with your files in under a minute.</p>
          <button className="hero__btn hero__btn--primary cta__btn" type="button" onClick={onRegister}>
            <SparkIcon size={17} />
            Get started — it&rsquo;s free
          </button>
          <p className="cta__alt">
            Already have an account?{' '}
            <button type="button" onClick={onLogin}>Log in</button>
          </p>
        </div>
      </section>

      <footer className="landing__foot">
        <span className="landing__foot-brand"><LogoMark size={20} /> Quill</span>
        <span className="landing__foot-tag">Chat with your documents.</span>
      </footer>
    </div>
  );
}
