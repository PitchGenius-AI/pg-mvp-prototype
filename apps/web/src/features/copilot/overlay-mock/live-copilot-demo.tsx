import { Box, Button, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowUpRight,
  IconCheck,
  IconCircleCheck,
  IconHelpCircle,
  IconPhoneOff,
  IconRefreshDot,
  IconScript,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PERIOD,
  filterByPeriod,
  periodCounts,
  workbenchPeriods,
  type WorkbenchPeriod,
} from '../../../lib/period';
import { useWorkbench } from '../../../mock/hooks';
import { READINESS_LABELS } from '../../opportunity-detail/badges';
import {
  CONVERSATION,
  type CopilotPrompt,
  OVERLAY,
  PROCESSING_STEPS,
  READINESS_DOT,
  TECHNIQUE_LABEL,
} from './mock-data';
import { OpportunityPicker, type PickerRowData } from './opportunity-picker';
import {
  CollapsedRow,
  DealStrip,
  OverlayHeader,
  OverlayWindow,
  PromptCard,
} from './overlay-window';

// The interactive Live Co-pilot demo (M20). Unlike the static gallery below it,
// this is a working walkthrough of the in-call experience: the rep searches the
// real seeded opportunities, picks who the call is with, starts the call, and
// watches the co-pilot coach against a scripted conversation — then ends the
// call and is handed back to the real opportunity in the web app.
//
// It's still a *demo* of the desktop app: the real overlay floats over the OS,
// transcribes live audio, and runs real AI. Here the conversation and coaching
// are scripted (see CONVERSATION in mock-data.ts) and the "window" floats over
// a mocked call stage rather than the desktop — but the flow and the
// interactions (drag, collapse, end-call, handoff) are real.

type Phase = 'picker' | 'live' | 'processing' | 'ended';

// The Co-pilot remembers the rep's last recency scope across launches (default
// Today). Client-local preference, mirroring the Workbench view toggle.
const PERIOD_STORAGE_KEY = 'pg.copilot.period';

function readStoredCopilotPeriod(): WorkbenchPeriod {
  if (typeof window === 'undefined') return DEFAULT_PERIOD;
  try {
    const stored = window.localStorage.getItem(PERIOD_STORAGE_KEY);
    return workbenchPeriods.includes(stored as WorkbenchPeriod)
      ? (stored as WorkbenchPeriod)
      : DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
}

// mm:ss for the call timer.
function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LiveCopilotDemo() {
  const { data: rows = [], isLoading } = useWorkbench();

  const [query, setQuery] = useState('');
  const [period, setPeriodState] = useState<WorkbenchPeriod>(readStoredCopilotPeriod);
  const setPeriod = useCallback((next: WorkbenchPeriod) => {
    setPeriodState(next);
    try {
      window.localStorage.setItem(PERIOD_STORAGE_KEY, next);
    } catch {
      // Best-effort persistence — the in-memory choice still holds this session.
    }
  }, []);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('picker');
  const [collapsed, setCollapsed] = useState(false);
  // Seconds since the call started — drives the timer and the conversation.
  const [elapsed, setElapsed] = useState(0);
  // Index of the active post-call processing step.
  const [processingStep, setProcessingStep] = useState(0);

  // --- The pickable opportunities (real seed data) -------------------------

  // The open, callable deals — the universe the picker scopes by recency.
  const openRows = useMemo(
    () => rows.filter((r) => r.buyer && r.opportunity.closedStatus === 'open'),
    [rows],
  );
  const counts = useMemo(() => periodCounts(openRows, (r) => r.lastActiveAt), [openRows]);
  const scopedRows = useMemo(
    () => filterByPeriod(openRows, (r) => r.lastActiveAt, period),
    [openRows, period],
  );
  // Don't strand the rep on an empty picker: when the chosen scope (typically
  // Today) has no open deals but others exist, fall back to showing them all.
  const usingFallback = scopedRows.length === 0 && openRows.length > 0 && period !== 'all';
  const effectiveRows = usingFallback ? openRows : scopedRows;

  const pickerRows = useMemo<PickerRowData[]>(() => {
    return effectiveRows.map((r) => {
      const buyer = r.buyer!;
      const state = r.opportunity.currentReadinessState;
      return {
        id: r.opportunity.id,
        buyerName: [buyer.firstName, buyer.lastName].filter(Boolean).join(' '),
        company: buyer.company,
        role: buyer.title ?? '',
        readinessLabel: state ? READINESS_LABELS[state] : 'No activity yet',
        readinessDot: state ? READINESS_DOT[state] : OVERLAY.textMuted,
      };
    });
  }, [effectiveRows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickerRows;
    return pickerRows.filter((r) =>
      `${r.buyerName} ${r.company} ${r.role}`.toLowerCase().includes(q),
    );
  }, [pickerRows, query]);

  const selectedRow = pickerRows.find((r) => r.id === selectedId) ?? null;
  const selectedWb = rows.find((r) => r.opportunity.id === selectedId) ?? null;
  const firstName = selectedWb?.buyer?.firstName ?? 'there';
  const fill = useCallback((text: string) => text.replaceAll('{first}', firstName), [firstName]);

  // --- Conversation playback (live phase) ----------------------------------

  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const revealed = useMemo(() => CONVERSATION.filter((b) => b.at <= elapsed), [elapsed]);
  const transcript = useMemo(() => revealed.filter((b) => b.line), [revealed]);
  const currentPrompt: CopilotPrompt | undefined = useMemo(() => {
    for (let i = revealed.length - 1; i >= 0; i--) {
      const p = revealed[i]?.prompt;
      if (p) return p;
    }
    return CONVERSATION[0]?.prompt;
  }, [revealed]);
  const promptCount = revealed.filter((b) => b.prompt).length || 1;

  // --- Post-call processing timeline ---------------------------------------

  useEffect(() => {
    if (phase !== 'processing') return;
    setProcessingStep(0);
    const timers = [
      setTimeout(() => setProcessingStep(1), 1300),
      setTimeout(() => setProcessingStep(2), 2700),
      setTimeout(() => setPhase('ended'), 4100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // --- Phase transitions ---------------------------------------------------

  const startCall = useCallback(() => {
    setElapsed(0);
    setCollapsed(false);
    setPhase('live');
  }, []);

  const endCall = useCallback(() => {
    setCollapsed(false);
    setPhase('processing');
  }, []);

  const restart = useCallback(() => {
    setElapsed(0);
    setProcessingStep(0);
    setPhase('picker');
  }, []);

  // --- Dragging the floating window ----------------------------------------

  const stageRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  // True once a pointer-drag actually moved — lets the pill suppress the
  // expand-click that would otherwise fire at the end of a drag.
  const movedRef = useRef(false);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    const stage = stageRef.current;
    const widget = widgetRef.current;
    if (!d || !stage || !widget) return;
    movedRef.current = true;
    const sRect = stage.getBoundingClientRect();
    const wRect = widget.getBoundingClientRect();
    const maxX = Math.max(0, sRect.width - wRect.width);
    const maxY = Math.max(0, sRect.height - wRect.height);
    const x = Math.min(Math.max(0, d.origX + (e.clientX - d.startX)), maxX);
    const y = Math.min(Math.max(0, d.origY + (e.clientY - d.startY)), maxY);
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      const stage = stageRef.current;
      const widget = widgetRef.current;
      if (!stage || !widget) return;
      const sRect = stage.getBoundingClientRect();
      const wRect = widget.getBoundingClientRect();
      const origX = pos?.x ?? wRect.left - sRect.left;
      const origY = pos?.y ?? wRect.top - sRect.top;
      drag.current = { startX: e.clientX, startY: e.clientY, origX, origY };
      movedRef.current = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [pos, onPointerMove, onPointerUp],
  );

  // Detach listeners if the component unmounts mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  // Place the window top-right on first layout, and keep it in bounds whenever
  // it changes size (picker → overlay → pill).
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const widget = widgetRef.current;
    if (!stage || !widget) return;
    const sRect = stage.getBoundingClientRect();
    const wRect = widget.getBoundingClientRect();
    setPos((prev) => {
      const base = prev ?? {
        x: Math.max(0, sRect.width - wRect.width - 24),
        y: 24,
      };
      const maxX = Math.max(0, sRect.width - wRect.width);
      const maxY = Math.max(0, sRect.height - wRect.height);
      return {
        x: Math.min(Math.max(0, base.x), maxX),
        y: Math.min(Math.max(0, base.y), maxY),
      };
    });
  }, [phase, collapsed]);

  // --- The floating window's current surface -------------------------------

  function renderWidget() {
    if (collapsed && phase === 'live') {
      return (
        <Pill
          count={promptCount}
          onExpand={() => {
            if (movedRef.current) return;
            setCollapsed(false);
          }}
          onDragStart={onDragStart}
        />
      );
    }

    if (phase === 'picker') {
      return (
        <OpportunityPicker
          rows={filteredRows}
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStart={startCall}
          period={period}
          onPeriodChange={setPeriod}
          periodCounts={counts}
          usingFallback={usingFallback}
          onDragStart={onDragStart}
        />
      );
    }

    if (phase === 'live' && selectedRow && selectedWb) {
      return (
        <OverlayWindow>
          <OverlayHeader
            mode="live"
            timer={formatTimer(elapsed)}
            onCollapse={() => setCollapsed(true)}
            onDragStart={onDragStart}
          />
          <DealStrip
            opportunityName={selectedWb.opportunity.opportunityName}
            buyerLine={`${selectedRow.buyerName} · ${selectedRow.company}`}
            readinessLabel={selectedRow.readinessLabel}
            readinessDot={selectedRow.readinessDot}
          />
          <Stack gap={8} p="sm">
            {currentPrompt && (
              <PromptCard
                tone={currentPrompt.tone}
                techniqueMove={currentPrompt.techniqueMove}
                why={fill(currentPrompt.why)}
                say={fill(currentPrompt.say)}
              />
            )}
            <CollapsedRow
              icon={<IconScript size={14} />}
              label="Call script"
              meta={`${TECHNIQUE_LABEL} · 4 sections`}
            />
            <CollapsedRow
              icon={<IconHelpCircle size={14} />}
              label="Still to ask"
              meta="3 questions"
            />
            <Button
              size="xs"
              radius="md"
              color="red"
              variant="light"
              leftSection={<IconPhoneOff size={14} />}
              onClick={endCall}
              mt={2}
            >
              End call
            </Button>
          </Stack>
        </OverlayWindow>
      );
    }

    if (phase === 'processing') {
      return (
        <OverlayWindow>
          <OverlayHeader mode="ended" onDragStart={onDragStart} />
          <Stack gap="sm" p="md">
            <div>
              <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
                Writing this call back to Pitch Genius…
              </Text>
              <Text fz={11} c={OVERLAY.textMuted} truncate>
                {selectedWb?.opportunity.opportunityName}
              </Text>
            </div>
            <Stack gap={7}>
              {PROCESSING_STEPS.map((label, i) => (
                <ProcessStep
                  key={label}
                  label={label}
                  state={i < processingStep ? 'done' : i === processingStep ? 'active' : 'pending'}
                />
              ))}
            </Stack>
          </Stack>
        </OverlayWindow>
      );
    }

    if (phase === 'ended' && selectedId) {
      return (
        <OverlayWindow>
          <OverlayHeader mode="ended" onDragStart={onDragStart} />
          <Stack gap="sm" p="md">
            <Group gap={8} wrap="nowrap">
              <ThemeIcon size={28} radius="xl" variant="light" color="teal">
                <IconCircleCheck size={18} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
                  Saved to the opportunity
                </Text>
                <Text fz={11} c={OVERLAY.textMuted} truncate>
                  {selectedWb?.opportunity.opportunityName}
                </Text>
              </div>
            </Group>

            <Box style={{ background: OVERLAY.panelBg, borderRadius: 10 }} px="sm" py={8}>
              <Stack gap={5}>
                <Text fz={12} c={OVERLAY.textSecondary}>
                  Posted as a video-call activity and re-scored.
                </Text>
                <Text fz={12} c={OVERLAY.textSecondary}>
                  {firstName} moved from problem-aware toward naming the cost — the deal nudged
                  forward.
                </Text>
              </Stack>
            </Box>

            <Group gap="xs">
              <Button
                onClick={() =>
                  navigate({
                    to: '/opportunities/$opportunityId',
                    params: { opportunityId: selectedId },
                  })
                }
                size="xs"
                radius="md"
                variant="white"
                color="dark"
                rightSection={<IconArrowUpRight size={13} />}
              >
                Open in Pitch Genius
              </Button>
              <Button
                size="xs"
                radius="md"
                variant="subtle"
                color="gray"
                leftSection={<IconRefreshDot size={13} />}
                onClick={restart}
              >
                Run again
              </Button>
            </Group>
          </Stack>
        </OverlayWindow>
      );
    }

    return null;
  }

  // --- The stage -----------------------------------------------------------

  if (isLoading) {
    return (
      <Box
        style={{
          background: STAGE_BG,
          borderRadius: 16,
          border: '1px solid var(--mantine-color-dark-4)',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader color="indigo" />
      </Box>
    );
  }

  if (pickerRows.length === 0) {
    return (
      <Box
        style={{
          background: STAGE_BG,
          borderRadius: 16,
          border: '1px solid var(--mantine-color-dark-4)',
          minHeight: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          Add an opportunity in the workbench first — PG.AI PILOT binds a call to one of your deals
          before it starts.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      ref={stageRef}
      style={{
        position: 'relative',
        background: STAGE_BG,
        borderRadius: 16,
        border: '1px solid var(--mantine-color-dark-4)',
        minHeight: 600,
        overflow: 'hidden',
      }}
    >
      {/* The mocked call — its transcript scrolls on the side, the way the rep
          sees their video-call captions. Hidden until the call starts. */}
      {phase !== 'picker' && (
        <TranscriptPanel
          lines={transcript.map((b) => ({
            speaker: b.speaker ?? 'rep',
            text: fill(b.line ?? ''),
            key: b.at,
          }))}
          buyerName={selectedRow?.buyerName ?? 'Buyer'}
        />
      )}

      {phase === 'picker' && (
        <Text
          size="xs"
          c="dimmed"
          style={{ position: 'absolute', left: 24, bottom: 20, maxWidth: 280 }}
        >
          Drag the window by its title bar to move it around — just like the desktop app floating
          over your call.
        </Text>
      )}

      {/* The floating co-pilot window. */}
      <div
        ref={widgetRef}
        style={{
          position: 'absolute',
          left: pos?.x ?? 0,
          top: pos?.y ?? 0,
          width: 'fit-content',
          zIndex: 2,
        }}
      >
        {renderWidget()}
      </div>
    </Box>
  );
}

// The dark call backdrop — kept dark so the floating window reads as elevated
// over a call regardless of the web app's colour scheme.
const STAGE_BG = 'linear-gradient(135deg, #2b2e3d 0%, #1c1d26 55%, #15161d 100%)';

// --- Transcript side panel -------------------------------------------------

interface TranscriptLine {
  speaker: 'rep' | 'buyer';
  text: string;
  key: number;
}

function TranscriptPanel({ lines, buyerName }: { lines: TranscriptLine[]; buyerName: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest line in view as the conversation plays.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <Box
      style={{
        position: 'absolute',
        left: 20,
        top: 20,
        bottom: 20,
        width: 300,
        maxWidth: 'calc(100% - 40px)',
        background: 'rgba(0, 0, 0, 0.28)',
        border: `1px solid ${OVERLAY.border}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Group
        gap={6}
        wrap="nowrap"
        px="sm"
        py={8}
        style={{ borderBottom: `1px solid ${OVERLAY.border}` }}
      >
        <Box
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--mantine-color-red-6)',
          }}
        />
        <Text fz={10} fw={700} tt="uppercase" lts={0.8} c={OVERLAY.textSecondary}>
          Live transcript
        </Text>
      </Group>

      <Box ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {lines.length === 0 ? (
          <Text fz={11} c={OVERLAY.textMuted}>
            Listening…
          </Text>
        ) : (
          <Stack gap={10}>
            {lines.map((line) => {
              const isRep = line.speaker === 'rep';
              return (
                <div key={line.key}>
                  <Text
                    fz={9}
                    fw={700}
                    tt="uppercase"
                    lts={0.6}
                    c={isRep ? 'var(--mantine-color-indigo-4)' : OVERLAY.textMuted}
                    mb={2}
                  >
                    {isRep ? 'You' : buyerName}
                  </Text>
                  <Text fz={12} c={OVERLAY.textSecondary} lh={1.45}>
                    {line.text}
                  </Text>
                </div>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// --- Collapsed pill --------------------------------------------------------

function Pill({
  count,
  onExpand,
  onDragStart,
}: {
  count: number;
  onExpand: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}) {
  return (
    <Box
      onPointerDown={onDragStart}
      onClick={onExpand}
      role="button"
      aria-label="Expand PG.AI PILOT"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: OVERLAY.windowBg,
        border: `1px solid ${OVERLAY.border}`,
        borderRadius: 999,
        padding: '7px 12px',
        boxShadow: '0 12px 28px -8px rgba(0, 0, 0, 0.55)',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <Box
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--mantine-color-red-6)',
        }}
      />
      <Text fz={12} fw={600} c={OVERLAY.textPrimary}>
        PG.AI PILOT
      </Text>
      <Box
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 999,
          background: 'var(--mantine-color-indigo-6)',
        }}
      >
        <Text fz={10} fw={700} c="var(--mantine-color-white)">
          {count}
        </Text>
      </Box>
    </Box>
  );
}

// --- Processing step -------------------------------------------------------

function ProcessStep({ state, label }: { state: 'done' | 'active' | 'pending'; label: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      {state === 'done' && (
        <ThemeIcon size={16} radius="xl" variant="filled" color="teal">
          <IconCheck size={10} />
        </ThemeIcon>
      )}
      {state === 'active' && <Loader size={14} color="indigo" />}
      {state === 'pending' && (
        <Box
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.5px solid ${OVERLAY.border}`,
          }}
        />
      )}
      <Text fz={12} c={state === 'pending' ? OVERLAY.textMuted : OVERLAY.textSecondary}>
        {label}
      </Text>
    </Group>
  );
}
