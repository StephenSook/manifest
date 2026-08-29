// app/layout.tsx
// Root layout for Manifest.
// Design intent: dense regulatory instrument. No gradients, no glassmorphism,
// no landing-page hero. Belongs next to a NASA standard.
//
// Font choice: system monospace for dates, CFR section numbers, and figures
// (see globals.css). Proportional sans-serif is available via .font-sans for
// labels that carry prose weight.
//
// Status colors (--color-violated, --color-at-risk, --color-ok) are NEVER
// used decoratively here. They appear only in status-bearing components where
// they are always paired with a text label.
//
// --color-accent (purple) is reserved for focus states and active nav only.

import type { Metadata } from 'next';
import './globals.css';
import { MobileShell } from '../mobile/MobileShell';

export const metadata: Metadata = {
  title: 'Manifest',
  description:
    'Regulatory critical-path planner for US university CubeSat missions.',
  // PWA metadata lives in app/manifest.ts (task 2.10). Not wired yet.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip-to-content link: keyboard and screen-reader navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1 focus:text-sm focus:rounded"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)', outlineColor: 'var(--color-accent)' }}
        >
          Skip to main content
        </a>

        {/* Site header: product name + primary nav */}
        <header
          style={{
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '0 1.25rem',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Wordmark */}
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-fg)',
              }}
            >
              Manifest
            </span>

            {/* Primary nav */}
            <nav aria-label="Primary navigation">
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '12px',
                }}
              >
                <li>
                  <a
                    href="/mission"
                    style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
                  >
                    Mission
                  </a>
                </li>
                <li>
                  <a
                    href="/judge"
                    style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
                  >
                    Judge view
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content">
          {children}
        </main>

        {/*
          Persistent scope notice, on every page including the native shell.

          A licensing planner that reads as authoritative is dangerous in a way
          a weather app is not: a user who treats a computed date as the legal
          deadline can miss a real one. The disclaimer is deliberately not a
          bare "not legal advice" line, which tells a reader nothing about
          whether to trust the number in front of them. It names the mechanism
          instead, because the mechanism is the reason the number is worth
          anything: every regulatory statement is pinned to a section-level
          citation in a dated snapshot or the product abstains, and every
          duration is labelled DOCUMENTED with a source or ESTIMATED with a
          basis (hard rules 1 and 3).
        */}
        <footer
          role="contentinfo"
          style={{
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            marginTop: '2rem',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '0.7rem 1.25rem',
              fontSize: '11px',
              lineHeight: 1.5,
              color: 'var(--color-muted)',
            }}
          >
            <strong style={{ color: 'var(--color-fg)', fontWeight: 600 }}>
              Planning aid, not legal authority.
            </strong>{' '}
            Manifest computes a critical path from a dated corpus snapshot. Every
            regulatory statement carries a section-level citation or the product
            abstains, and every lead time is labelled DOCUMENTED with a source or
            ESTIMATED with a basis. Verify against the cited text before you file,
            and confirm current requirements with the issuing agency.
          </div>
        </footer>

        {/* Native-only shell (tasks 2.13, 2.14): renders nothing on the web */}
        <MobileShell />
      </body>
    </html>
  );
}
