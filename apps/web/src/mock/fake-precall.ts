import { matchTechnique } from '@pg/shared';
import type {
  DiscProfile,
  DiscType,
  GeneratedScript,
  MatchedTechnique,
  OceanProfile,
  PsychProfile,
  SalesTechnique,
} from '@pg/shared';
import type {
  MockBuyer,
  MockDiagnosis,
  MockOpportunity,
  MockScriptTemplate,
} from './types';

// Heuristic-light stand-in for the real pre-call enrichment chains (M17). From
// the buyer's title + the opportunity context it derives a DISC/OCEAN profile, a
// matched sales technique, and a generated pre-call script. Deterministic per
// opportunity id so re-renders are stable; pass a `variation` to regenerate.
//
// Not as smart as a real enrichment chain, but produces output that reads as
// customized to this specific buyer + deal — good enough for the demo.

export interface GeneratePrecallInput {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  scriptTemplate: MockScriptTemplate | null;
  latestDiagnosis: MockDiagnosis | null;
}

export interface GeneratedPrecall {
  psychProfile: PsychProfile;
  matchedTechnique: MatchedTechnique;
  generatedScript: GeneratedScript;
}

// --- Deterministic PRNG ----------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampScore = (n: number): number => Math.max(8, Math.min(96, Math.round(n)));

// --- DISC / OCEAN derivation ----------------------------------------------

// Personality reads off the buyer's *function* far more than their seniority —
// a "Director of Revenue Operations" is process-minded (C), not dominant. So
// function keywords carry the weight; seniority gives only a light D nudge.
function deriveDisc(buyer: MockBuyer | null, rng: () => number): DiscProfile {
  const title = (buyer?.title ?? '').toLowerCase();
  let d = 45;
  let i = 45;
  let s = 45;
  let c = 45;

  if (/\b(vp|chief|c[eo]o|cro|cfo|head|director|owner|founder|president)\b/.test(title)) {
    d += 8;
  }
  if (/\b(strateg)/.test(title)) {
    d += 12;
    c += 10;
  }
  // "X operations" people are process-first — count them as ops, not their X.
  if (/(revenue|sales|marketing|business)\s+operations|\brev\s?ops\b/.test(title)) {
    c += 25;
    s += 10;
  } else {
    if (/\b(sales|business development|bd)\b/.test(title)) {
      i += 22;
      d += 10;
    }
    if (/\bmarketing\b/.test(title)) {
      i += 18;
    }
    if (/\boperations|\bops\b/.test(title)) {
      c += 20;
      s += 10;
    }
  }
  if (/\b(finance|procurement|accounting|controller)\b/.test(title)) {
    c += 30;
  }
  if (/\b(engineering|technical|data|analyst|product|security|\bit\b)\b/.test(title)) {
    c += 25;
  }
  if (/\b(enablement|success|support|people|hr|talent)\b/.test(title)) {
    s += 22;
  }

  const jitter = () => (rng() - 0.5) * 34;
  const disc = {
    d: clampScore(d + jitter()),
    i: clampScore(i + jitter()),
    s: clampScore(s + jitter()),
    c: clampScore(c + jitter()),
  };
  return { ...disc, primaryType: argmaxDisc(disc) };
}

function argmaxDisc(disc: { d: number; i: number; s: number; c: number }): DiscType {
  const entries: [DiscType, number][] = [
    ['D', disc.d],
    ['I', disc.i],
    ['S', disc.s],
    ['C', disc.c],
  ];
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

function deriveOcean(disc: DiscProfile, rng: () => number): OceanProfile {
  const jitter = (range: number) => (rng() - 0.5) * range;
  return {
    o: clampScore(52 + jitter(40)),
    c: clampScore(disc.c * 0.7 + 26 + jitter(20)),
    e: clampScore(((disc.d + disc.i) / 2) * 0.62 + 26 + jitter(20)),
    a: clampScore(disc.s * 0.6 + 34 - disc.d * 0.16 + jitter(20)),
    n: clampScore(30 + jitter(30)),
  };
}

// --- Technique matching ----------------------------------------------------

const TECHNIQUE_LABELS: Record<SalesTechnique, string> = {
  challenger: 'Challenger',
  spin: 'SPIN',
  nepq: 'NEPQ',
};

const DISC_TYPE_LABELS: Record<DiscType, string> = {
  D: 'Dominance',
  I: 'Influence',
  S: 'Steadiness',
  C: 'Conscientiousness',
};

function techniqueReasoning(disc: DiscProfile, technique: SalesTechnique): string {
  const type = disc.primaryType;
  const typeLabel = DISC_TYPE_LABELS[type];
  switch (technique) {
    case 'challenger':
      return `Primary DISC type is ${type} (${typeLabel}). A decisive, results-driven buyer responds to a strong point of view, not consensus-building — Challenger's teach / tailor / take-control motion fits. Lead with insight and keep the conversation moving.`;
    case 'spin':
      return `Primary DISC type is ${type} (${typeLabel}). A methodical, evidence-driven buyer needs to reason their own way to the value before committing — SPIN's Situation → Problem → Implication → Need-payoff sequence lets them build the case themselves.`;
    case 'nepq':
      return `Primary DISC type is ${type} (${typeLabel}). A relationship-oriented buyer responds to consultative, low-pressure questioning over a hard pitch — NEPQ's neuro-emotional questioning surfaces the problem in the buyer's own words and lowers resistance.`;
  }
}

function psychSummary(disc: DiscProfile, firstName: string): string {
  switch (disc.primaryType) {
    case 'D':
      return `${firstName} is decisive and results-driven. They value directness and a clear business case over relationship-building. Lead with outcomes and ROI, keep the conversation tight, and do not pad it.`;
    case 'I':
      return `${firstName} is sociable and persuasion-oriented. They engage through energy and story, and decide partly on who they trust. Build rapport, use customer narratives, and make the vision vivid.`;
    case 'S':
      return `${firstName} is steady and collaborative. They value a low-risk path and dislike being rushed. Move at their pace, emphasize support and a smooth rollout, and reassure on continuity.`;
    case 'C':
      return `${firstName} is analytical and detail-oriented. They want evidence, methodology, and a structured plan. Bring data and specifics — rushing them or skipping detail will erode trust.`;
  }
}

// --- Script generation -----------------------------------------------------

interface ScriptCtx {
  firstName: string;
  company: string;
  pain: string;
  blocker: string;
  variation: number;
}

type SectionBuilder = (ctx: ScriptCtx) => { heading: string; body: string };

const pick = <T>(arr: T[], variation: number, salt: number): T =>
  arr[(variation + salt) % arr.length] as T;

// Pain + blocker come straight from the opportunity / diagnosis and are often
// full sentences, so they're only ever surfaced as quoted asides — never inlined
// as a noun phrase. `firstName` + `company` are clean nouns, safe to inline.
const TECHNIQUE_SECTIONS: Record<SalesTechnique, SectionBuilder[]> = {
  challenger: [
    (ctx) => ({
      heading: 'Open with a point of view',
      body: pick(
        [
          `Skip the rapport-building. Open with a sharp read on ${ctx.company}'s situation and make the case that the status quo costs more than ${ctx.firstName} currently believes.`,
          `Lead with a teaching insight, not discovery questions. Give ${ctx.firstName} a new way to see the problem and make them curious about what they are missing.`,
        ],
        ctx.variation,
        0,
      ),
    }),
    (ctx) => ({
      heading: 'Reframe the problem',
      body: pick(
        [
          `Challenge ${ctx.firstName}'s framing. Treat the stated pain — “${ctx.pain}” — as a symptom, and widen the lens to the structural cost behind it.`,
          `Reframe the conversation around the real issue. ${ctx.firstName} likely sees a narrow problem; connect “${ctx.pain}” to the bigger cost it points to.`,
        ],
        ctx.variation,
        1,
      ),
    }),
    (ctx) => ({
      heading: 'Make the cost personal',
      body: pick(
        [
          `Quantify what inaction costs ${ctx.company} this quarter, and tie it to a metric ${ctx.firstName} is personally measured on.`,
          `Make it concrete for ${ctx.firstName}: walk through the downstream cost to ${ctx.company} if nothing changes before the next review.`,
        ],
        ctx.variation,
        2,
      ),
    }),
    (ctx) => ({
      heading: 'Take control of the next step',
      body: pick(
        [
          `Do not leave the next step open. Propose a specific, dated action and name what has to be cleared first — “${ctx.blocker}”.`,
          `Drive to a concrete commitment: the next meeting, who attends, and what must be resolved about “${ctx.blocker}” by then.`,
        ],
        ctx.variation,
        3,
      ),
    }),
  ],
  spin: [
    (ctx) => ({
      heading: 'Situation',
      body: pick(
        [
          `Establish the facts: how ${ctx.company} handles this today, what tools are involved, and who owns the process. Let ${ctx.firstName} supply the detail.`,
          `Map the current state at ${ctx.company} — the workflow, the systems, the owners — without steering. ${ctx.firstName} will trust conclusions they helped build.`,
        ],
        ctx.variation,
        0,
      ),
    }),
    (ctx) => ({
      heading: 'Problem',
      body: pick(
        [
          `Draw out the friction. ${ctx.firstName} raised one pain already — “${ctx.pain}” — so ask what it breaks, how often, and where it hurts most.`,
          `Surface the problem in ${ctx.firstName}'s own words. Start from what they flagged — “${ctx.pain}” — and probe how widely it is felt.`,
        ],
        ctx.variation,
        1,
      ),
    }),
    (ctx) => ({
      heading: 'Implication',
      body: pick(
        [
          `Develop the cost. Ask which downstream decisions get made on bad information at ${ctx.company}, and what that has cost a quarter.`,
          `Make the implications real for ${ctx.firstName}: which forecasts, deals, and quarters are affected while this goes unresolved.`,
        ],
        ctx.variation,
        2,
      ),
    }),
    (ctx) => ({
      heading: 'Need-payoff',
      body: pick(
        [
          `Have ${ctx.firstName} articulate the value of solving this. Then scope a low-risk first step so the payoff feels within reach.`,
          `Ask ${ctx.firstName} what a fixed version of this would be worth — then propose a small, concrete proof step toward it.`,
        ],
        ctx.variation,
        3,
      ),
    }),
  ],
  nepq: [
    (ctx) => ({
      heading: 'Connect & lower resistance',
      body: pick(
        [
          `Open with a calm, low-pressure tone. Make clear this call is about whether there is a fit at all — that gives ${ctx.firstName} room to be candid.`,
          `Disarm first. Tell ${ctx.firstName} you are not here to pitch, you are here to understand — then genuinely listen.`,
        ],
        ctx.variation,
        0,
      ),
    }),
    (ctx) => ({
      heading: 'Situation questions',
      body: pick(
        [
          `Ask neutral, curious questions about how ${ctx.company} handles this now. Stay in discovery — no positioning yet.`,
          `Explore the current state with ${ctx.firstName}: what is working, what is not, and what they have already tried.`,
        ],
        ctx.variation,
        1,
      ),
    }),
    (ctx) => ({
      heading: 'Problem & consequence questions',
      body: pick(
        [
          `Gently press on the pain ${ctx.firstName} named — “${ctx.pain}”. Ask what it leads to if nothing changes.`,
          `Let ${ctx.firstName} talk through the cost of “${ctx.pain}” — how it affects the team and what happens if it persists into next quarter.`,
        ],
        ctx.variation,
        2,
      ),
    }),
    (ctx) => ({
      heading: 'Commitment questions',
      body: pick(
        [
          `Ask ${ctx.firstName} what they would want to happen next — and what has to be true about “${ctx.blocker}” for that to be realistic.`,
          `Let ${ctx.firstName} propose the next step. If they hesitate, ask softly what is holding it back — usually “${ctx.blocker}”.`,
        ],
        ctx.variation,
        3,
      ),
    }),
  ],
};

// Trim and drop trailing sentence punctuation so the value sits cleanly inside
// a quoted aside in a script body.
const clip = (s: string): string => s.trim().replace(/[.;,\s]+$/, '');

function buildScriptCtx(input: GeneratePrecallInput, variation: number): ScriptCtx {
  const { opportunity, buyer, latestDiagnosis } = input;
  return {
    firstName: buyer?.firstName ?? 'the buyer',
    company: buyer?.company ?? 'the account',
    pain: clip(
      opportunity.knownPain?.trim() ||
        opportunity.knownObjection?.trim() ||
        'the problem they are evaluating you for',
    ),
    blocker: clip(
      latestDiagnosis?.primaryBlocker?.trim() ||
        'what still has to be true before a decision',
    ),
    variation,
  };
}

export function fakeGenerateScript(
  input: GeneratePrecallInput,
  technique: SalesTechnique,
  variation: number,
): GeneratedScript {
  const ctx = buildScriptCtx(input, variation);
  const sections = TECHNIQUE_SECTIONS[technique].map((build) => build(ctx));
  return {
    basedOnTemplateId: input.scriptTemplate?.id ?? null,
    technique,
    sections,
  };
}

// --- Top-level generator ---------------------------------------------------

export function fakeGeneratePrecall(
  input: GeneratePrecallInput,
  variation = 0,
): GeneratedPrecall {
  const rng = mulberry32(hashString(input.opportunity.id) + variation * 7919);
  const disc = deriveDisc(input.buyer, rng);
  const ocean = deriveOcean(disc, rng);
  // Use the canonical guide engine (PG-310), same as the real backend chain.
  const match = matchTechnique(disc, ocean);
  const technique = match.primary;
  const firstName = input.buyer?.firstName ?? 'This buyer';

  return {
    psychProfile: {
      disc,
      ocean,
      summary: psychSummary(disc, firstName),
    },
    matchedTechnique: {
      technique,
      reasoning: techniqueReasoning(disc, technique),
      match,
      recommendedNextStep: `Open ${match.recommendedOpeningStyle.toLowerCase()}; lead with a ${match.bestQuestionType}.`,
    },
    generatedScript: fakeGenerateScript(input, technique, variation),
  };
}

export { TECHNIQUE_LABELS, DISC_TYPE_LABELS };

// Stepped labels for the "generating pre-call intelligence…" animation.
export const FAKE_PRECALL_STEPS = [
  'Enriching the buyer profile…',
  'Scoring DISC + OCEAN traits…',
  'Matching a sales technique…',
  'Generating the pre-call script…',
] as const;
