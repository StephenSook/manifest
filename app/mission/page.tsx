'use client';

// app/mission/page.tsx
// Mission setup form (task 2.1).
// Captures all ten MissionInput fields, validates on submit, persists to
// IndexedDB via lib/store.ts. Nothing is transmitted server-side.
//
// Client component: needs useState, form handlers, and IndexedDB access.
// React Flow and vis-timeline mount in later tasks (1.14, 2.2, 2.3) as
// separate client components imported here.
//
// Task 2.9: DeadlineBanner is mounted at the top and reflects the last
// saved mission. It renders nothing when no mission has been saved yet.

import { useState, useEffect, useId } from 'react';
import type { MissionInput, Pathway } from '@/engine/types';
import { saveMission, loadMission, clearMission } from '@/lib/store';
import { DeadlineBanner } from '@/components/deadline-banner/DeadlineBanner';
import { DependencyGraph } from '@/components/graph/DependencyGraph';
import { DeorbitPanel } from '@/components/deorbit/DeorbitPanel';
import { AskPanel } from '@/components/abstain/AskPanel';

// ---------------------------------------------------------------------------
// Styles: reuse globals.css tokens exactly. No new colors introduced.
// ---------------------------------------------------------------------------

const S = {
  page: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '1.5rem 1.25rem',
  } satisfies React.CSSProperties,

  pageTitle: {
    fontSize: '15px',
    fontWeight: 600,
    margin: '0 0 1.25rem',
    color: 'var(--color-fg)',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid var(--color-border)',
  } satisfies React.CSSProperties,

  section: {
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--color-surface)',
    marginBottom: '1rem',
  } satisfies React.CSSProperties,

  sectionHeading: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-muted)',
    margin: '0 0 1rem',
  } satisfies React.CSSProperties,

  fieldGroup: {
    marginBottom: '1.1rem',
  } satisfies React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-fg)',
    marginBottom: '0.25rem',
  } satisfies React.CSSProperties,

  hint: {
    fontSize: '11px',
    color: 'var(--color-muted)',
    marginBottom: '0.35rem',
    lineHeight: '1.5',
  } satisfies React.CSSProperties,

  input: {
    display: 'block',
    width: '100%',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    padding: '0.35rem 0.5rem',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  } satisfies React.CSSProperties,

  inputError: {
    border: '1px solid var(--color-violated)',
  } satisfies React.CSSProperties,

  errorMsg: {
    fontSize: '11px',
    color: 'var(--color-violated)',
    marginTop: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  } satisfies React.CSSProperties,

  // Pathway radio card
  radioCard: {
    display: 'grid',
    gridTemplateColumns: '1.1rem 1fr',
    gap: '0 0.5rem',
    alignItems: 'start',
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    backgroundColor: 'var(--color-bg)',
  } satisfies React.CSSProperties,

  radioCardSelected: {
    borderColor: 'var(--color-accent)',
  } satisfies React.CSSProperties,

  radioCardLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-fg)',
    marginBottom: '0.15rem',
  } satisfies React.CSSProperties,

  radioCardDesc: {
    fontSize: '11px',
    color: 'var(--color-muted)',
    lineHeight: '1.5',
  } satisfies React.CSSProperties,

  checkbox: {
    display: 'grid',
    gridTemplateColumns: '1.1rem 1fr',
    gap: '0 0.5rem',
    alignItems: 'start',
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  checkboxLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-fg)',
    marginBottom: '0.15rem',
  } satisfies React.CSSProperties,

  submitRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    marginTop: '1.25rem',
  } satisfies React.CSSProperties,

  submitBtn: {
    padding: '0.45rem 1.1rem',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'inherit',
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-fg)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  clearBtn: {
    padding: '0.45rem 0.8rem',
    fontSize: '12px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--color-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    cursor: 'pointer',
  } satisfies React.CSSProperties,

  savedBadge: {
    fontSize: '11px',
    color: 'var(--color-ok)',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Form state shape
// Dates are strings (ISO date inputs); numbers are strings until parsed.
// ---------------------------------------------------------------------------

interface FormState {
  pathway: Pathway;
  launchDate: string;
  deliveryDate: string;
  integrationDate: string;        // '' means null
  lvDeterminationUnknown: boolean; // true = null in MissionInput
  lvDeterminationDate: string;    // only used when lvDeterminationUnknown=false
  frequencyMHz: string;
  imagingEarth: boolean;
  apogeeKm: string;
  perigeeKm: string;
  ballisticCoefficient: string;
}

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FORM: FormState = {
  pathway: 'part-97-amateur',
  launchDate: '',
  deliveryDate: '',
  integrationDate: '',
  lvDeterminationUnknown: false,
  lvDeterminationDate: '',
  frequencyMHz: '',
  imagingEarth: false,
  apogeeKm: '',
  perigeeKm: '',
  ballisticCoefficient: '180',   // 3U CubeSat typical: ~4kg, ~0.03m^2, Cd~2.2
};

// ---------------------------------------------------------------------------
// Validation: runs only on submit
// ---------------------------------------------------------------------------

function validateForm(f: FormState): FieldErrors {
  const errs: FieldErrors = {};

  if (!f.launchDate) {
    errs.launchDate = 'Required.';
  }
  if (!f.deliveryDate) {
    errs.deliveryDate = 'Required.';
  }
  if (f.launchDate && f.deliveryDate && f.deliveryDate >= f.launchDate) {
    errs.deliveryDate = 'Delivery must be before launch.';
  }
  if (
    f.integrationDate &&
    f.deliveryDate &&
    f.integrationDate >= f.deliveryDate
  ) {
    errs.integrationDate = 'Integration start must be before delivery.';
  }
  if (!f.lvDeterminationUnknown && !f.lvDeterminationDate) {
    errs.lvDeterminationDate = 'Enter the date or select "Not yet determined".';
  }

  const freq = parseFloat(f.frequencyMHz);
  if (!f.frequencyMHz || isNaN(freq) || freq <= 0) {
    errs.frequencyMHz = 'Enter a positive frequency in MHz.';
  }

  const apogee = parseFloat(f.apogeeKm);
  if (!f.apogeeKm || isNaN(apogee) || apogee <= 0) {
    errs.apogeeKm = 'Enter apogee altitude in km.';
  }

  const perigee = parseFloat(f.perigeeKm);
  if (!f.perigeeKm || isNaN(perigee) || perigee <= 0) {
    errs.perigeeKm = 'Enter perigee altitude in km.';
  }

  if (f.apogeeKm && f.perigeeKm && !isNaN(apogee) && !isNaN(perigee)) {
    if (perigee > apogee) {
      errs.perigeeKm = 'Perigee cannot exceed apogee.';
    }
  }

  const bc = parseFloat(f.ballisticCoefficient);
  if (!f.ballisticCoefficient || isNaN(bc) || bc <= 0) {
    errs.ballisticCoefficient = 'Enter a positive value in kg/m\u00b2.';
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Form to MissionInput
// ---------------------------------------------------------------------------

function toMissionInput(f: FormState): MissionInput {
  return {
    pathway: f.pathway,
    launchDate: f.launchDate,
    deliveryDate: f.deliveryDate,
    integrationDate: f.integrationDate || null,
    lvDeterminationDate: f.lvDeterminationUnknown ? null : f.lvDeterminationDate,
    frequencyMHz: parseFloat(f.frequencyMHz),
    imagingEarth: f.imagingEarth,
    apogeeKm: parseFloat(f.apogeeKm),
    perigeeKm: parseFloat(f.perigeeKm),
    ballisticCoefficient: parseFloat(f.ballisticCoefficient),
  };
}

// ---------------------------------------------------------------------------
// MissionInput to form state (for loading from IndexedDB)
// ---------------------------------------------------------------------------

function fromMissionInput(m: MissionInput): FormState {
  return {
    pathway: m.pathway,
    launchDate: m.launchDate,
    deliveryDate: m.deliveryDate,
    integrationDate: m.integrationDate ?? '',
    lvDeterminationUnknown: m.lvDeterminationDate === null,
    lvDeterminationDate: m.lvDeterminationDate ?? '',
    frequencyMHz: String(m.frequencyMHz),
    imagingEarth: m.imagingEarth,
    apogeeKm: String(m.apogeeKm),
    perigeeKm: String(m.perigeeKm),
    ballisticCoefficient: String(m.ballisticCoefficient),
  };
}

// ---------------------------------------------------------------------------
// Inline error element
// ---------------------------------------------------------------------------

function FieldError({ id, msg }: { id: string; msg: string }) {
  return (
    <p id={id} role="alert" style={S.errorMsg}>
      <span aria-hidden="true">!</span>
      {msg}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Pathway options
// ---------------------------------------------------------------------------

const PATHWAY_OPTIONS: { value: Pathway; label: string; desc: string }[] = [
  {
    value: 'part-97-amateur',
    label: 'Amateur radio (Part 97)',
    desc:
      'For educational and experimental missions using amateur frequency bands. ' +
      'Requires IARU coordination before the FCC application can proceed. ' +
      'The most common pathway for university CubeSats.',
  },
  {
    value: 'part-5-experimental',
    label: 'Experimental radio (Part 5)',
    desc:
      'For missions using frequencies outside amateur allocations, or that need ' +
      'commercial-style control. No IARU coordination step, but the FCC ' +
      'application is more complex.',
  },
  {
    value: 'part-25',
    label: 'Commercial satellite (Part 25)',
    desc:
      'For missions operating as commercial satellites. This pathway carries the ' +
      'most extensive licensing obligations and is rarely used by university teams ' +
      'without legal counsel.',
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MissionPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [savedOk, setSavedOk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // savedMission tracks the last successfully saved MissionInput.
  // The banner reflects this, not the in-progress draft in `form`.
  const [savedMission, setSavedMission] = useState<MissionInput | null>(null);
  // today is injected from the client on mount so SSR and client agree,
  // and so task 3.9 tests can override it without patching the component.
  const [today, setToday] = useState<string>('');

  // Field ID prefix for aria-describedby linkage
  const uid = useId();
  const fid = (field: string) => `${uid}-${field}`;
  const errId = (field: string) => `${uid}-err-${field}`;

  // Load any saved mission from IndexedDB on mount. Also capture today.
  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0]);
    loadMission().then((saved) => {
      if (saved) {
        setForm(fromMissionInput(saved));
        setSavedMission(saved);
      }
      setLoaded(true);
    });
  }, []);

  function handleField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear the error for this field as soon as the user changes it
    if (errors[field]) {
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
    setSavedOk(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Move focus to the first field with an error
      const firstErrField = Object.keys(errs)[0];
      document.getElementById(fid(firstErrField))?.focus();
      return;
    }
    const mission = toMissionInput(form);
    await saveMission(mission);
    setSavedMission(mission);
    setErrors({});
    setSavedOk(true);
  }

  async function handleClear() {
    await clearMission();
    setForm(DEFAULT_FORM);
    setSavedMission(null);
    setErrors({});
    setSavedOk(false);
  }

  if (!loaded) {
    return (
      <div style={S.page}>
        <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <h1 style={S.pageTitle}>Mission setup</h1>

      {/* Banner: visible only when a mission is saved and today is known.
          today is set client-side on mount to avoid SSR/hydration mismatch. */}
      {savedMission && today && (
        <DeadlineBanner
          mission={savedMission}
          today={today}
          projectStart={today}
        />
      )}

      {/* Graph: visible only when a mission is saved and today is known.
          Renders nothing when no mission has been saved. */}
      {savedMission && today && (
        <div style={{ marginBottom: '1rem' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              margin: '0 0 0.5rem',
            }}
          >
            Dependency graph
          </p>
          <DependencyGraph
            mission={savedMission}
            today={today}
            projectStart={today}
          />
        </div>
      )}

      {/* Deorbit compliance panel: visible only when a mission is saved. */}
      {savedMission && (
        <div style={{ marginBottom: '1rem' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              margin: '0 0 0.5rem',
            }}
          >
            Deorbit compliance
          </p>
          <DeorbitPanel mission={savedMission} />
        </div>
      )}

      {/* Regulatory Q&A: always visible, no mission required. */}
      <AskPanel />

      <form onSubmit={handleSubmit} noValidate aria-label="Mission setup form">

        {/* ---- Pathway ---- */}
        <section style={S.section} aria-labelledby="section-pathway">
          <p id="section-pathway" style={S.sectionHeading}>Regulatory pathway</p>
          <p style={{ ...S.hint, marginBottom: '0.75rem' }}>
            The pathway determines which licensing milestones appear in the
            dependency graph. Choose based on the frequency band your mission
            will use.
          </p>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }} aria-label="Regulatory pathway">
            {PATHWAY_OPTIONS.map(({ value, label, desc }) => {
              const checked = form.pathway === value;
              return (
                <label
                  key={value}
                  style={{
                    ...S.radioCard,
                    ...(checked ? S.radioCardSelected : {}),
                  }}
                >
                  <input
                    type="radio"
                    name="pathway"
                    value={value}
                    checked={checked}
                    onChange={() => handleField('pathway', value)}
                    style={{ marginTop: '2px', accentColor: 'var(--color-accent)' }}
                  />
                  <div>
                    <p style={S.radioCardLabel}>{label}</p>
                    <p style={S.radioCardDesc}>{desc}</p>
                  </div>
                </label>
              );
            })}
          </fieldset>
        </section>

        {/* ---- Dates ---- */}
        <section style={S.section} aria-labelledby="section-dates">
          <p id="section-dates" style={S.sectionHeading}>Mission dates</p>

          {/* Launch date */}
          <div style={S.fieldGroup}>
            <label htmlFor={fid('launchDate')} style={S.label}>
              Launch date
            </label>
            <p style={S.hint}>The immovable launch window date.</p>
            <input
              id={fid('launchDate')}
              type="date"
              value={form.launchDate}
              onChange={(e) => handleField('launchDate', e.target.value)}
              aria-describedby={errors.launchDate ? errId('launchDate') : undefined}
              aria-invalid={!!errors.launchDate}
              style={{ ...S.input, ...(errors.launchDate ? S.inputError : {}) }}
            />
            {errors.launchDate && (
              <FieldError id={errId('launchDate')} msg={errors.launchDate} />
            )}
          </div>

          {/* Delivery date */}
          <div style={S.fieldGroup}>
            <label htmlFor={fid('deliveryDate')} style={S.label}>
              Delivery deadline
            </label>
            <p style={S.hint}>
              The hard terminal deadline for delivery to the launch provider.
              All licensing milestones must complete before this date.
            </p>
            <input
              id={fid('deliveryDate')}
              type="date"
              value={form.deliveryDate}
              onChange={(e) => handleField('deliveryDate', e.target.value)}
              aria-describedby={errors.deliveryDate ? errId('deliveryDate') : undefined}
              aria-invalid={!!errors.deliveryDate}
              style={{ ...S.input, ...(errors.deliveryDate ? S.inputError : {}) }}
            />
            {errors.deliveryDate && (
              <FieldError id={errId('deliveryDate')} msg={errors.deliveryDate} />
            )}
          </div>

          {/* Integration date */}
          <div style={S.fieldGroup}>
            <label htmlFor={fid('integrationDate')} style={S.label}>
              Integration start
              <span style={{ fontWeight: 400, color: 'var(--color-muted)', marginLeft: '0.4rem' }}>
                (optional)
              </span>
            </label>
            <p style={S.hint}>
              When integration with the launch vehicle begins. Leave blank if
              not yet scheduled.
            </p>
            <input
              id={fid('integrationDate')}
              type="date"
              value={form.integrationDate}
              onChange={(e) => handleField('integrationDate', e.target.value)}
              aria-describedby={errors.integrationDate ? errId('integrationDate') : undefined}
              aria-invalid={!!errors.integrationDate}
              style={{ ...S.input, ...(errors.integrationDate ? S.inputError : {}) }}
            />
            {errors.integrationDate && (
              <FieldError id={errId('integrationDate')} msg={errors.integrationDate} />
            )}
          </div>

          {/* LV determination date */}
          <div style={S.fieldGroup}>
            <label htmlFor={fid('lvDeterminationDate')} style={S.label}>
              Launch-vehicle determination date
            </label>
            <p style={S.hint}>
              The date the launch vehicle was formally identified. This starts
              a time-sensitive dual clock for the amateur-radio pathway: both a
              fixed-window deadline and a pre-launch deadline run from this
              date, and the binding one is whichever expires first. If this
              date is not yet set, no clock runs.
            </p>
            <label style={{ ...S.checkbox, marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.lvDeterminationUnknown}
                onChange={(e) =>
                  handleField('lvDeterminationUnknown', e.target.checked)
                }
                style={{ marginTop: '2px', accentColor: 'var(--color-accent)' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Not yet determined
              </span>
            </label>
            {!form.lvDeterminationUnknown && (
              <>
                <input
                  id={fid('lvDeterminationDate')}
                  type="date"
                  value={form.lvDeterminationDate}
                  onChange={(e) =>
                    handleField('lvDeterminationDate', e.target.value)
                  }
                  aria-describedby={
                    errors.lvDeterminationDate
                      ? errId('lvDeterminationDate')
                      : undefined
                  }
                  aria-invalid={!!errors.lvDeterminationDate}
                  style={{
                    ...S.input,
                    ...(errors.lvDeterminationDate ? S.inputError : {}),
                  }}
                />
                {errors.lvDeterminationDate && (
                  <FieldError
                    id={errId('lvDeterminationDate')}
                    msg={errors.lvDeterminationDate}
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* ---- Radio ---- */}
        <section style={S.section} aria-labelledby="section-radio">
          <p id="section-radio" style={S.sectionHeading}>Radio</p>

          <div style={S.fieldGroup}>
            <label htmlFor={fid('frequencyMHz')} style={S.label}>
              Primary downlink frequency (MHz)
            </label>
            <p style={S.hint}>
              The frequency your spacecraft will use to transmit to ground.
              This determines which coordination and approval bodies are
              involved.
            </p>
            <input
              id={fid('frequencyMHz')}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 437.525"
              value={form.frequencyMHz}
              onChange={(e) => handleField('frequencyMHz', e.target.value)}
              aria-describedby={errors.frequencyMHz ? errId('frequencyMHz') : undefined}
              aria-invalid={!!errors.frequencyMHz}
              style={{ ...S.input, ...(errors.frequencyMHz ? S.inputError : {}) }}
            />
            {errors.frequencyMHz && (
              <FieldError id={errId('frequencyMHz')} msg={errors.frequencyMHz} />
            )}
          </div>
        </section>

        {/* ---- Earth imaging ---- */}
        <section style={S.section} aria-labelledby="section-imaging">
          <p id="section-imaging" style={S.sectionHeading}>Earth observation</p>

          <div style={S.fieldGroup}>
            <label style={S.checkbox}>
              <input
                id={fid('imagingEarth')}
                type="checkbox"
                checked={form.imagingEarth}
                onChange={(e) => handleField('imagingEarth', e.target.checked)}
                style={{ marginTop: '2px', accentColor: 'var(--color-accent)' }}
              />
              <div>
                <p style={S.checkboxLabel}>Mission images the Earth</p>
                <p style={S.radioCardDesc}>
                  Enabling this adds a remote-sensing license application to
                  the dependency graph. That license must be obtained before
                  the FCC grant can proceed, which extends the critical path.
                  Leave unchecked if the mission has no Earth-imaging payload.
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* ---- Orbit ---- */}
        <section style={S.section} aria-labelledby="section-orbit">
          <p id="section-orbit" style={S.sectionHeading}>Orbit</p>

          <div style={S.fieldGroup}>
            <label htmlFor={fid('apogeeKm')} style={S.label}>
              Apogee altitude (km)
            </label>
            <p style={S.hint}>
              Highest point in the orbit above the Earth's surface.
            </p>
            <input
              id={fid('apogeeKm')}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 550"
              value={form.apogeeKm}
              onChange={(e) => handleField('apogeeKm', e.target.value)}
              aria-describedby={errors.apogeeKm ? errId('apogeeKm') : undefined}
              aria-invalid={!!errors.apogeeKm}
              style={{ ...S.input, ...(errors.apogeeKm ? S.inputError : {}) }}
            />
            {errors.apogeeKm && (
              <FieldError id={errId('apogeeKm')} msg={errors.apogeeKm} />
            )}
          </div>

          <div style={S.fieldGroup}>
            <label htmlFor={fid('perigeeKm')} style={S.label}>
              Perigee altitude (km)
            </label>
            <p style={S.hint}>
              Lowest point in the orbit above the Earth's surface. For a
              circular orbit, apogee and perigee are the same value. The
              perigee altitude drives the atmospheric drag estimate and the
              deorbit compliance verdict.
            </p>
            <input
              id={fid('perigeeKm')}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 550"
              value={form.perigeeKm}
              onChange={(e) => handleField('perigeeKm', e.target.value)}
              aria-describedby={errors.perigeeKm ? errId('perigeeKm') : undefined}
              aria-invalid={!!errors.perigeeKm}
              style={{ ...S.input, ...(errors.perigeeKm ? S.inputError : {}) }}
            />
            {errors.perigeeKm && (
              <FieldError id={errId('perigeeKm')} msg={errors.perigeeKm} />
            )}
          </div>

          <div style={S.fieldGroup}>
            <label htmlFor={fid('ballisticCoefficient')} style={S.label}>
              Ballistic coefficient (kg/m&sup2;)
            </label>
            <p style={S.hint}>
              Mass divided by (drag coefficient times cross-sectional area).
              Used to estimate how quickly atmospheric drag will deorbit the
              spacecraft. A typical 3U CubeSat is approximately 180 kg/m&sup2;
              (mass around 4 kg, frontal area around 0.03 m&sup2;, drag
              coefficient around 2.2). Use the default if you do not have a
              detailed aerodynamic model.
            </p>
            <input
              id={fid('ballisticCoefficient')}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="180"
              value={form.ballisticCoefficient}
              onChange={(e) =>
                handleField('ballisticCoefficient', e.target.value)
              }
              aria-describedby={
                errors.ballisticCoefficient
                  ? errId('ballisticCoefficient')
                  : undefined
              }
              aria-invalid={!!errors.ballisticCoefficient}
              style={{
                ...S.input,
                ...(errors.ballisticCoefficient ? S.inputError : {}),
              }}
            />
            {errors.ballisticCoefficient && (
              <FieldError
                id={errId('ballisticCoefficient')}
                msg={errors.ballisticCoefficient}
              />
            )}
          </div>
        </section>

        {/* ---- Submit ---- */}
        <div style={S.submitRow}>
          <button type="submit" style={S.submitBtn}>
            Save mission
          </button>
          <button type="button" onClick={handleClear} style={S.clearBtn}>
            Clear
          </button>
          {savedOk && (
            <span style={S.savedBadge} role="status">
              <span aria-hidden="true">&#10003;</span>
              Saved
            </span>
          )}
        </div>

      </form>
    </div>
  );
}
