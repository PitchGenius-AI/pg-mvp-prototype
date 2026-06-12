import { useEffect, useMemo, useRef, useState } from 'react';
import { useFitWindowToContent } from './Overlay';
import {
  copilotData,
  inPeriod,
  type CopilotWorkbenchRow,
  type WorkbenchPeriod,
} from '../api/copilot-data';
import { READINESS_DOT, READINESS_LABEL } from './readiness';

// The launch entry screen (M33/PG-291): the rep picks the opportunity this call is
// about, or proceeds without one (cold start → creates a new lead on save, PG-294).
// Functional realization of the M20 picker mock (PG-240), fed by the real backend
// via CopilotDataSource (PG-290). When the desktop is launched FROM a deal
// (pitchgenius://session/{id}) this screen is skipped and the call binds directly
// (App.tsx); this screen is for the cold launch path.

const PERIODS: { key: WorkbenchPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
];

interface OpportunityPickerProps {
  inTauri: boolean;
  /** Bind the call to an existing opportunity. */
  onBind: (opportunityId: string) => void;
  /** Start cold — no opportunity; a new lead is created on save. */
  onColdStart: () => void;
}

export function OpportunityPicker({ inTauri, onBind, onColdStart }: OpportunityPickerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  useFitWindowToContent(shellRef, inTauri);

  const [rows, setRows] = useState<CopilotWorkbenchRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<WorkbenchPeriod>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    copilotData.listOpportunities('all').then(
      (r) => !cancelled && setRows(r),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!inPeriod(row.lastActiveAt, period)) return false;
      if (!q) return true;
      const hay = [
        row.buyer?.firstName,
        row.buyer?.lastName,
        row.buyer?.company,
        row.buyer?.title,
        row.opportunity.opportunityName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, period]);

  return (
    <div className="overlay-shell pick-shell" data-tauri-drag-region ref={shellRef}>
      <div className="rail" data-tauri-drag-region>
        <span className="rail-brand" data-tauri-drag-region>
          <span className="rail-dot" data-tauri-drag-region />
          PG.AI PILOT
        </span>
        <span className="ob-step-hint" data-tauri-drag-region>
          Choose a deal
        </span>
      </div>

      <div className="ob-body">
        <h2 className="ob-title">Who&rsquo;s on the call?</h2>
        <p className="ob-sub">Pick the opportunity this call is about, or start without one.</p>

        <input
          className="ob-input"
          placeholder="Search buyer, company, role…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        <div className="pick-periods">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`pick-period${period === p.key ? ' pick-period--on' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {failed ? (
          <p className="ob-empty">Couldn&rsquo;t load your opportunities — check your connection.</p>
        ) : rows === null ? (
          <p className="ob-empty">Loading your opportunities…</p>
        ) : filtered.length === 0 ? (
          <p className="ob-empty">No opportunities match.</p>
        ) : (
          <div className="pick-list">
            {filtered.map((row) => (
              <PickerRow
                key={row.opportunity.id}
                row={row}
                selected={selectedId === row.opportunity.id}
                onSelect={() => setSelectedId(row.opportunity.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="ob-cta"
          disabled={!selectedId}
          onClick={() => selectedId && onBind(selectedId)}
        >
          Start call
        </button>

        <div className="ob-secondary-row">
          <button type="button" className="ob-link" onClick={onColdStart}>
            Proceed without a deal
          </button>
        </div>
        <p className="pick-coldnote">
          Starting without a deal creates a new lead in your Pitch Genius account when you save.
        </p>
      </div>
    </div>
  );
}

function PickerRow({
  row,
  selected,
  onSelect,
}: {
  row: CopilotWorkbenchRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const buyer = row.buyer;
  const name = buyer
    ? `${buyer.firstName} ${buyer.lastName ?? ''}`.trim()
    : row.opportunity.opportunityName;
  const sub = [buyer?.company, buyer?.title].filter(Boolean).join(' · ');
  const state = row.opportunity.currentReadinessState;

  return (
    <button
      type="button"
      className={`pick-row${selected ? ' pick-row--sel' : ''}`}
      onClick={onSelect}
    >
      <span className="pick-row-main">
        <span className="pick-row-name">{name}</span>
        {sub && <span className="pick-row-sub">{sub}</span>}
      </span>
      <span className="pick-readiness">
        <span
          className="pick-dot"
          style={{ background: state ? READINESS_DOT[state] : 'var(--text-3)' }}
        />
        <span className="pick-readiness-label">{state ? READINESS_LABEL[state] : 'No reading'}</span>
      </span>
    </button>
  );
}
