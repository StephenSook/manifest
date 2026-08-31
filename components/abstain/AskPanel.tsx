'use client';

// components/abstain/AskPanel.tsx
// Task 2.5: Regulatory Q&A panel with first-class abstention states.
//
// POSTs to /api/ask with { question }. Four response states:
//   1. abstained true, citations empty  - corpus cannot support an answer
//   2. abstained true, citations present - retrieved but did not survive audit
//   3. abstained false, audited true     - grounded, fully cited answer
//   4. abstained false, audited false    - extractive fallback, not verified
//
// Abstention (states 1 and 2) is the product working correctly.
// State 4 is the one that warrants visible caution: an answer with less
// verification than the reader would assume.
//
// No em-dashes. No regulatory text typed into JSX: all copy from payload.

import { useState, useId, useRef, useEffect } from 'react';
import { apiBase } from '@/lib/api-base';
import type { Citation } from '@/engine/types';

// ---------------------------------------------------------------------------
// Response contract matching /api/ask
// ---------------------------------------------------------------------------

interface AskResponse {
  answer: string | null;
  citations: Citation[];
  audited: boolean;
  abstained: boolean;
  reason?: string;
  /**
   * True when watsonx was configured but unreachable, so THIS response came
   * from the offline extractive path. Provenance has to travel with the
   * response: /api/status reports credential presence, not model health, so
   * during an outage it still says watsonx while this answer did not come
   * from watsonx.
   */
  degraded?: boolean;
}

// Who is answering. Fetched from GET /api/status.runtime, not inferred
// from the answer text. Same source the judge page prints.
interface RuntimeInfo {
  generation_backend: string;
  embedding_backend: string;
  guardian_audit: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Suggested questions: taken from live abstention traps and documented CFR
// sections in the corpus. One is an abstention trap so a judge can see a
// refusal without knowing what to type.
// ---------------------------------------------------------------------------

const SUGGESTED: readonly string[] = [
  'What is the pre-space notification deadline under 47 CFR 97.207(g)(1)?',
  'When does Part 100 take effect?',
  'What does 47 CFR 25.283 require for post-mission disposal?',
];

// ---------------------------------------------------------------------------
// Styles: globals.css tokens only. No new colors.
// ---------------------------------------------------------------------------

const S = {
  panel: {
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--color-surface)',
    marginBottom: '1rem',
  } satisfies React.CSSProperties,

  heading: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    margin: '0 0 0.75rem',
  } satisfies React.CSSProperties,

  hint: {
    fontSize: '12px',
    color: 'var(--color-muted)',
    margin: '0 0 0.75rem',
    lineHeight: '1.5',
  } satisfies React.CSSProperties,

  suggestedLabel: {
    fontSize: '11px',
    color: 'var(--color-muted)',
    margin: '0 0 0.35rem',
  } satisfies React.CSSProperties,

  suggestedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    margin: '0 0 1rem',
    padding: 0,
    listStyle: 'none',
  } satisfies React.CSSProperties,

  suggestedBtn: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    color: 'var(--color-fg)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: '1.4',
    padding: '0.35rem 0.6rem',
    textAlign: 'left' as const,
    width: '100%',
  } satisfies React.CSSProperties,

  inputRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
  } satisfies React.CSSProperties,

  textarea: {
    flex: 1,
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: '1.5',
    minHeight: '3.5rem',
    outline: 'none',
    padding: '0.35rem 0.5rem',
    resize: 'vertical' as const,
  } satisfies React.CSSProperties,

  submitBtn: {
    backgroundColor: 'var(--color-accent)',
    border: 'none',
    borderRadius: '3px',
    color: 'var(--color-fg)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    padding: '0.45rem 1rem',
    whiteSpace: 'nowrap' as const,
  } satisfies React.CSSProperties,

  submitBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
  } satisfies React.CSSProperties,

  responseRegion: {
    marginTop: '1.25rem',
  } satisfies React.CSSProperties,

  // State 1 and 2: abstention. Restrained muted treatment - the product
  // working correctly. No error colors.
  abstainBlock: {
    borderLeft: '2px solid var(--color-border)',
    paddingLeft: '0.75rem',
  } satisfies React.CSSProperties,

  abstainLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    margin: '0 0 0.4rem',
  } satisfies React.CSSProperties,

  abstainReason: {
    fontSize: '13px',
    color: 'var(--color-muted)',
    margin: '0 0 0.75rem',
    lineHeight: '1.6',
  } satisfies React.CSSProperties,

  // State 3: grounded answer
  answerBlock: {
    borderLeft: '2px solid var(--color-ok)',
    paddingLeft: '0.75rem',
  } satisfies React.CSSProperties,

  answerLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-ok)',
    margin: '0 0 0.4rem',
  } satisfies React.CSSProperties,

  answerText: {
    fontSize: '13px',
    color: 'var(--color-fg)',
    margin: '0 0 0.75rem',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap' as const,
  } satisfies React.CSSProperties,

  // State 4: unaudited extractive answer - visible caution
  unauditedBlock: {
    borderLeft: '2px solid var(--color-at-risk)',
    paddingLeft: '0.75rem',
  } satisfies React.CSSProperties,

  unauditedLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-at-risk)',
    margin: '0 0 0.4rem',
  } satisfies React.CSSProperties,

  unauditedNotice: {
    fontSize: '12px',
    color: 'var(--color-at-risk)',
    margin: '0 0 0.5rem',
    lineHeight: '1.5',
  } satisfies React.CSSProperties,

  citationsHeading: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    margin: '0.75rem 0 0.4rem',
  } satisfies React.CSSProperties,

  citationList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } satisfies React.CSSProperties,

  citationItem: {
    fontSize: '12px',
    color: 'var(--color-muted)',
    borderLeft: '1px solid var(--color-border)',
    paddingLeft: '0.5rem',
    lineHeight: '1.5',
  } satisfies React.CSSProperties,

  citationSection: {
    color: 'var(--color-fg)',
    fontWeight: 600,
  } satisfies React.CSSProperties,

  citationLink: {
    color: 'var(--color-accent)',
    textDecoration: 'none',
  } satisfies React.CSSProperties,

  loadingText: {
    fontSize: '13px',
    color: 'var(--color-muted)',
    margin: 0,
  } satisfies React.CSSProperties,

  writerBanner: {
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    padding: '0.5rem 0.65rem',
    margin: '0 0 0.75rem',
    fontSize: '12px',
    color: 'var(--color-fg)',
    lineHeight: 1.5,
  } satisfies React.CSSProperties,

  writerKicker: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    margin: '0 0 0.25rem',
  } satisfies React.CSSProperties,

  writerLine: {
    fontSize: '12px',
    color: 'var(--color-muted)',
    margin: '0 0 0.5rem',
    lineHeight: 1.5,
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// CitationRow: one citation entry
// ---------------------------------------------------------------------------

function CitationRow({ c }: { c: Citation }) {
  const isCfr = c.cfrTitle > 0;
  const sectionLabel = isCfr
    ? `${c.cfrTitle} CFR ${c.section}${c.paragraphPath}`
    : c.section;

  return (
    <li style={S.citationItem}>
      <span style={S.citationSection}>{sectionLabel}</span>
      {' '}
      <span>AMDDATE {c.amddate}</span>
      {' '}
      {c.sourceUrl && (
        <a
          href={c.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={S.citationLink}
          aria-label={`Source for ${sectionLabel}`}
        >
          source
        </a>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// ResponseRegion: renders the four states
// ---------------------------------------------------------------------------

/**
 * Who wrote THIS answer.
 *
 * Previously this read every field from /api/status, which derives the writer
 * from credential presence. On 2026-08-29 the watsonx token quota was
 * exhausted, /api/status still said watsonx and active, and this line would
 * have printed "Writer: watsonx. Guardian: active." directly above a reason
 * saying the answer came from the offline extractive path. The response knows
 * what produced it, so the response wins over the deployment snapshot.
 */
function WriterLine({
  runtime,
  data,
}: {
  runtime: RuntimeInfo | null;
  data?: AskResponse;
}) {
  if (data?.degraded) {
    // The embedder name is NOT defaulted to a literal here. The client learns
    // it from /api/status or it does not learn it at all, and a hardcoded
    // 'hashing-trick-768' would keep printing that name unchanged after a
    // corpus rebuild swapped the embedder, while /api/status told the truth.
    // A UI that states a backend nothing measured is the same defect as a
    // number with no source behind it.
    return (
      <p style={S.writerLine}>
        Writer: offline extractive path, quoted from the corpus. Guardian: did
        not run. Embedding:{' '}
        {runtime?.embedding_backend ?? 'not read for this request'}. watsonx is
        configured on this deployment but was unreachable for this request.
      </p>
    );
  }
  if (!runtime) return null;
  return (
    <p style={S.writerLine}>
      Writer: {runtime.generation_backend}. Guardian:{' '}
      {runtime.guardian_audit}. Embedding: {runtime.embedding_backend}.
    </p>
  );
}

function ResponseRegion({
  data,
  runtime,
}: {
  data: AskResponse;
  runtime: RuntimeInfo | null;
}) {
  const { abstained, audited, answer, citations, reason } = data;

  // State 1: abstained, no citations
  if (abstained && citations.length === 0) {
    return (
      <div style={S.abstainBlock}>
        <p style={S.abstainLabel}>Abstained</p>
        <WriterLine runtime={runtime} data={data} />
        <p style={S.abstainReason}>{reason}</p>
      </div>
    );
  }

  // State 2: abstained, citations present (retrieved but did not survive)
  if (abstained && citations.length > 0) {
    return (
      <div style={S.abstainBlock}>
        <p style={S.abstainLabel}>Abstained</p>
        <WriterLine runtime={runtime} data={data} />
        <p style={S.abstainReason}>{reason}</p>
        <p style={S.citationsHeading}>Retrieved sections</p>
        <ul style={S.citationList} aria-label="Retrieved sections">
          {citations.map((c, i) => (
            <CitationRow key={i} c={c} />
          ))}
        </ul>
      </div>
    );
  }

  // State 3: answered, audited
  if (!abstained && audited) {
    return (
      <div style={S.answerBlock}>
        <p style={S.answerLabel}>Grounded answer</p>
        <WriterLine runtime={runtime} data={data} />
        <p style={S.answerText}>{answer}</p>
        {citations.length > 0 && (
          <>
            <p style={S.citationsHeading}>Citations</p>
            <ul style={S.citationList} aria-label="Citations">
              {citations.map((c, i) => (
                <CitationRow key={i} c={c} />
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // State 4: answered, not audited (extractive fallback or watsonx unavailable)
  return (
    <div style={S.unauditedBlock}>
      <p style={S.unauditedLabel}>Answer - not audited</p>
      <WriterLine runtime={runtime} data={data} />
      <p style={S.unauditedNotice}>
        {reason ?? 'This answer was not verified by an audit model.'}
      </p>
      <p style={S.answerText}>{answer}</p>
      {citations.length > 0 && (
        <>
          <p style={S.citationsHeading}>Citations</p>
          <ul style={S.citationList} aria-label="Citations">
            {citations.map((c, i) => (
              <CitationRow key={i} c={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AskPanel: the main exported component
// ---------------------------------------------------------------------------

export function AskPanel() {
  const uid = useId();
  const textareaId = `${uid}-question`;
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase()}/api/status`)
      .then((res) => {
        if (!res.ok) throw new Error(`/api/status returned HTTP ${res.status}`);
        return res.json() as Promise<{ runtime?: RuntimeInfo }>;
      })
      .then((data) => {
        if (cancelled || !data.runtime) return;
        setRuntime(data.runtime);
      })
      .catch(() => {
        // Leave null. The banner stays absent rather than inventing a writer.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setResponse(null);
    setFetchError(null);
    try {
      const res = await fetch(`${apiBase()}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await res.json()) as AskResponse;
      setResponse(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(question);
  }

  function handleSuggested(q: string) {
    setQuestion(q);
    void submit(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Enter (not Shift+Enter, which inserts a newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(question);
    }
  }

  const disabled = loading || !question.trim();

  return (
    <div style={S.panel} aria-label="Regulatory Q&A">
      <p style={S.heading}>Ask a regulatory question</p>
      <p style={S.hint}>
        Questions are answered from the ingested corpus snapshot. The product
        abstains when the corpus cannot support an answer.
      </p>

      {/*
        Shown before any request exists, so it can only report what this
        deployment is CONFIGURED for. generation_backend and guardian_audit
        come from credential presence, which is not a health check, so the
        kicker says configured and the answer below carries what actually
        ran. Embedding is read from the corpus and is a fact either way.
      */}
      {runtime && (
        <div style={S.writerBanner} aria-label="Who is answering">
          <p style={S.writerKicker}>Who is answering, as configured</p>
          <p style={{ margin: 0 }}>
            Writer: {runtime.generation_backend}. Guardian:{' '}
            {runtime.guardian_audit}. Embedding: {runtime.embedding_backend}.
          </p>
          <p style={{ ...S.hint, margin: '0.35rem 0 0' }}>
            Writer and Guardian above are read from credential presence, not
            from model health. Each answer states what actually produced it.
          </p>
          {runtime.note && (
            <p style={{ ...S.hint, margin: '0.35rem 0 0' }}>{runtime.note}</p>
          )}
        </div>
      )}

      <p style={S.suggestedLabel}>Try a question:</p>
      <ul style={S.suggestedList} aria-label="Suggested questions">
        {SUGGESTED.map((q) => (
          <li key={q}>
            <button
              type="button"
              style={S.suggestedBtn}
              onClick={() => handleSuggested(q)}
              disabled={loading}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} aria-label="Ask a regulatory question">
        <div style={S.inputRow}>
          <label htmlFor={textareaId} className="sr-only">
            Question
          </label>
          <textarea
            id={textareaId}
            style={S.textarea}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a question and press Enter or Submit"
            aria-label="Regulatory question"
            rows={2}
          />
          <button
            type="submit"
            style={{
              ...S.submitBtn,
              ...(disabled ? S.submitBtnDisabled : {}),
            }}
            disabled={disabled}
            aria-label="Submit question"
          >
            Submit
          </button>
        </div>
      </form>

      {/* aria-live region: screen readers announce changes without focus move */}
      <div
        ref={responseRef}
        aria-live="polite"
        aria-atomic="true"
        style={S.responseRegion}
      >
        {loading && (
          <p style={S.loadingText}>Querying corpus...</p>
        )}

        {fetchError && !loading && (
          <div style={S.abstainBlock}>
            <p style={S.abstainLabel}>Request failed</p>
            <p style={S.abstainReason}>{fetchError}</p>
          </div>
        )}

        {response && !loading && (
          <ResponseRegion data={response} runtime={runtime} />
        )}
      </div>
    </div>
  );
}
