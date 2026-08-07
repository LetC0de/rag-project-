import { Fragment, type ReactNode } from 'react';

// A tiny, dependency-free markdown renderer tuned for chat answers.
// Handles the subset an LLM tends to emit: headings, bold, inline code,
// code fences, bullet/numbered lists, blockquotes, and links.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\[Page\s*\d+(?:\]\[Page\s*\d+)*\])/g;

function renderInline(text: string, key: number): ReactNode {
  const parts = text.split(INLINE).filter((p) => p.length > 0);
  return (
    <Fragment key={key}>
      {parts.map((part, i) => {
        // Inline page citation(s), e.g. "[Page 3]" or "[Page 3][Page 7]".
        const cite = part.match(/^\[Page\s*(\d+)\](?:\[Page\s*(\d+)\])*$/);
        if (cite) {
          return (
            <Fragment key={i}>
              {[...part.matchAll(/\[Page\s*(\d+)\]/g)].map((m) => (
                <sup key={m.index} className="cite">
                  {m[1]}
                </sup>
              ))}
            </Fragment>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const blocks: ReactNode[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listBuf: { marker: 'ul' | 'ol'; text: string }[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    const items = listBuf;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length}>
        {items.map((it, i) => (
          <li key={i}>
            <Markdown text={it.text} />
          </li>
        ))}
      </Tag>
    );
    listBuf = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code
    if (/^\s*```/.test(line)) {
      if (inCode) {
        blocks.push(<pre key={blocks.length}><code>{codeBuf.join('\n')}</code></pre>);
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    const h = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      flushList();
      const level = h[1].length as 1 | 2 | 3;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={blocks.length}>{renderInline(h[2], i)}</Tag>);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      flushList();
      blocks.push(<blockquote key={blocks.length}><Markdown text={trimmed.replace(/^>\s?/, '')} /></blockquote>);
      continue;
    }

    // Lists
    const ul = trimmed.match(/^[-*•]\s+(.*)/);
    const ol = trimmed.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const marker = ul ? 'ul' as const : 'ol' as const;
      if (listType && listType !== marker) flushList();
      if (!listType) listType = marker;
      listBuf.push({ marker, text: (ul ?? ol)![1] });
      continue;
    }

    flushList();

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push(<hr key={blocks.length} />);
      continue;
    }

    blocks.push(<p key={blocks.length}>{renderInline(trimmed, i)}</p>);
  }

  if (inCode) {
    blocks.push(<pre key={blocks.length}><code>{codeBuf.join('\n')}</code></pre>);
  }
  flushList();

  return <>{blocks}</>;
}

export { renderInline };
