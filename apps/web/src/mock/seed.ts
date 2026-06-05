import type { GeneratedScript, PsychProfile, SignalExtraction } from '@pg/shared';
import type { HydrateInput } from './store';
import type {
  MockBuyer,
  MockImportMapping,
  MockPrecallIntelligence,
  MockProduct,
  MockScriptTemplate,
  MockUser,
  MockWorkspace,
} from './types';
import { makeOpportunity } from './factories/opportunity-factory';
import { makeActivity } from './factories/activity-factory';
import { buildDiagnosis, dim, makeDiagnosis } from './factories/diagnosis-factory';

const WORKSPACE_ID = 'ws_seed_acme';
const USER_ID = 'user_seed_casey';
const PRODUCT_ID = 'prod_seed_mvp';
const ISO = (d: string) => new Date(d).toISOString();

// Recency stamps for the demo working set, anchored to whenever the prototype is
// run so the Workbench / Co-pilot "Today · Yesterday · This week · All" filters
// always have deals to show (both surfaces default to Today). Only drives the
// open opportunities' `updatedAt` — the recency signal the period filter reads.
// Created-at and the activity / diagnosis narrative dates stay absolute, so a
// deal can read "created in March, last worked today".
const recentIso = (daysAgo: number, hour = 15): string => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

export const SEED_USER: MockUser = {
  id: USER_ID,
  name: 'Casey Morgan',
  email: 'casey@launchpadstudio.co',
};

const workspace: MockWorkspace = {
  id: WORKSPACE_ID,
  name: 'Launchpad Studio',
  website: 'https://launchpadstudio.co',
  industry: 'Product Studio — MVP development for early-stage startups',
  crmStageTemplate: 'simple_b2b_sales',
  customCrmStages: null,
  crmType: 'hubspot',
  subscriptionStatus: 'active',
  createdByUserId: USER_ID,
  onboardingCompleted: true,
  createdAt: ISO('2026-02-01T15:00:00Z'),
  updatedAt: ISO('2026-05-12T15:00:00Z'),
};

const PRODUCT_SPRINT_ID = 'prod_seed_sprint';
const PRODUCT_TECHPLAN_ID = 'prod_seed_techplan';
const PRODUCT_STRATEGY_ID = 'prod_seed_strategy';
const PRODUCT_SHIPIT_ID = 'prod_seed_shipit';

// The studio's productized service offerings — one primary (6-Week MVP), the
// default product context for new opportunities. The shared ICP across all of
// them: pre-seed / seed-stage, non-technical B2B SaaS founders who want a
// market-ready MVP as fast as possible.
const product: MockProduct = {
  id: PRODUCT_ID,
  workspaceId: WORKSPACE_ID,
  name: '6-Week MVP',
  description:
    'A fixed-scope, fixed-timeline engagement that takes a non-technical founder from validated idea to a market-ready, revenue-capable MVP in six weeks — design, build, and launch handled end to end.',
  targetBuyer:
    'Pre-seed and seed-stage B2B SaaS founders without a technical co-founder who need a real product in front of paying customers fast.',
  problemSolved:
    'Non-technical founders can’t ship without a slow, expensive engineering hire or an unreliable freelancer. The 6-Week MVP delivers a launch-ready product on a fixed timeline and budget.',
  isPrimary: true,
  createdAt: ISO('2026-02-01T15:00:00Z'),
  updatedAt: ISO('2026-02-01T15:00:00Z'),
};

// A fast, low-commitment entry offering — validates direction before the build.
const productSprint: MockProduct = {
  id: PRODUCT_SPRINT_ID,
  workspaceId: WORKSPACE_ID,
  name: '1-Week Design Sprint',
  description:
    'A one-week sprint that turns a fuzzy idea into a clickable, user-tested prototype and a concrete build plan — the fastest way to de-risk an MVP before committing to the full build.',
  targetBuyer:
    'Early-stage founders still shaping the product who want validated direction and a costed plan before spending on engineering.',
  problemSolved:
    'Founders burn months and budget building the wrong thing. The Design Sprint pressure-tests the concept with real users in five days.',
  isPrimary: false,
  createdAt: ISO('2026-02-20T15:00:00Z'),
  updatedAt: ISO('2026-02-20T15:00:00Z'),
};

// An advisory engagement for founders who are raising or hiring.
const productTechPlan: MockProduct = {
  id: PRODUCT_TECHPLAN_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Technical Investment Planning',
  description:
    'An advisory engagement that gives non-technical founders a clear technical roadmap, architecture, and build-vs-buy plan they can take to investors and early hires with confidence.',
  targetBuyer:
    'Seed-stage founders raising a round or making their first technical hires who need a credible technical plan but have no CTO.',
  problemSolved:
    'Non-technical founders can’t evaluate technical trade-offs, scope, or cost — so they over-build, under-budget, or get steered by vendors. This produces an investor-ready technical plan.',
  isPrimary: false,
  createdAt: ISO('2026-03-15T15:00:00Z'),
  updatedAt: ISO('2026-03-15T15:00:00Z'),
};

// The strategic groundwork session that precedes any design or build.
const productStrategy: MockProduct = {
  id: PRODUCT_STRATEGY_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Strategy Workshop',
  description:
    'A facilitated working session that aligns founders on product scope, target customer, and the shortest path to a market-ready MVP — the groundwork before any design or build begins.',
  targetBuyer:
    'Founding teams who need to narrow scope and agree on what the MVP must (and must not) include before they start building.',
  problemSolved:
    'Founders try to build everything at once and stall. The workshop forces ruthless prioritization down to a shippable v1.',
  isPrimary: false,
  createdAt: ISO('2026-04-10T15:00:00Z'),
  updatedAt: ISO('2026-04-10T15:00:00Z'),
};

// A finishing engagement — added recently, no opportunities yet.
const productShipIt: MockProduct = {
  id: PRODUCT_SHIPIT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Ship It Session',
  description:
    'A focused engagement that takes a stalled or 90%-done product across the finish line — the final fixes, polish, and launch steps that get it in front of paying customers.',
  targetBuyer:
    'Founders sitting on an almost-done build that never quite ships — often after a freelancer or first attempt stalled out.',
  problemSolved:
    'Products stall at 90% and never launch. The Ship It Session closes the gap and gets the product live.',
  isPrimary: false,
  createdAt: ISO('2026-05-10T15:00:00Z'),
  updatedAt: ISO('2026-05-10T15:00:00Z'),
};

// --- Deal 1: Globex — critically over-projecting + at-risk ---

const globexBuyer: MockBuyer = {
  id: 'buy_seed_globex',
  workspaceId: WORKSPACE_ID,
  firstName: 'Jamie',
  lastName: 'Park',
  title: 'Director of Revenue Operations',
  company: 'Globex Industries',
  email: 'jamie.park@globex.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-03-01T15:00:00Z'),
  updatedAt: ISO('2026-03-01T15:00:00Z'),
};

const globexOpp = makeOpportunity({
  id: 'opp_seed_globex',
  workspaceId: WORKSPACE_ID,
  buyerId: globexBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Globex – CDP replacement Q2',
  currentCrmStage: 'Negotiation',
  opportunityValue: 84000,
  expectedCloseDate: '2026-06-30',
  knownPain: 'Existing CDP contract auto-renews in July; finance flagged the cost.',
  knownObjection: 'Buyer keeps deferring decisions back to "the team."',
  dealNotes:
    'Sourced from outbound in March. Two demos to date. CRM stage moved to Negotiation after the rep sent pricing.',
  crmRecordId: 'HS-4815162342',
  atRisk: true,
  currentReadinessState: 'problem_aware',
  currentReadinessScore: 28,
  currentAlignmentOutcome: 'over_projecting',
  currentAlignmentLevel: 'critical',
  createdAt: ISO('2026-03-04T15:00:00Z'),
  updatedAt: recentIso(0), // worked today — at-risk, critically over-projecting
});

const globexInteraction = makeActivity({
  id: 'int_seed_globex_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: globexOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-05-06T17:00:00Z'),
  participants: ['Jamie Park (Globex)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'CASEY: Thanks for hopping back on, Jamie. Last time we walked through the readiness scoring; today I wanted to start lining up next steps so we can hit that July renewal date.',
    "JAMIE: Yeah, about that. I want to be straight with you — I haven't actually pulled the team together yet on whether we're replacing or just renegotiating the current contract. So I'm not sure what next step looks like on my side.",
    'CASEY: Got it. Who needs to be in that room?',
    "JAMIE: Probably me, our VP of Marketing, and someone from Finance. We haven't talked about budget for this; I assumed if it came in under what we pay today it'd be a no-brainer.",
    'CASEY: Makes sense. Want me to send the comparison deck so you can share it ahead of that conversation?',
    "JAMIE: Sure. No promises on timing — we're also dealing with a re-org so this might slip a month.",
  ].join('\n\n'),
  repSubjectiveNotes:
    "Feels stuck. Jamie is friendly but I don't think she has authority. Need to get marketing VP in the room.",
  nextStepAgreed: false,
  stakeholderAdded: false,
  pricingDiscussed: true,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const globexSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Existing CDP contract auto-renews and finance flagged the cost',
      evidence: 'Existing CDP contract auto-renews in July; finance flagged the cost.',
      source: 'rep_note',
      strength: 'medium',
      dimension: 'pain',
    },
  ],
  trust: [],
  urgency: [
    {
      signal: 'Renewal deadline acts as a forcing function but is not buyer-internalized',
      evidence: 'so we can hit that July renewal date',
      source: 'transcript',
      strength: 'weak',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [],
  commitment: [],
  risk: [
    {
      signal: 'Buyer admits no team alignment on replace-vs-renegotiate decision',
      evidence:
        "I haven't actually pulled the team together yet on whether we're replacing or just renegotiating the current contract",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'No budget conversation happened internally',
      evidence: "We haven't talked about budget for this",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'Org re-org may slip timeline',
      evidence: "we're also dealing with a re-org so this might slip a month",
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No VP of Marketing or Finance stakeholder has been engaged.',
    'No procurement, security, or implementation discussion.',
    'No verbal commitment to a decision date.',
    'No competitive evaluation criteria documented.',
  ],
};

const globexDiagnosis = makeDiagnosis({
  id: 'dx_seed_globex',
  workspaceId: WORKSPACE_ID,
  opportunityId: globexOpp.id,
  activityId: globexInteraction.id,
  signalExtraction: globexSignals,
  createdAt: ISO('2026-05-06T18:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'problem_aware',
    readinessScore: 28,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 45, 'Acknowledges renewal cost but does not own the problem internally.', [
        'finance flagged the cost',
      ]),
      dim('trust', 50, 'Rapport is fine; buyer is candid about uncertainty.', [
        'I want to be straight with you',
      ]),
      dim('urgency', 30, 'External July deadline exists but buyer signals it can slip.', [
        'this might slip a month',
      ]),
      dim(
        'solution_confidence',
        20,
        'No solution-confidence signals — buyer has not even decided to replace vs renegotiate.',
        [
          "I haven't actually pulled the team together yet on whether we're replacing or just renegotiating",
        ],
      ),
      dim(
        'commitment',
        10,
        'Zero commitment evidence. No next step, no stakeholders, no decision date.',
        ['No promises on timing'],
      ),
    ],
    primaryBlocker:
      'Buyer has not made the internal decision to replace; the deal is in Negotiation without a buying team or budget conversation.',
    secondaryBlocker: 'No economic buyer or executive sponsor identified.',
    pipelineRealityCheck: {
      crmStage: 'Negotiation',
      outcome: 'over_projecting',
      level: 'critical',
      reason:
        'CRM Negotiation implies commitment readiness, but evidence shows the buyer has not aligned the team, discussed budget, or agreed a next step. Five readiness stages of gap.',
    },
    recommendedNextAction:
      'Stop sending pricing. Re-qualify: ask Jamie to set up a 30-minute call with the VP of Marketing and Finance to align on "replace vs renegotiate" before any further commercial conversation.',
    whatNotToDoYet: [
      'Do not send a revised proposal — pricing is not the blocker.',
      'Do not push for a closed-by date — there is no buying team to commit one.',
      'Do not loop in legal or procurement on Acme side; premature.',
    ],
    followUpSubject: 'Quick reset before we keep going on the CDP work',
    followUpBody:
      "Hi Jamie,\n\nThanks for being candid today. Before we go further with pricing or next steps, it'd help to get the three of you — you, the VP of Marketing, and someone from Finance — on a 30-minute call to decide whether replacing or renegotiating is on the table.\n\nI'll send a comparison deck you can share ahead of that conversation. Once you've made that call, we can pick the right next step.\n\nDoes the week of the 18th work to get that on the calendar?\n\nCasey",
    managerCoachingNote:
      'This deal is in Negotiation without an economic buyer, a buying team, or any commitment signal. The forecasted close date and the value should be removed until a discovery call with the VPM and Finance happens. Coach the rep to call the qualification gap before sending further pricing.',
  }),
});

// --- Deal 2: Initech — over-projecting (high) + at-risk ---

const initechBuyer: MockBuyer = {
  id: 'buy_seed_initech',
  workspaceId: WORKSPACE_ID,
  firstName: 'Marcus',
  lastName: 'Bennett',
  title: 'VP Revenue Operations',
  company: 'Initech',
  email: 'marcus.b@initech.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-03-14T15:00:00Z'),
  updatedAt: ISO('2026-03-14T15:00:00Z'),
};

const initechOpp = makeOpportunity({
  id: 'opp_seed_initech',
  workspaceId: WORKSPACE_ID,
  buyerId: initechBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Initech – reporting refresh',
  currentCrmStage: 'Proposal',
  opportunityValue: 42000,
  expectedCloseDate: '2026-06-15',
  knownPain: 'Quarterly board reporting has been late three quarters running.',
  knownObjection: 'Already evaluating another vendor; wants apples-to-apples.',
  dealNotes:
    'Strong rapport with Marcus. Sent proposal last week after a positive demo. He went quiet for 9 days.',
  atRisk: true,
  currentReadinessState: 'diagnosis_aligned',
  currentReadinessScore: 42,
  currentAlignmentOutcome: 'over_projecting',
  currentAlignmentLevel: 'high',
  createdAt: ISO('2026-03-15T15:00:00Z'),
  updatedAt: recentIso(1), // worked yesterday
});

const initechInteraction = makeActivity({
  id: 'int_seed_initech_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: initechOpp.id,
  activityType: 'email_thread',
  activityDate: ISO('2026-05-10T14:00:00Z'),
  participants: ['Marcus Bennett (Initech)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'From Marcus, 2026-05-10:',
    "Hey Casey — sorry for the radio silence. We got your proposal and the other vendor's side by side last week. Honestly the team has been pulled into the new ERP rollout so this hasn't been front of mind. I'll be straight: I like Pulse better but I haven't had the bandwidth to put together a recommendation for the CFO yet, and procurement hasn't opened a ticket on our side.",
    'Can we push the close target back two weeks while I get this in front of the right people?',
  ].join('\n\n'),
  repSubjectiveNotes:
    "Good news he prefers us. Bad news: no procurement, no CFO ask, no real next step. I marked it Proposal because we sent the proposal but he's not actually evaluating.",
  nextStepAgreed: false,
  stakeholderAdded: false,
  pricingDiscussed: true,
  budgetDiscussed: false,
  competitorDiscussed: true,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const initechSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Quarterly reporting consistently late',
      evidence: 'Quarterly board reporting has been late three quarters running.',
      source: 'rep_note',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Buyer explicitly prefers our product over alternative',
      evidence: 'I like Pulse better',
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Competing internal initiative (ERP rollout) is consuming bandwidth',
      evidence:
        "the team has been pulled into the new ERP rollout so this hasn't been front of mind",
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Preference stated, but no decision-confidence language',
      evidence:
        "I like Pulse better but I haven't had the bandwidth to put together a recommendation",
      source: 'transcript',
      strength: 'medium',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Buyer requests timeline pushback rather than committing',
      evidence: 'Can we push the close target back two weeks',
      source: 'transcript',
      strength: 'weak',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'No CFO recommendation drafted',
      evidence: "I haven't had the bandwidth to put together a recommendation for the CFO yet",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'Procurement has not been engaged',
      evidence: "procurement hasn't opened a ticket on our side",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'CFO has not seen the proposal.',
    'No procurement, security, or legal review started.',
    'No implementation timeline discussed.',
  ],
};

const initechDiagnosis = makeDiagnosis({
  id: 'dx_seed_initech',
  workspaceId: WORKSPACE_ID,
  opportunityId: initechOpp.id,
  activityId: initechInteraction.id,
  signalExtraction: initechSignals,
  createdAt: ISO('2026-05-10T15:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'diagnosis_aligned',
    readinessScore: 42,
    confidence: 'high',
    dimensionScores: [
      dim(
        'pain',
        70,
        "Real, recurring pain (late board reporting) and it lives in Marcus' world.",
        ['Quarterly board reporting has been late three quarters running.'],
      ),
      dim('trust', 75, 'Marcus is candid and explicitly prefers us — trust is healthy.', [
        'I like Pulse better',
      ]),
      dim('urgency', 30, 'ERP rollout is crowding out this work; no internal urgency.', [
        'the team has been pulled into the new ERP rollout',
      ]),
      dim('solution_confidence', 55, 'Preference exists but is not yet recommendation-grade.', [
        "I like Pulse better but I haven't had the bandwidth to put together a recommendation",
      ]),
      dim('commitment', 20, 'Buyer is asking for an extension, not committing.', [
        'Can we push the close target back two weeks',
      ]),
    ],
    primaryBlocker:
      'No CFO recommendation has been drafted and procurement is not engaged. The deal is in Proposal but no decision motion exists on the buyer side.',
    secondaryBlocker: "ERP rollout is the buyer's real priority for the next few weeks.",
    pipelineRealityCheck: {
      crmStage: 'Proposal',
      outcome: 'over_projecting',
      level: 'high',
      reason:
        'CRM Proposal implies solution-confident, but evidence shows the CFO has not seen the proposal and procurement has not been opened. Two readiness stages of gap.',
    },
    recommendedNextAction:
      'Offer Marcus a 1-page summary he can send the CFO this week, and propose a 20-minute joint call with the CFO once that lands. Hold pricing pressure entirely.',
    whatNotToDoYet: [
      'Do not discount to "unblock" — pricing is not the blocker.',
      'Do not push for a revised close date until the CFO conversation happens.',
      'Do not loop in legal/security until the CFO is bought in.',
    ],
    followUpSubject: 'A 1-pager you can send the CFO this week',
    followUpBody:
      "Hi Marcus,\n\nGlad to hear Pulse is the preferred direction — and totally hear you on the ERP rollout. To make this easier on you, I put together a 1-page summary you can forward to the CFO without any prep work on your end (attached).\n\nIf it lands well, I'd love to grab 20 minutes with the two of you to walk through the ROI piece together. No proposal pressure on this side until that happens.\n\nWhich week works to get that on the calendar?\n\nCasey",
    managerCoachingNote:
      'Real preference + no decision motion = classic Proposal-stage over-call. The rep should pull the deal back to Discovery in their head: until the CFO has seen the proposal and procurement is open, this is not a Q2 deal. Coach to challenge the close date with the rep.',
  }),
});

// --- Deal 3: Wayne Industries — aligned (mid-funnel) ---

const wayneBuyer: MockBuyer = {
  id: 'buy_seed_wayne',
  workspaceId: WORKSPACE_ID,
  firstName: 'Lucia',
  lastName: 'Ortiz',
  title: 'Director of Sales Strategy',
  company: 'Wayne Industries',
  email: 'lucia.ortiz@wayne.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-04-02T15:00:00Z'),
  updatedAt: ISO('2026-04-02T15:00:00Z'),
};

const wayneOpp = makeOpportunity({
  id: 'opp_seed_wayne',
  workspaceId: WORKSPACE_ID,
  buyerId: wayneBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Wayne – marketing stack consolidation',
  currentCrmStage: 'Demo',
  opportunityValue: 56000,
  expectedCloseDate: '2026-07-31',
  knownPain: 'Marketing-attributed pipeline is wildly different across two reporting tools.',
  knownObjection: null,
  dealNotes:
    'Discovery and demo went well. Lucia is the strategic owner and asked about pilot scope.',
  crmRecordId: 'HS-2718281828',
  currentReadinessState: 'solution_curious',
  currentReadinessScore: 58,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  createdAt: ISO('2026-04-03T15:00:00Z'),
  updatedAt: recentIso(2), // earlier this week
});

const wayneInteraction = makeActivity({
  id: 'int_seed_wayne_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: wayneOpp.id,
  activityType: 'demo',
  activityDate: ISO('2026-05-09T16:00:00Z'),
  participants: ['Lucia Ortiz (Wayne)', 'Devon Mills (Wayne, Sales Ops)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    "CASEY: So that's the readiness scoring layered over your existing pipeline view. Curious what stood out.",
    "LUCIA: The dimension breakdown is exactly the conversation I keep trying to have with our reps — they'll say a deal is \"almost there\" and I can't articulate what's missing. This puts a name on it.",
    "DEVON: How disruptive is implementation? We're mid-quarter and I can't pull engineering for anything heavy.",
    "CASEY: Light. We're a Chrome extension plus a Salesforce package. Most teams are running in under two days, no engineering needed.",
    'LUCIA: OK. What does a pilot look like — say, my AE team of six for a quarter?',
    'CASEY: We can scope a 6-seat pilot for 90 days, free of charge, success metric tied to how often the Pipeline Reality Check changes a forecast call. Want me to put a one-pager together?',
    'LUCIA: Yes — and loop in Devon so we have the technical lens too.',
  ].join('\n\n'),
  repSubjectiveNotes:
    'Lucia gets it. Devon is the implementation gatekeeper. Healthy alignment with where we are in pipeline.',
  nextStepAgreed: true,
  stakeholderAdded: true,
  pricingDiscussed: false,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: true,
  securityDiscussed: false,
});

const wayneSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Strategic owner cannot articulate what is missing on stuck deals',
      evidence:
        "they'll say a deal is \"almost there\" and I can't articulate what's missing. This puts a name on it.",
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
    {
      signal: 'Two reporting tools disagree on marketing-attributed pipeline',
      evidence: 'Marketing-attributed pipeline is wildly different across two reporting tools.',
      source: 'rep_note',
      strength: 'medium',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Lucia validates the framing in her own words',
      evidence: 'exactly the conversation I keep trying to have with our reps',
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Mid-quarter constraints raised on implementation, not buying',
      evidence: "We're mid-quarter and I can't pull engineering for anything heavy",
      source: 'transcript',
      strength: 'medium',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Implementation light enough to pass the engineering gate',
      evidence: 'Most teams are running in under two days, no engineering needed.',
      source: 'transcript',
      strength: 'medium',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Buyer scopes a concrete pilot and brings in the implementation owner',
      evidence: 'and loop in Devon so we have the technical lens too',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'No economic-buyer / budget conversation yet',
      evidence: 'Pricing was not discussed',
      source: 'checklist',
      strength: 'weak',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No economic buyer engaged yet (likely VP Sales or CRO).',
    'No security review discussion.',
    'No commercial terms.',
  ],
};

const wayneDiagnosis = makeDiagnosis({
  id: 'dx_seed_wayne',
  workspaceId: WORKSPACE_ID,
  opportunityId: wayneOpp.id,
  activityId: wayneInteraction.id,
  signalExtraction: wayneSignals,
  createdAt: ISO('2026-05-09T17:30:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'solution_curious',
    readinessScore: 58,
    confidence: 'medium',
    dimensionScores: [
      dim(
        'pain',
        75,
        "Pain is articulated in the buyer's own words and tied to a recurring frustration.",
        ["they'll say a deal is \"almost there\" and I can't articulate what's missing"],
      ),
      dim('trust', 70, 'Lucia is enthusiastic; trust is healthy and growing.', [
        'exactly the conversation I keep trying to have with our reps',
      ]),
      dim(
        'urgency',
        45,
        'No external forcing function; quarter-end is a constraint, not a deadline.',
        ["We're mid-quarter and I can't pull engineering"],
      ),
      dim(
        'solution_confidence',
        60,
        'Pilot framing emerged and implementation concern was answered.',
        ['a 6-seat pilot for 90 days'],
      ),
      dim(
        'commitment',
        55,
        'Concrete next step + new stakeholder added — early commitment evidence.',
        ['loop in Devon so we have the technical lens too'],
      ),
    ],
    primaryBlocker:
      'No economic buyer in the conversation yet. Pilot momentum is real but the eventual commercial gate has not been opened.',
    secondaryBlocker: null,
    pipelineRealityCheck: {
      crmStage: 'Demo',
      outcome: 'aligned',
      level: 'none',
      reason:
        'CRM Demo implies solution-curious, which is exactly where the buyer sits. Healthy alignment — no over- or under-call.',
    },
    recommendedNextAction:
      'Scope and send the 90-day pilot one-pager this week, with Devon copied. Ask Lucia who would sign off on the pilot moving to paid.',
    whatNotToDoYet: [
      'Do not push commercial terms; the pilot is the next gate.',
      'Do not skip Devon — implementation gatekeeper, will block later if surprised.',
    ],
    followUpSubject: 'Pulse 90-day pilot — one-pager for you + Devon',
    followUpBody:
      "Hi Lucia and Devon,\n\nAttached is the 90-day pilot scope we discussed — six AE seats, success metric tied to forecast-call changes from the Pipeline Reality Check, no engineering lift on your side.\n\nOne ask: Lucia, who on your side signs off when the pilot moves to paid? Want to make sure that person sees this early so we don't lose time later.\n\nHappy to do a 15-minute kickoff once you've had a chance to review.\n\nCasey",
    managerCoachingNote:
      "Healthy mid-funnel deal. Rep should focus on getting the economic buyer named before the pilot starts — common trap is letting the pilot run, succeed, and then discovering there's no commercial path.",
  }),
});

// --- Deal 4: Stark Labs — aligned (late funnel, commit ready) ---

const starkBuyer: MockBuyer = {
  id: 'buy_seed_stark',
  workspaceId: WORKSPACE_ID,
  firstName: 'Priya',
  lastName: 'Shah',
  title: 'Chief Revenue Officer',
  company: 'Stark Labs',
  email: 'priya.shah@starklabs.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-01-20T15:00:00Z'),
  updatedAt: ISO('2026-01-20T15:00:00Z'),
};

const starkOpp = makeOpportunity({
  id: 'opp_seed_stark',
  workspaceId: WORKSPACE_ID,
  buyerId: starkBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Stark Labs – pilot expansion (50 → 200 seats)',
  currentCrmStage: 'Negotiation',
  opportunityValue: 192000,
  expectedCloseDate: '2026-05-30',
  knownPain: 'Pilot proved Pipeline Reality Check changed 31% of late-stage forecast calls.',
  knownObjection: 'Procurement is pushing for a 2-year term at the 1-year price.',
  dealNotes:
    'Pilot ran Q1. CRO Priya is the champion and the economic buyer. Procurement is the last gate.',
  crmRecordId: 'HS-1123581321',
  currentReadinessState: 'commit_ready',
  currentReadinessScore: 86,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  createdAt: ISO('2026-01-22T15:00:00Z'),
  updatedAt: recentIso(0), // worked today — late-stage, commit-ready
});

const starkInteraction = makeActivity({
  id: 'int_seed_stark_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: starkOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-05-12T19:00:00Z'),
  participants: ['Priya Shah (Stark)', 'Mike Reilly (Stark Procurement)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'PRIYA: Let me cut to it. The pilot results are real — 31% of late-stage calls got changed and we recovered two deals my team was going to lose blind. I want the 200-seat rollout to start June 1.',
    'MIKE: Our ask is the 1-year price held for a 2-year term, and we want a quarterly opt-out for the second year.',
    "CASEY: I can do the 2-year at the 1-year price if there's no opt-out — that's how we model the discount. Happy to write a 30-day mutual termination for cause if that helps.",
    'MIKE: Let me take that back. If you can have paper to us by Friday we can be signed by month-end.',
    'PRIYA: Casey, what does kickoff look like? I want to make sure the wider team is using this within two weeks of signature.',
    "CASEY: Two-day onboarding workshop, then weekly office hours for the first month. I'll send the rollout plan with the paper.",
  ].join('\n\n'),
  repSubjectiveNotes:
    'Real deal. Champion is the economic buyer. Only thing between us and signed paper is the 2-year terms language.',
  nextStepAgreed: true,
  stakeholderAdded: true,
  pricingDiscussed: true,
  budgetDiscussed: true,
  competitorDiscussed: false,
  implementationDiscussed: true,
  securityDiscussed: true,
});

const starkSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Pilot quantified deal recovery the buyer would have lost blind',
      evidence: 'we recovered two deals my team was going to lose blind',
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Economic buyer leading commercial conversation directly',
      evidence: 'Let me cut to it. The pilot results are real',
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Buyer-stated start date for rollout',
      evidence: 'I want the 200-seat rollout to start June 1',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Pilot ROI proven with a specific metric',
      evidence: '31% of late-stage calls got changed',
      source: 'transcript',
      strength: 'strong',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Procurement engaged, terms being negotiated, signature target named',
      evidence: 'If you can have paper to us by Friday we can be signed by month-end',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
    {
      signal: 'Buyer planning operational rollout, not just signature',
      evidence: 'I want to make sure the wider team is using this within two weeks of signature',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'Two-year terms language is the only outstanding gate',
      evidence: 'Our ask is the 1-year price held for a 2-year term',
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: ['Final paper not yet exchanged.'],
};

const starkDiagnosis = makeDiagnosis({
  id: 'dx_seed_stark',
  workspaceId: WORKSPACE_ID,
  opportunityId: starkOpp.id,
  activityId: starkInteraction.id,
  signalExtraction: starkSignals,
  createdAt: ISO('2026-05-12T20:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'commit_ready',
    readinessScore: 86,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 85, 'Pain is concretely quantified by the buyer with pilot data.', [
        '31% of late-stage calls got changed',
      ]),
      dim('trust', 90, 'CRO is the champion and is leading negotiation directly.', [
        'Let me cut to it. The pilot results are real',
      ]),
      dim('urgency', 80, 'Buyer-driven start date and signature target.', [
        'I want the 200-seat rollout to start June 1',
      ]),
      dim(
        'solution_confidence',
        90,
        'Pilot evidence is the strongest possible confidence signal.',
        ['we recovered two deals my team was going to lose blind'],
      ),
      dim('commitment', 85, 'Procurement, terms, rollout planning, signature date.', [
        'If you can have paper to us by Friday we can be signed by month-end',
      ]),
    ],
    primaryBlocker:
      'Outstanding terms language on the 2-year agreement. Nothing else stands between current state and signature.',
    secondaryBlocker: null,
    pipelineRealityCheck: {
      crmStage: 'Negotiation',
      outcome: 'aligned',
      level: 'none',
      reason:
        "CRM Negotiation implies commit-ready, which matches the buyer's state exactly. The forecast call is sound.",
    },
    recommendedNextAction:
      'Send paper by Thursday EOD with the mutual-termination-for-cause language. Confirm kickoff dates in the cover email.',
    whatNotToDoYet: [
      'Do not introduce new commercial variables (multi-product, services attach) — close the core deal first.',
    ],
    followUpSubject: 'Stark – paper + kickoff plan',
    followUpBody:
      "Priya, Mike,\n\nSending paper Thursday EOD: 2-year term at the 1-year price, with a 30-day mutual termination for cause. Kickoff plan attached — 2-day onboarding workshop, weekly office hours for the first month, target start June 1.\n\nLet me know if anything in the cover is off and I'll turn it around same day.\n\nCasey",
    managerCoachingNote:
      'Healthy late-stage deal. Rep is doing the right things. The only thing to watch is that we get paper out fast — late paper is the most common reason these deals slip.',
  }),
});

// --- Deal 5: Hooli — under-projecting (medium) ---

const hooliBuyer: MockBuyer = {
  id: 'buy_seed_hooli',
  workspaceId: WORKSPACE_ID,
  firstName: 'Tomas',
  lastName: 'Vogel',
  title: 'Senior Director of Sales Operations',
  company: 'Hooli',
  email: 'tomas.vogel@hooli.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-04-25T15:00:00Z'),
  updatedAt: ISO('2026-04-25T15:00:00Z'),
};

const hooliOpp = makeOpportunity({
  id: 'opp_seed_hooli',
  workspaceId: WORKSPACE_ID,
  buyerId: hooliBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Hooli – sales ops tooling refresh',
  currentCrmStage: 'Discovery',
  opportunityValue: 75000,
  expectedCloseDate: '2026-09-30',
  knownPain: 'Forecast accuracy at 41% last quarter; CFO has asked Tomas to fix it.',
  knownObjection: null,
  dealNotes:
    'Tomas ran his own POC with the trial. Already loops in his RevOps team without prompting.',
  currentReadinessState: 'solution_confident',
  currentReadinessScore: 71,
  currentAlignmentOutcome: 'under_projecting',
  currentAlignmentLevel: 'medium',
  createdAt: ISO('2026-04-27T15:00:00Z'),
  updatedAt: recentIso(1), // worked yesterday
});

const hooliInteraction = makeActivity({
  id: 'int_seed_hooli_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: hooliOpp.id,
  activityType: 'call',
  activityDate: ISO('2026-05-11T15:00:00Z'),
  participants: ['Tomas Vogel (Hooli)', 'Sarah Wu (Hooli, RevOps)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    "TOMAS: I've had a chance to actually run Pulse on three of our deals. The readiness scoring matches what my best AE would have said on every one — and it caught two deals that our CRM had at Negotiation but were really at Discovery.",
    "CASEY: That's the use case. How do you want to take it from here?",
    "TOMAS: I want to roll it to the full team. Sarah and I have a meeting with the CFO on the 21st — that's the budget approval. Before that I need a one-pager on year-one ROI and a 90-day rollout plan I can hand him.",
    "SARAH: And what does security want from us? We're mid-SOC2 audit, can't blow that up.",
    'CASEY: SOC2 Type II report and DPA, both in our trust center. Want me to send links?',
    'TOMAS: Send them and copy our security lead. If the CFO meeting goes well on the 21st I want to be in paper the following week.',
  ].join('\n\n'),
  repSubjectiveNotes:
    "Tomas is way further along than I marked him. He's already done the eval; this is a commercial conversation. CRM stage is wrong.",
  nextStepAgreed: true,
  stakeholderAdded: true,
  pricingDiscussed: false,
  budgetDiscussed: true,
  competitorDiscussed: false,
  implementationDiscussed: true,
  securityDiscussed: true,
});

const hooliSignals: SignalExtraction = {
  pain: [
    {
      signal: 'CFO mandate to fix forecast accuracy',
      evidence: 'Forecast accuracy at 41% last quarter; CFO has asked Tomas to fix it.',
      source: 'rep_note',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Buyer ran his own POC and is reporting back validated results',
      evidence: "I've had a chance to actually run Pulse on three of our deals",
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Hard date for budget approval named',
      evidence: "we have a meeting with the CFO on the 21st — that's the budget approval",
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: "Buyer's own validation: scoring matched expert judgment + caught real misses",
      evidence: 'caught two deals that our CRM had at Negotiation but were really at Discovery',
      source: 'transcript',
      strength: 'strong',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Concrete rollout plan asked for, paper timeline named',
      evidence: 'I want to be in paper the following week',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'Active SOC2 audit makes security review a hard gate',
      evidence: "We're mid-SOC2 audit, can't blow that up",
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: ['CFO has not yet signed off on budget.'],
};

const hooliDiagnosis = makeDiagnosis({
  id: 'dx_seed_hooli',
  workspaceId: WORKSPACE_ID,
  opportunityId: hooliOpp.id,
  activityId: hooliInteraction.id,
  signalExtraction: hooliSignals,
  createdAt: ISO('2026-05-11T16:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'solution_confident',
    readinessScore: 71,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 80, 'Top-down mandate from the CFO is the strongest possible pain signal.', [
        'CFO has asked Tomas to fix it',
      ]),
      dim('trust', 85, 'Buyer ran his own POC and is bringing positive results back.', [
        "I've had a chance to actually run Pulse on three of our deals",
      ]),
      dim('urgency', 75, 'Named budget meeting date drives a hard commercial timeline.', [
        'we have a meeting with the CFO on the 21st',
      ]),
      dim('solution_confidence', 80, 'Independently validated — strongest form of confidence.', [
        'caught two deals that our CRM had at Negotiation but were really at Discovery',
      ]),
      dim('commitment', 65, 'Paper timeline named but contingent on CFO meeting.', [
        'I want to be in paper the following week',
      ]),
    ],
    primaryBlocker:
      'CFO budget approval on the 21st. Until that happens, no procurement engagement is possible.',
    secondaryBlocker: 'Security review for SOC2 alignment is a parallel hard gate.',
    pipelineRealityCheck: {
      crmStage: 'Discovery',
      outcome: 'under_projecting',
      level: 'medium',
      reason:
        'CRM Discovery implies diagnosis-aligned, but the buyer has done his own POC, named a budget meeting, and asked for a rollout plan. Two stages of under-call — this deal is closer than the rep marked it.',
    },
    recommendedNextAction:
      'Send the year-one ROI 1-pager + 90-day rollout plan by Monday so Tomas has it in time for the CFO meeting on the 21st. Send SOC2 + DPA links to the security lead in parallel.',
    whatNotToDoYet: [
      "Do not push paper until the CFO meeting concludes — that's the gate, not the deal.",
    ],
    followUpSubject: 'For your CFO meeting on the 21st',
    followUpBody:
      "Tomas, Sarah,\n\nAttaching: year-one ROI 1-pager and the 90-day rollout plan, both ready to hand to the CFO.\n\nSeparately, I'll send our SOC2 Type II report and DPA to Sarah and your security lead in a separate thread so that work can happen in parallel and not block the commercial side.\n\nQuick ask: if the CFO meeting goes how you expect, what's the fastest path to paper your team has done before?\n\nCasey",
    managerCoachingNote:
      "This is the textbook under-call. Rep marked it Discovery because that's when the discovery call happened, but the buyer has already run his own POC and named a budget date. CRM stage should advance to Proposal or Negotiation. The forecast is leaving money on the table.",
  }),
});

// --- Deal 7: Massive Dynamic — under-projecting (medium), stakeholder validation needed ---

const massiveDynamicBuyer: MockBuyer = {
  id: 'buy_seed_massivedynamic',
  workspaceId: WORKSPACE_ID,
  firstName: 'Renee',
  lastName: 'Adeyemi',
  title: 'Head of Sales Enablement',
  company: 'Massive Dynamic',
  email: 'renee.a@massivedynamic.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-04-08T15:00:00Z'),
  updatedAt: ISO('2026-04-08T15:00:00Z'),
};

const massiveDynamicOpp = makeOpportunity({
  id: 'opp_seed_massivedynamic',
  workspaceId: WORKSPACE_ID,
  buyerId: massiveDynamicBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Massive Dynamic – sales enablement refresh',
  currentCrmStage: 'Discovery',
  opportunityValue: 110000,
  expectedCloseDate: '2026-08-15',
  knownPain: 'Enablement programs not landing — manager-coaching adoption stuck at 35%.',
  knownObjection: 'Worried about another tool reps will ignore.',
  dealNotes: 'Renee is bought in; needs to convince the regional VPs before commercial.',
  crmRecordId: 'HS-3141592653',
  currentReadinessState: 'stakeholder_validation_needed',
  currentReadinessScore: 63,
  currentAlignmentOutcome: 'under_projecting',
  currentAlignmentLevel: 'medium',
  createdAt: ISO('2026-04-10T15:00:00Z'),
  updatedAt: recentIso(4), // earlier this week
});

const massiveDynamicInt1 = makeActivity({
  id: 'int_seed_massivedynamic_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: massiveDynamicOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-04-22T18:00:00Z'),
  participants: ['Renee Adeyemi (Massive Dynamic)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    "RENEE: The manager-coaching note feature is the unlock for us. Our managers don't actually do 1:1 coaching consistently because they don't know what to coach on.",
    'CASEY: Good. What does the path to "yes" look like on your side?',
    "RENEE: I have to get the three regional VPs on board. They're skeptical of new tools after a CRM migration that didn't land last year. If they say yes, the rest is easy.",
  ].join('\n\n'),
  repSubjectiveNotes: 'Renee is the internal champion. VPs are the real gate.',
  nextStepAgreed: true,
  stakeholderAdded: false,
  pricingDiscussed: false,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const massiveDynamicInt2 = makeActivity({
  id: 'int_seed_massivedynamic_2',
  workspaceId: WORKSPACE_ID,
  opportunityId: massiveDynamicOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-05-08T17:00:00Z'),
  participants: [
    'Renee Adeyemi (Massive Dynamic)',
    'Diego Hart (VP Sales, West)',
    'Casey Morgan (Acme)',
  ],
  transcriptOrNotes: [
    "DIEGO: I'll be honest — I'm tired of getting handed tools my reps are supposed to use. So my question is just: what's different here, and how do we know my managers will actually use it?",
    "CASEY: Fair. Two things: the manager-coaching note is generated for them after every diagnosis, so they're not creating it from scratch. And we'd run a 4-week pilot where the metric is coaching-note opens per manager. If it's low, you have your answer.",
    'DIEGO: A 4-week pilot I could actually defend. Renee, can you set that up with the East and Central VPs too?',
    "RENEE: Yeah, I'll have them on by next Friday.",
  ].join('\n\n'),
  repSubjectiveNotes: "Diego is the first VP. He's leaning in. Need East and Central next.",
  nextStepAgreed: true,
  stakeholderAdded: true,
  pricingDiscussed: false,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: true,
  securityDiscussed: false,
});

// First-interaction diagnosis: only the champion in the room, pain articulated,
// but the VP-validation gate hasn't been opened yet. Used by the Overview-tab
// readiness trend to show advancement int1 → int2 (diagnosis_aligned →
// stakeholder_validation_needed) on the same deal.
const massiveDynamicInt1Signals: SignalExtraction = {
  pain: [
    {
      signal: 'Manager-coaching is the named, owned pain point',
      evidence: "Our managers don't actually do 1:1 coaching consistently",
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Champion frames her own ownership of the rollout decision',
      evidence: 'I have to get the three regional VPs on board',
      source: 'transcript',
      strength: 'medium',
      dimension: 'trust',
    },
  ],
  urgency: [],
  solution_confidence: [],
  commitment: [
    {
      signal: 'Champion will line up the gating stakeholders',
      evidence: 'If they say yes, the rest is easy.',
      source: 'transcript',
      strength: 'medium',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'Prior failed tool rollout creates organizational skepticism',
      evidence: "They're skeptical of new tools after a CRM migration that didn't land last year",
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No VP-level stakeholders in the conversation yet.',
    'No commercial framing, no pilot scope.',
    'No security or implementation discussion.',
  ],
};

const massiveDynamicInt1Diagnosis = makeDiagnosis({
  id: 'dx_seed_massivedynamic_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: massiveDynamicOpp.id,
  activityId: massiveDynamicInt1.id,
  signalExtraction: massiveDynamicInt1Signals,
  createdAt: ISO('2026-04-22T19:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'diagnosis_aligned',
    readinessScore: 41,
    confidence: 'medium',
    dimensionScores: [
      dim('pain', 65, 'Pain is articulated and owned by the champion.', [
        "Our managers don't actually do 1:1 coaching consistently",
      ]),
      dim('trust', 60, 'Healthy champion relationship; no broader stakeholder trust yet.', [
        'I have to get the three regional VPs on board',
      ]),
      dim('urgency', 20, 'No timeline pressure named on the buyer side.', []),
      dim('solution_confidence', 25, 'No solution-fit validation from the buyer yet.', []),
      dim('commitment', 35, 'Champion will set up the VP conversations but no concrete date.', [
        'If they say yes, the rest is easy.',
      ]),
    ],
    primaryBlocker:
      'The three regional VPs have not been engaged yet. The champion cannot move the deal alone.',
    secondaryBlocker: 'Prior failed tool rollout means the VPs will arrive skeptical by default.',
    pipelineRealityCheck: {
      crmStage: 'Discovery',
      outcome: 'aligned',
      level: 'none',
      reason:
        'CRM Discovery implies diagnosis-aligned, which is exactly where the buyer sits — pain established, stakeholder validation not yet started.',
    },
    recommendedNextAction:
      'Help Renee set up the first VP conversation with a short framing artifact she can send ahead, so the meeting opens on solution fit rather than introductions.',
    whatNotToDoYet: [
      'Do not push for a pilot scope before any VP has weighed in.',
      'Do not raise pricing — the deal is not commercially ready.',
    ],
    followUpSubject: 'A short framing piece for your first VP conversation',
    followUpBody:
      "Renee,\n\nThanks for the time today. To make the first VP conversation easier, I'll put together a one-page framing built around the manager-coaching pain — short enough to forward, structured so it surfaces the questions a skeptical VP would ask anyway.\n\nWhich of the three regional VPs do you think is the most likely first 'yes'? Worth starting there.\n\nCasey",
    managerCoachingNote:
      'Healthy mid-funnel discovery. Rep should resist any temptation to push pricing or pilot scope until at least one VP has validated; the champion is real but cannot move this on her own.',
  }),
});

const massiveDynamicSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Manager coaching is the named pain point and is concretely measured',
      evidence: "Our managers don't actually do 1:1 coaching consistently",
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Champion exists and has internal credibility',
      evidence: 'If they say yes, the rest is easy.',
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [],
  solution_confidence: [
    {
      signal: 'First VP validates the proof structure (4-week pilot, defendable metric)',
      evidence: 'A 4-week pilot I could actually defend',
      source: 'transcript',
      strength: 'strong',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Champion will line up remaining VPs',
      evidence: "I'll have them on by next Friday",
      source: 'transcript',
      strength: 'medium',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'Prior failed tool rollout creates internal skepticism',
      evidence: "I'm tired of getting handed tools my reps are supposed to use",
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'East and Central VPs not yet engaged.',
    'No commercial conversation; no budget.',
    'No security review.',
  ],
};

const massiveDynamicDiagnosis = makeDiagnosis({
  id: 'dx_seed_massivedynamic',
  workspaceId: WORKSPACE_ID,
  opportunityId: massiveDynamicOpp.id,
  activityId: massiveDynamicInt2.id,
  signalExtraction: massiveDynamicSignals,
  createdAt: ISO('2026-05-08T18:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'stakeholder_validation_needed',
    readinessScore: 63,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 75, 'Named, owned, measured pain point.', [
        "Our managers don't actually do 1:1 coaching consistently",
      ]),
      dim('trust', 75, 'Champion is internally credible and bringing the right people in.', [
        'If they say yes, the rest is easy.',
      ]),
      dim('urgency', 35, 'No external timeline; pace is set by internal VP availability.', []),
      dim('solution_confidence', 70, 'First VP validated the pilot structure.', [
        'A 4-week pilot I could actually defend',
      ]),
      dim('commitment', 55, 'Champion committed to bringing in the remaining stakeholders.', [
        "I'll have them on by next Friday",
      ]),
    ],
    primaryBlocker:
      'East and Central VPs have not validated. The deal cannot move to commercial until all three regional VPs are bought in.',
    secondaryBlocker:
      'Prior failed tool rollout creates skepticism that must be addressed proactively.',
    pipelineRealityCheck: {
      crmStage: 'Discovery',
      outcome: 'under_projecting',
      level: 'medium',
      reason:
        'CRM Discovery implies diagnosis-aligned, but the buyer has a defined pilot structure with the first VP bought in. Two stages of under-call.',
    },
    recommendedNextAction:
      'Pre-brief Renee on a 1-page artifact she can share with East and Central VPs ahead of the next-Friday session so the meeting starts from "is the pilot a yes" instead of from scratch.',
    whatNotToDoYet: [
      'Do not introduce pricing until all three VPs have validated.',
      "Do not assume the East and Central conversations will go like Diego's — prepare for skepticism.",
    ],
    followUpSubject: 'Pre-brief for the East / Central VP session',
    followUpBody:
      "Renee,\n\nReally helpful having Diego on today. To make the East and Central conversation easier, attaching a 1-page pre-brief built around the same 4-week pilot framing Diego validated — defendable metric is coaching-note opens per manager.\n\nIf there's a specific objection either VP is likely to raise, send it over and I'll prep a paragraph for you.\n\nCasey",
    managerCoachingNote:
      'Healthy mid-funnel deal with a real champion and a clear gate (3 VPs). Rep should advance the CRM stage to Demo or beyond — Discovery is under-calling. Pre-briefing the champion before each VP conversation is the right pattern here.',
  }),
});

// --- Deal 8: Cyberdyne — under-projecting (low), commercially ready ---

const cyberdyneBuyer: MockBuyer = {
  id: 'buy_seed_cyberdyne',
  workspaceId: WORKSPACE_ID,
  firstName: 'Helena',
  lastName: 'Krause',
  title: 'VP Finance',
  company: 'Cyberdyne Systems',
  email: 'helena.krause@cyberdyne.example',
  linkedin: null,
  website: null,
  notes: null,
  createdAt: ISO('2026-02-18T15:00:00Z'),
  updatedAt: ISO('2026-02-18T15:00:00Z'),
};

const cyberdyneOpp = makeOpportunity({
  id: 'opp_seed_cyberdyne',
  workspaceId: WORKSPACE_ID,
  buyerId: cyberdyneBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Cyberdyne – renewal expansion',
  currentCrmStage: 'Proposal',
  opportunityValue: 144000,
  expectedCloseDate: '2026-07-15',
  knownPain: 'Existing 20-seat contract performed; CRO wants to expand to 80.',
  knownObjection: 'Procurement wants security and DPA refresh before any change.',
  dealNotes: 'Renewal + expansion combined. Helena owns budget. Security review in flight.',
  currentReadinessState: 'commercially_ready',
  currentReadinessScore: 78,
  currentAlignmentOutcome: 'under_projecting',
  currentAlignmentLevel: 'low',
  createdAt: ISO('2026-02-20T15:00:00Z'),
  updatedAt: recentIso(3), // earlier this week
});

const cyberdyneInteraction = makeActivity({
  id: 'int_seed_cyberdyne_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: cyberdyneOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-05-09T18:00:00Z'),
  participants: [
    'Helena Krause (Cyberdyne)',
    'Nate Brooks (Cyberdyne Procurement)',
    'Reema Patel (Cyberdyne Security)',
    'Casey Morgan (Acme)',
  ],
  transcriptOrNotes: [
    'HELENA: To set context — the CRO has approved expansion to 80 seats. So the decision is made on our side, this conversation is about clearing security and procurement.',
    "REEMA: I have the SOC2 Type II. I need the DPA updated with our subprocessor language and confirmation that customer data isn't leaving the EU.",
    "CASEY: DPA edit is two-day turnaround on our side. Data residency — yes, EU-only is supported, I'll confirm in writing.",
    'NATE: Once those are done, our standard MSA amendment process is 7-10 business days. Helena wants this signed by mid-July.',
    "HELENA: Yes, mid-July is the target. Casey, your team has been good to work with — let's get this done.",
  ].join('\n\n'),
  repSubjectiveNotes:
    'Decision is made. This is execution-only. Security + DPA + MSA amendment, then signature.',
  nextStepAgreed: true,
  stakeholderAdded: true,
  pricingDiscussed: true,
  budgetDiscussed: true,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: true,
});

const cyberdyneSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Existing contract performed; expansion is the natural next step',
      evidence: 'Existing 20-seat contract performed; CRO wants to expand to 80.',
      source: 'rep_note',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Buyer compliments the working relationship at the close',
      evidence: 'your team has been good to work with',
      source: 'transcript',
      strength: 'medium',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Buyer-named signature target',
      evidence: 'Helena wants this signed by mid-July',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'CRO already approved expansion — confidence is established',
      evidence: 'the CRO has approved expansion to 80 seats',
      source: 'transcript',
      strength: 'strong',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Procurement and security in the same conversation actively scoping work',
      evidence: 'our standard MSA amendment process is 7-10 business days',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'DPA + data residency edits are a real but small gate',
      evidence: 'I need the DPA updated with our subprocessor language',
      source: 'transcript',
      strength: 'weak',
      dimension: 'risk',
    },
  ],
  missing_evidence: ['Final MSA amendment paper not yet exchanged.'],
};

const cyberdyneDiagnosis = makeDiagnosis({
  id: 'dx_seed_cyberdyne',
  workspaceId: WORKSPACE_ID,
  opportunityId: cyberdyneOpp.id,
  activityId: cyberdyneInteraction.id,
  signalExtraction: cyberdyneSignals,
  createdAt: ISO('2026-05-09T19:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'commercially_ready',
    readinessScore: 78,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 70, 'Existing contract performance is the implicit pain-validation.', [
        'Existing 20-seat contract performed',
      ]),
      dim('trust', 80, 'Established relationship; CRO and Finance both committed.', [
        'your team has been good to work with',
      ]),
      dim('urgency', 75, 'Mid-July signature target named by Finance.', [
        'Helena wants this signed by mid-July',
      ]),
      dim('solution_confidence', 85, 'CRO already approved expansion — high prior confidence.', [
        'the CRO has approved expansion to 80 seats',
      ]),
      dim('commitment', 75, 'Procurement and security actively engaged with scoped work.', [
        'our standard MSA amendment process is 7-10 business days',
      ]),
    ],
    primaryBlocker:
      'DPA subprocessor edit + data-residency confirmation in writing. Both are 2-day items.',
    secondaryBlocker: 'MSA amendment process is 7-10 business days on the buyer side.',
    pipelineRealityCheck: {
      crmStage: 'Proposal',
      outcome: 'under_projecting',
      level: 'low',
      reason:
        'CRM Proposal implies solution-confident, but commercial and procurement are both engaged with scoped work and a signature date. One stage of under-call.',
    },
    recommendedNextAction:
      'Send DPA edit and data-residency confirmation in writing by Wednesday. Confirm MSA amendment kickoff with Nate the same day.',
    whatNotToDoYet: [
      'Do not introduce additional commercial line items (services, premium tier) — close the expansion as scoped.',
    ],
    followUpSubject: 'DPA + data residency confirmation',
    followUpBody:
      "Helena, Reema, Nate,\n\nThanks for the time today. Two-day commitment from us on the DPA subprocessor edit; data-residency confirmation (EU-only) will come in writing in the same email. Once those land, Nate, happy to kick off the MSA amendment whenever you're ready.\n\nMid-July signature target noted — we're set up to hit it.\n\nCasey",
    managerCoachingNote:
      "Healthy late-funnel renewal-expansion. Rep should advance to Negotiation in the CRM; Proposal is under-calling. Watch the DPA turnaround — that's the only thing that can slip the date.",
  }),
});

// --- Deal 9: Soylent Corp — at-risk / regression (9th readiness state) ---
// The deal advanced to Proposal, then the champion left and the buyer went
// dark. Evidence shows regression — the new `at_risk` readiness state.

const soylentBuyer: MockBuyer = {
  id: 'buy_seed_soylent',
  workspaceId: WORKSPACE_ID,
  firstName: 'Devon',
  lastName: 'Reyes',
  title: 'VP of Sales',
  company: 'Soylent Corp',
  email: 'devon.reyes@soylent.example',
  linkedin: null,
  website: null,
  notes: 'Inherited the eval after the original champion (Marcus) left the company.',
  createdAt: ISO('2026-02-20T15:00:00Z'),
  updatedAt: ISO('2026-05-02T15:00:00Z'),
};

const soylentOpp = makeOpportunity({
  id: 'opp_seed_soylent',
  workspaceId: WORKSPACE_ID,
  buyerId: soylentBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Soylent Corp – forecasting overhaul',
  currentCrmStage: 'Proposal',
  opportunityValue: 96000,
  expectedCloseDate: '2026-06-15',
  knownPain: 'Forecast accuracy was the board-level driver — but the exec who owned it has left.',
  knownObjection: 'New VP has not re-committed to the project or the timeline.',
  dealNotes:
    'Was tracking well through Demo. Champion Marcus left in April; Devon inherited it and has gone quiet. Two unanswered follow-ups.',
  crmRecordId: 'HS-2236067977',
  atRisk: true,
  currentReadinessState: 'at_risk',
  currentReadinessScore: 34,
  currentAlignmentOutcome: 'over_projecting',
  currentAlignmentLevel: 'high',
  createdAt: ISO('2026-02-24T15:00:00Z'),
  updatedAt: recentIso(11), // last week — regressed, not in this week's set
});

const soylentActivity = makeActivity({
  id: 'act_seed_soylent_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: soylentOpp.id,
  activityType: 'email_thread',
  activityDate: ISO('2026-04-28T16:00:00Z'),
  participants: ['Devon Reyes (Soylent)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'CASEY (email 1): Hi Devon — congrats on picking up the forecasting project. Marcus and I had the proposal in good shape; happy to walk you through where things stand. Do you have 20 minutes this week?',
    'CASEY (email 2, 6 days later): Following up on the above — I know inheriting a project mid-flight is a lot. Even a quick async note on whether this is still a priority would help me support you the right way.',
    '[No reply to either email.]',
  ].join('\n\n'),
  repSubjectiveNotes:
    'Lost the champion. Devon has not engaged at all. The proposal is technically out but there is no one carrying it internally. This has regressed.',
  nextStepAgreed: false,
  stakeholderAdded: false,
  pricingDiscussed: true,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const soylentSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Original board-level pain may no longer have an internal owner',
      evidence:
        'Forecast accuracy was the board-level driver — but the exec who owned it has left.',
      source: 'rep_note',
      strength: 'medium',
      dimension: 'pain',
    },
  ],
  trust: [],
  urgency: [],
  solution_confidence: [],
  commitment: [],
  risk: [
    {
      signal: 'Champion departed mid-cycle',
      evidence: 'Champion Marcus left in April; Devon inherited it and has gone quiet.',
      source: 'rep_note',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'Buyer non-responsive across multiple follow-ups',
      evidence: '[No reply to either email.]',
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'New decision-maker has not re-committed to the project',
      evidence: 'New VP has not re-committed to the project or the timeline.',
      source: 'rep_note',
      strength: 'strong',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No engagement at all from the new decision-maker.',
    'No confirmation the project survived the leadership change.',
    'No re-validated timeline or next step.',
  ],
};

const soylentDiagnosis = makeDiagnosis({
  id: 'dx_seed_soylent',
  workspaceId: WORKSPACE_ID,
  opportunityId: soylentOpp.id,
  activityId: soylentActivity.id,
  signalExtraction: soylentSignals,
  createdAt: ISO('2026-05-02T16:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'at_risk',
    readinessScore: 34,
    confidence: 'medium',
    dimensionScores: [
      dim(
        'pain',
        40,
        'The pain was real, but its internal owner is gone — it may no longer be felt.',
        ['the exec who owned it has left'],
      ),
      dim(
        'trust',
        25,
        'The relationship was with the departed champion; no trust established with Devon.',
        ['Devon inherited it and has gone quiet'],
      ),
      dim(
        'urgency',
        20,
        'Any urgency left with the previous owner. No timeline has been re-confirmed.',
        ['New VP has not re-committed to the project or the timeline'],
      ),
      dim(
        'solution_confidence',
        30,
        'Solution confidence built earlier has not transferred to the new buyer.',
        ['no one carrying it internally'],
      ),
      dim(
        'commitment',
        15,
        'Commitment has collapsed — the proposal is out but unowned and unanswered.',
        ['[No reply to either email.]'],
      ),
    ],
    primaryBlocker:
      'The champion left and the new decision-maker has not engaged. The deal has regressed — it is no longer a live Proposal.',
    secondaryBlocker: 'No internal owner means the original pain may no longer be a priority.',
    pipelineRealityCheck: {
      crmStage: 'Proposal',
      outcome: 'over_projecting',
      level: 'high',
      reason:
        'CRM Proposal implies an active commercial evaluation, but the champion has left and the buyer has gone dark across two follow-ups. This deal has regressed and is at risk.',
    },
    recommendedNextAction:
      'Treat this as a re-open, not a follow-up. Use a break-up email or a Marcus-referral angle to get one reply from Devon and re-qualify whether the project still exists.',
    whatNotToDoYet: [
      'Do not chase the proposal — there is no one to receive it.',
      'Do not hold the close date; it is no longer real.',
      'Do not assume the project survived the re-org without confirmation.',
    ],
    followUpSubject: 'Should I close the file on the forecasting project?',
    followUpBody:
      "Hi Devon,\n\nI haven't heard back, which usually means one of two things — either the forecasting project lost priority when Marcus left, or it's just buried under everything else you inherited. Both are completely understandable.\n\nIf it's no longer a priority, just reply \"closed\" and I'll stop reaching out. If it isn't, I'll send a two-line summary of where Marcus and I left things so you can pick it up with zero ramp.\n\nEither answer helps.\n\nCasey",
    managerCoachingNote:
      'Soylent has regressed to at-risk: champion departed, buyer dark, proposal unowned. It should not be forecast at Proposal. Coach the rep to run a re-open play and either revive it with the new VP or close it lost — but stop reporting it as a live commercial deal.',
  }),
});

// --- Deal 10: Wayne — second opportunity for an existing buyer ---
// Lucia (wayneBuyer) already has the marketing-stack deal; this is a second,
// activity-less opportunity on a different product (1-Week Design Sprint).
// Demonstrates a buyer carrying multiple opportunities + a provisional,
// undiagnosed deal.

const wayneCopilotOpp = makeOpportunity({
  id: 'opp_seed_wayne_copilot',
  workspaceId: WORKSPACE_ID,
  buyerId: wayneBuyer.id,
  productId: PRODUCT_SPRINT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Wayne – design sprint trial',
  currentCrmStage: 'Qualified',
  opportunityValue: 24000,
  expectedCloseDate: null,
  knownPain:
    'Lucia wants to validate a new product direction with users before committing to a full build.',
  knownObjection: null,
  dealNotes: 'Spun out of the Wayne marketing-stack conversation. No discovery call booked yet.',
  // Carries a CRM Record ID but no activity — the M15 demo target: importing
  // an activity history file auto-joins to this deal and re-scores it from
  // provisional to a real readiness diagnosis.
  crmRecordId: 'HS-1618033988',
  createdAt: ISO('2026-05-11T15:00:00Z'),
  updatedAt: recentIso(9), // last week — provisional, awaiting an activity import
});

// --- Deal 11: Tendril (Jessie Roesch) — returning 6-Week MVP client ---
// A two-opportunity story for one buyer: a past 6-Week MVP engagement that was
// delivered (Closed Won, ~6 months ago), and a brand-new opportunity she opened
// by reaching out to book a scoping call about a second product. The new call is
// upcoming — the only genuinely new activity is her re-engagement email — so the
// new deal's readiness is "warm but early": high trust from the proven
// relationship, but little concrete readiness on the new scope yet. The old
// engagement's activity history is mirrored onto the new deal so its Activity tab
// shows the whole relationship in one place (activities are per-opportunity).

const jessieBuyer: MockBuyer = {
  id: 'buy_seed_jessie',
  workspaceId: WORKSPACE_ID,
  firstName: 'Jessie',
  lastName: 'Roesch',
  title: 'Founder & CEO',
  company: 'Tendril',
  email: 'jessie@tendril.io',
  linkedin: 'https://linkedin.com/in/jessie-roesch',
  website: 'https://tendril.io',
  notes:
    'Past 6-Week MVP client — delivered Dec 2025, launched to her design partners. Strong reference relationship. Returning for a second product build.',
  createdAt: ISO('2025-10-12T15:00:00Z'),
  updatedAt: ISO('2026-05-28T15:00:00Z'),
};

// The original engagement's activity history. Defined as a builder so the exact
// same four interactions can be attached to both the past Closed Won deal and
// (mirrored) the new returning-client deal.
function jessieHistoryActivities(opportunityId: string, idPrefix: string) {
  return [
    makeActivity({
      id: `${idPrefix}_discovery`,
      workspaceId: WORKSPACE_ID,
      opportunityId,
      activityType: 'video_meeting',
      activityDate: ISO('2025-10-14T16:00:00Z'),
      participants: ['Jessie Roesch (Tendril)', 'Casey Morgan (Launchpad Studio)'],
      transcriptOrNotes: [
        "JESSIE: I've got three design partners who've already told me they'll pay — but I'm non-technical and I have literally no way to build the thing they want.",
        'CASEY: So the demand is validated. The gap is purely getting a working product in front of them.',
        "JESSIE: Exactly. And I don't want to hire a dev shop that disappears for six months. I need something real in market fast, before these partners cool off.",
        "CASEY: That's what the 6-Week MVP is built for — fixed scope, fixed timeline, a launch-ready product at the end. Let me put a scope together.",
      ].join('\n\n'),
      repSubjectiveNotes:
        'Textbook fit for the 6-Week MVP: validated demand, non-technical founder, urgency from waiting design partners.',
      nextStepAgreed: true,
      stakeholderAdded: false,
      pricingDiscussed: false,
      budgetDiscussed: false,
      competitorDiscussed: false,
      implementationDiscussed: false,
      securityDiscussed: false,
    }),
    makeActivity({
      id: `${idPrefix}_scoping`,
      workspaceId: WORKSPACE_ID,
      opportunityId,
      activityType: 'video_meeting',
      activityDate: ISO('2025-10-21T16:00:00Z'),
      participants: ['Jessie Roesch (Tendril)', 'Casey Morgan (Launchpad Studio)'],
      transcriptOrNotes: [
        "CASEY: Here's the scope — core workflow, auth, and a billing hook, shipped in six weeks for a fixed $36,000.",
        'JESSIE: That timeline is exactly what I need. The fixed price is what sold me — I can take that number to the bank without a surprise.',
        'CASEY: And you own the code at the end, no lock-in.',
        "JESSIE: Let's do it. Send the agreement.",
      ].join('\n\n'),
      repSubjectiveNotes: 'Scope and fixed price accepted on the call. Sending the agreement.',
      nextStepAgreed: true,
      stakeholderAdded: false,
      pricingDiscussed: true,
      budgetDiscussed: true,
      competitorDiscussed: false,
      implementationDiscussed: true,
      securityDiscussed: false,
    }),
    makeActivity({
      id: `${idPrefix}_kickoff`,
      workspaceId: WORKSPACE_ID,
      opportunityId,
      activityType: 'call',
      activityDate: ISO('2025-11-06T16:00:00Z'),
      participants: ['Jessie Roesch (Tendril)', 'Casey Morgan (Launchpad Studio)'],
      transcriptOrNotes: [
        'JESSIE: Signed and sent the deposit this morning. When can we start?',
        "CASEY: Monday. Week one is design, you'll see clickable screens by Friday.",
        "JESSIE: Perfect. My partners are expecting a demo before the holidays — let's hit that.",
      ].join('\n\n'),
      repSubjectiveNotes: 'Signed, deposit in, kickoff Monday. Committed and motivated.',
      nextStepAgreed: true,
      stakeholderAdded: false,
      pricingDiscussed: false,
      budgetDiscussed: false,
      competitorDiscussed: false,
      implementationDiscussed: true,
      securityDiscussed: false,
    }),
    makeActivity({
      id: `${idPrefix}_delivery`,
      workspaceId: WORKSPACE_ID,
      opportunityId,
      activityType: 'video_meeting',
      activityDate: ISO('2025-12-19T16:00:00Z'),
      participants: ['Jessie Roesch (Tendril)', 'Casey Morgan (Launchpad Studio)'],
      transcriptOrNotes: [
        "CASEY: That's the full MVP — live, on your domain, billing connected.",
        "JESSIE: This is exactly what I pitched my design partners. We're launching to them Monday.",
        "CASEY: Everything's documented and the code is in your repo. You're free to take it from here or bring us back when you need to.",
        "JESSIE: Honestly this was the best money I've spent as a founder. I'll be back.",
      ].join('\n\n'),
      repSubjectiveNotes:
        'Delivered on time. Jessie thrilled — explicit reference + repeat-business intent. Strong relationship to maintain.',
      nextStepAgreed: false,
      stakeholderAdded: false,
      pricingDiscussed: false,
      budgetDiscussed: false,
      competitorDiscussed: false,
      implementationDiscussed: true,
      securityDiscussed: false,
    }),
  ];
}

// Past engagement — Closed Won, delivered Dec 2025.
const jessieMvpOpp = makeOpportunity({
  id: 'opp_seed_jessie_mvp',
  workspaceId: WORKSPACE_ID,
  buyerId: jessieBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Tendril – 6-Week MVP build',
  currentCrmStage: 'Closed Won',
  opportunityValue: 36000,
  expectedCloseDate: '2025-11-07',
  knownPain:
    'Non-technical founder with validated demand (three paying design partners waiting) but no way to ship a product.',
  knownObjection: null,
  dealNotes:
    'Delivered the MVP on 2025-12-19 and launched to her first design partners. Strong reference relationship.',
  crmRecordId: 'HS-3141592653',
  currentReadinessState: 'commit_ready',
  currentReadinessScore: 92,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  closedStatus: 'closed_won',
  createdAt: ISO('2025-10-12T15:00:00Z'),
  updatedAt: ISO('2025-12-19T15:00:00Z'),
});

const jessieMvpHistory = jessieHistoryActivities(jessieMvpOpp.id, 'act_seed_jessie_mvp');

const jessieMvpSignals: SignalExtraction = {
  pain: [
    {
      signal: 'Validated demand the founder cannot fulfill without a product',
      evidence: "three design partners who've already told me they'll pay — but I'm non-technical",
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Founder names the engagement her best founder spend',
      evidence: "this was the best money I've spent as a founder. I'll be back.",
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Waiting design partners create a real launch deadline',
      evidence: 'My partners are expecting a demo before the holidays',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Fixed scope + fixed price removed the perceived risk',
      evidence: 'The fixed price is what sold me — I can take that number to the bank',
      source: 'transcript',
      strength: 'strong',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Signed, deposit paid, kickoff scheduled',
      evidence: 'Signed and sent the deposit this morning. When can we start?',
      source: 'transcript',
      strength: 'strong',
      dimension: 'commitment',
    },
  ],
  risk: [],
  missing_evidence: [],
};

const jessieMvpDiagnosis = makeDiagnosis({
  id: 'dx_seed_jessie_mvp',
  workspaceId: WORKSPACE_ID,
  opportunityId: jessieMvpOpp.id,
  activityId: 'act_seed_jessie_mvp_delivery',
  signalExtraction: jessieMvpSignals,
  createdAt: ISO('2025-12-19T17:30:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'commit_ready',
    readinessScore: 92,
    confidence: 'high',
    dimensionScores: [
      dim(
        'pain',
        90,
        'Validated, acute pain — paying partners waiting on a product she could not build.',
        ["three design partners who've already told me they'll pay"],
      ),
      dim(
        'trust',
        95,
        'Trust fully earned through delivery; explicit reference and repeat intent.',
        ["best money I've spent as a founder. I'll be back."],
      ),
      dim('urgency', 80, 'A real launch deadline drove the timeline throughout.', [
        'My partners are expecting a demo before the holidays',
      ]),
      dim('solution_confidence', 92, 'Fixed scope + fixed price gave her confidence to commit.', [
        'The fixed price is what sold me',
      ]),
      dim('commitment', 95, 'Signed, paid, delivered, launched — full commitment realized.', [
        'Signed and sent the deposit this morning',
      ]),
    ],
    primaryBlocker: null,
    secondaryBlocker: null,
    pipelineRealityCheck: {
      crmStage: 'Closed Won',
      outcome: 'aligned',
      level: 'none',
      reason:
        'Closed Won implies commit-ready, and the deal was signed, delivered, and launched. Fully aligned — a completed, delivered engagement.',
    },
    recommendedNextAction:
      'Keep the relationship warm post-delivery: check in after her launch and stay top-of-mind for the next build.',
    whatNotToDoYet: [],
    followUpSubject: 'Congrats on the launch — here when you need the next build',
    followUpBody:
      "Hi Jessie,\n\nHuge congrats on getting this in front of your design partners — you earned it.\n\nEverything's documented and the code is yours. When you're ready for the next thing — a v2, a new module, whatever's next — I'd love to run it back.\n\nGo enjoy the launch.\n\nCasey",
    managerCoachingNote:
      'Model engagement: clean fit, fixed-scope sell, delivered on time, delighted reference customer. This is exactly the relationship to mine for repeat business.',
  }),
});

// New engagement — she reached out 2026-05-28 to book a scoping call about a
// second product. Call is upcoming (not held yet). Stage: Qualified.
const jessieReturnOpp = makeOpportunity({
  id: 'opp_seed_jessie_return',
  workspaceId: WORKSPACE_ID,
  buyerId: jessieBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Tendril – second product MVP (returning client)',
  currentCrmStage: 'Qualified',
  opportunityValue: 42000,
  expectedCloseDate: '2026-07-15',
  knownPain:
    'Tendril is expanding into a second product line; Jessie wants to run the same 6-Week MVP playbook for the new module.',
  knownObjection: null,
  dealNotes:
    'Returning 6-Week MVP client. Emailed 2026-05-28 to book a scoping call about a new project — call upcoming, not held yet. Moved straight to Qualified given the proven relationship.',
  crmRecordId: 'HS-2653589793',
  currentReadinessState: 'diagnosis_aligned',
  currentReadinessScore: 52,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  createdAt: ISO('2026-05-28T15:00:00Z'),
  updatedAt: recentIso(5), // earlier this week — returning client re-engaged
});

// Mirrored copies of the original engagement's history (new IDs, pointing at the
// returning deal) so the new opportunity's Activity tab shows the full relationship.
const jessieReturnHistory = jessieHistoryActivities(jessieReturnOpp.id, 'act_seed_jessie_rtn_hist');

// The one genuinely new activity on the returning deal — her inbound re-engagement.
const jessieReturnEmail = makeActivity({
  id: 'act_seed_jessie_rtn_email',
  workspaceId: WORKSPACE_ID,
  opportunityId: jessieReturnOpp.id,
  activityType: 'email_thread',
  activityDate: ISO('2026-05-28T14:00:00Z'),
  participants: ['Jessie Roesch (Tendril)', 'Casey Morgan (Launchpad Studio)'],
  transcriptOrNotes: [
    'JESSIE: Casey! The MVP you built has been carrying us — we closed our seed round on the back of it, partly thanks to that product.',
    "JESSIE: We've validated a second module our customers are asking for, and I want to run the exact same playbook. Same fixed-scope, fixed-timeline approach.",
    "JESSIE: I don't have the scope nailed down yet — that's what I want to work through with you. Can we grab time next week?",
    "CASEY: Congrats on the round! Absolutely — booked us for next Tuesday. I'll come with a few questions to shape the scope.",
  ].join('\n\n'),
  repSubjectiveNotes:
    'Warm inbound from a delighted past client. Booked a scoping call for next week. New scope is undefined — discovery still to come.',
  nextStepAgreed: true,
  stakeholderAdded: false,
  pricingDiscussed: false,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const jessieReturnSignals: SignalExtraction = {
  pain: [
    {
      signal: 'A validated second product line, but scope not yet defined',
      evidence: "We've validated a second module our customers are asking for",
      source: 'transcript',
      strength: 'medium',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Proven delivery relationship; credits the prior MVP for the seed round',
      evidence: 'we closed our seed round on the back of it',
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'No deadline or forcing function on the new build yet',
      evidence: "I don't have the scope nailed down yet",
      source: 'transcript',
      strength: 'weak',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Wants to repeat the proven fixed-scope playbook',
      evidence: 'I want to run the exact same playbook',
      source: 'transcript',
      strength: 'medium',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [
    {
      signal: 'Booked a scoping call, but no scope, terms, or timeline agreed',
      evidence: "that's what I want to work through with you. Can we grab time next week?",
      source: 'transcript',
      strength: 'weak',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'Scope undefined — the discovery call has not happened yet',
      evidence: 'Scope not yet defined',
      source: 'checklist',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'New project scope is undefined pending the upcoming scoping call.',
    'No budget or timeline confirmed for the new build.',
    'No commercial terms discussed yet.',
  ],
};

const jessieReturnDiagnosis = makeDiagnosis({
  id: 'dx_seed_jessie_return',
  workspaceId: WORKSPACE_ID,
  opportunityId: jessieReturnOpp.id,
  activityId: jessieReturnEmail.id,
  signalExtraction: jessieReturnSignals,
  createdAt: ISO('2026-05-28T15:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'diagnosis_aligned',
    readinessScore: 52,
    confidence: 'medium',
    dimensionScores: [
      dim(
        'pain',
        55,
        'A real, validated need for a second product — but the problem is not yet scoped.',
        ["We've validated a second module our customers are asking for"],
      ),
      dim(
        'trust',
        88,
        'Exceptional trust from a delivered prior engagement she credits for her seed round.',
        ['we closed our seed round on the back of it'],
      ),
      dim('urgency', 30, 'No deadline or forcing function on the new build; exploratory timing.', [
        "I don't have the scope nailed down yet",
      ]),
      dim(
        'solution_confidence',
        60,
        'High confidence in the studio specifically — wants to repeat the playbook.',
        ['I want to run the exact same playbook'],
      ),
      dim('commitment', 35, 'Booked a scoping call only; no scope, budget, or terms agreed yet.', [
        'Can we grab time next week?',
      ]),
    ],
    primaryBlocker:
      'New project scope is undefined — the discovery/scoping call has not happened yet. Readiness rests almost entirely on relationship trust, not on the new deal.',
    secondaryBlocker: 'No timeline or commercial terms for the new build.',
    pipelineRealityCheck: {
      crmStage: 'Qualified',
      outcome: 'aligned',
      level: 'none',
      reason:
        'Qualified implies problem-aware; she sits a notch higher at diagnosis-aligned thanks to the proven relationship — comfortably within range, no over- or under-call.',
    },
    recommendedNextAction:
      'Run the scoping call as a proper discovery: pin down the second-product scope, the customer demand behind it, and any launch timeline before reusing the fixed-price model.',
    whatNotToDoYet: [
      'Do not send a fixed price before the new scope is defined — last time the scope justified the number.',
      'Do not assume the prior urgency carries over; this build has no deadline yet.',
    ],
    followUpSubject: 'Looking forward to Tuesday — a few scoping questions',
    followUpBody:
      "Hi Jessie,\n\nSo glad the first build helped get the round done — that's the best outcome I could ask for.\n\nBefore Tuesday, a couple of things to mull so we make the most of the call: who's asking for the second module and how loudly, and is there any date you're trying to hit? That'll let us scope tightly and, if it fits, reuse the same fixed-price model.\n\nTalk soon,\nCasey",
    managerCoachingNote:
      'Warm returning client — trust is sky-high but the new deal is barely scoped. Coach the rep not to coast on the relationship: treat the scoping call as real discovery, or risk under-scoping a fixed-price build on goodwill alone.',
  }),
});

// Pre-call intelligence for the upcoming scoping call — the highlight while the
// new deal has no held conversation yet.
const jessiePsychProfile: PsychProfile = {
  disc: { d: 68, i: 81, s: 47, c: 35, primaryType: 'I' },
  ocean: { o: 82, c: 64, e: 76, a: 70, n: 31 },
  summary:
    'Jessie is a warm, visionary founder who buys on relationship and momentum. She is decisive and enthusiastic, not process-heavy — she already trusts you. Lead with shared excitement about the new product, then gently steer her into the specifics; her instinct is to skip scoping because she trusts the outcome.',
};

const jessieScript: GeneratedScript = {
  basedOnTemplateId: 'scr_seed_discovery',
  technique: 'nepq',
  sections: [
    {
      heading: 'Connect on the win',
      body: 'Open on the seed round and the first launch — genuine, brief. The relationship is the asset; acknowledge it, then pivot to what is new.',
    },
    {
      heading: 'Diagnose the new problem',
      body: 'Ask who is asking for the second module and how loudly. Draw out the real customer demand rather than accepting "we should build it" — she trusts you enough to skip this, so you have to insist gently.',
    },
    {
      heading: 'Surface the consequence + timeline',
      body: 'Ask what happens if it slips a quarter, and whether anything external is forcing a date. This is the urgency the email is missing — find it or confirm there is not one.',
    },
    {
      heading: 'Frame the next step',
      body: 'Only once scope and demand are clear, reuse the fixed-scope, fixed-price model she already loves. Agree a dated path to a written scope — do not quote a price on the call.',
    },
  ],
};

const jessieReturnPrecall: MockPrecallIntelligence = {
  id: 'pci_seed_jessie_return',
  opportunityId: jessieReturnOpp.id,
  psychProfile: jessiePsychProfile,
  matchedTechnique: {
    technique: 'nepq',
    reasoning:
      'High-I, relationship-driven returning buyer with sky-high trust but an undefined new scope. NEPQ — neuro-emotional, question-led, low-pressure — fits a warm client who will happily skip discovery; its diagnostic questions force the scoping the deal actually needs without straining the relationship.',
  },
  generatedScript: jessieScript,
  generatedAt: ISO('2026-05-28T16:00:00Z'),
};

// --- Unassigned buyers ---
// People in the workspace with no opportunity yet — typically added by the
// Daily Workbench import before a product is assigned. They give the workbench
// "unassigned buyers" banner and the /buyers assignment flow (M13) content.

const unassignedBuyers: MockBuyer[] = [
  {
    id: 'buy_seed_unassigned_umbrella',
    workspaceId: WORKSPACE_ID,
    firstName: 'Priyanka',
    lastName: 'Shah',
    title: 'Head of Revenue Operations',
    company: 'Umbrella Logistics',
    email: 'priyanka.shah@umbrella.example',
    linkedin: null,
    website: null,
    notes: 'From the May 12 workbench import. No product assigned yet.',
    createdAt: ISO('2026-05-12T09:00:00Z'),
    updatedAt: ISO('2026-05-12T09:00:00Z'),
  },
  {
    id: 'buy_seed_unassigned_tyrell',
    workspaceId: WORKSPACE_ID,
    firstName: 'Marcus',
    lastName: 'Webb',
    title: 'Director of Sales',
    company: 'Tyrell Systems',
    email: 'marcus.webb@tyrell.example',
    linkedin: null,
    website: null,
    notes: 'From the May 12 workbench import. No product assigned yet.',
    createdAt: ISO('2026-05-12T09:00:00Z'),
    updatedAt: ISO('2026-05-12T09:00:00Z'),
  },
  {
    id: 'buy_seed_unassigned_oscorp',
    workspaceId: WORKSPACE_ID,
    firstName: 'Tasha',
    lastName: 'Lin',
    title: 'VP Sales',
    company: 'Oscorp Industries',
    email: 'tasha.lin@oscorp.example',
    linkedin: null,
    website: null,
    notes: 'From the May 12 workbench import. No product assigned yet.',
    createdAt: ISO('2026-05-12T09:00:00Z'),
    updatedAt: ISO('2026-05-12T09:00:00Z'),
  },
];

// --- Script templates ---
// Reusable, workspace-level call-script templates (managed on the M16 Scripts
// page). One primary; pre-call scripts are generated from these per opportunity.

const scriptTemplates: MockScriptTemplate[] = [
  {
    id: 'scr_seed_discovery',
    workspaceId: WORKSPACE_ID,
    name: 'Discovery call — readiness-first',
    isPrimary: true,
    content: [
      'OPEN: Thank them for the time. State the one outcome you want from the call.',
      '',
      'DIAGNOSE: Ask what triggered them to look now. Quantify the cost of the status quo.',
      '',
      'STAKEHOLDERS: Map who else has to be bought in before a decision.',
      '',
      'NEXT STEP: Propose a concrete, dated next step before ending the call.',
    ].join('\n'),
    createdAt: ISO('2026-02-02T15:00:00Z'),
    updatedAt: ISO('2026-04-18T15:00:00Z'),
  },
  {
    id: 'scr_seed_demo_followup',
    workspaceId: WORKSPACE_ID,
    name: 'Post-demo follow-up call',
    isPrimary: false,
    content: [
      'RECAP: Restate the specific pain the demo addressed — in their words.',
      '',
      'OBJECTIONS: Surface hesitation directly. Ask what would have to be true to move forward.',
      '',
      'COMMERCIAL: Only if solution confidence is real — outline pricing and process.',
    ].join('\n'),
    createdAt: ISO('2026-03-01T15:00:00Z'),
    updatedAt: ISO('2026-03-01T15:00:00Z'),
  },
];

// --- Pre-call intelligence ---
// DISC/OCEAN profile + matched sales technique + generated pre-call script,
// keyed by opportunity. Consumed by the M17 Opportunity Detail Overview tab.

const starkPsychProfile: PsychProfile = {
  disc: { d: 86, i: 54, s: 22, c: 61, primaryType: 'D' },
  ocean: { o: 58, c: 79, e: 71, a: 38, n: 24 },
  summary:
    'Priya is a decisive, results-driven economic buyer. She values directness and a clear business case over relationship-building. Lead with outcomes and ROI; do not pad the conversation.',
};

const starkScript: GeneratedScript = {
  basedOnTemplateId: 'scr_seed_discovery',
  technique: 'challenger',
  sections: [
    {
      heading: 'Open with a point of view',
      body: 'Skip the rapport. Open with the 31% forecast-call change the pilot proved, and frame the expansion as protecting that result at scale.',
    },
    {
      heading: 'Reframe the procurement objection',
      body: 'Acknowledge the 2-year-term ask, then reframe: the risk is not price, it is leaving 150 seats un-coached for another quarter. Tie the term to the outcome, not the discount.',
    },
    {
      heading: 'Close on the gate',
      body: 'Priya is the economic buyer — confirm procurement is the only remaining gate and agree a dated path through it before ending the call.',
    },
  ],
};

const starkPrecall: MockPrecallIntelligence = {
  id: 'pci_seed_stark',
  opportunityId: starkOpp.id,
  psychProfile: starkPsychProfile,
  matchedTechnique: {
    technique: 'challenger',
    reasoning:
      'High-D economic buyer in a late-stage expansion. A Challenger approach — teach, tailor, take control — fits a decisive buyer who responds to a strong point of view, not consensus-building.',
  },
  generatedScript: starkScript,
  generatedAt: ISO('2026-05-11T15:00:00Z'),
};

const waynePsychProfile: PsychProfile = {
  disc: { d: 34, i: 41, s: 58, c: 83, primaryType: 'C' },
  ocean: { o: 66, c: 81, e: 44, a: 62, n: 35 },
  summary:
    'Lucia is analytical and detail-oriented. She wants evidence, methodology, and a low-risk path. Bring data and a structured plan; rushing her or skipping detail will erode trust.',
};

const wayneScript: GeneratedScript = {
  basedOnTemplateId: 'scr_seed_discovery',
  technique: 'spin',
  sections: [
    {
      heading: 'Situation & Problem',
      body: 'Walk through the two reporting tools and quantify how often marketing-attributed pipeline disagrees. Let her supply the numbers.',
    },
    {
      heading: 'Implication',
      body: 'Draw out the downstream cost: which forecast decisions get made on the wrong number, and what that has cost a quarter.',
    },
    {
      heading: 'Need-payoff',
      body: 'Have her articulate the value of a single trusted readiness number. Then scope a low-risk pilot — she already asked about pilot scope.',
    },
  ],
};

const waynePrecall: MockPrecallIntelligence = {
  id: 'pci_seed_wayne',
  opportunityId: wayneOpp.id,
  psychProfile: waynePsychProfile,
  matchedTechnique: {
    technique: 'spin',
    reasoning:
      'High-C analytical buyer mid-funnel. SPIN — Situation, Problem, Implication, Need-payoff — fits a buyer who needs to reason her own way to the value before committing.',
  },
  generatedScript: wayneScript,
  generatedAt: ISO('2026-05-09T15:00:00Z'),
};

// --- Import mappings ---
// A saved, reusable column-mapping config for the Daily Workbench import (M14).

const importMappings: MockImportMapping[] = [
  {
    id: 'imp_seed_hubspot_deals',
    workspaceId: WORKSPACE_ID,
    name: 'HubSpot — deal export',
    crmType: 'hubspot',
    fields: [
      { sourceColumn: 'Deal Name', targetField: 'opportunity_name' },
      { sourceColumn: 'Deal Stage', targetField: 'current_crm_stage' },
      { sourceColumn: 'Amount', targetField: 'opportunity_value' },
      { sourceColumn: 'Close Date', targetField: 'expected_close_date' },
      { sourceColumn: 'Associated Contact', targetField: 'buyer_first_name' },
      { sourceColumn: 'Company', targetField: 'buyer_company' },
      { sourceColumn: 'Record ID', targetField: 'crm_record_id' },
      { sourceColumn: 'Owner', targetField: null },
    ],
    createdAt: ISO('2026-05-12T09:00:00Z'),
    updatedAt: ISO('2026-05-12T09:00:00Z'),
  },
];

// --- Compose ---

export function buildSeed(): HydrateInput {
  return {
    workspaces: [workspace],
    products: [product, productSprint, productTechPlan, productStrategy, productShipIt],
    buyers: [
      globexBuyer,
      initechBuyer,
      wayneBuyer,
      starkBuyer,
      hooliBuyer,
      massiveDynamicBuyer,
      cyberdyneBuyer,
      soylentBuyer,
      jessieBuyer,
      ...unassignedBuyers,
    ],
    opportunities: [
      globexOpp,
      initechOpp,
      wayneOpp,
      starkOpp,
      hooliOpp,
      massiveDynamicOpp,
      cyberdyneOpp,
      soylentOpp,
      wayneCopilotOpp,
      jessieMvpOpp,
      jessieReturnOpp,
    ],
    activities: [
      globexInteraction,
      initechInteraction,
      wayneInteraction,
      starkInteraction,
      hooliInteraction,
      massiveDynamicInt1,
      massiveDynamicInt2,
      cyberdyneInteraction,
      soylentActivity,
      ...jessieMvpHistory,
      ...jessieReturnHistory,
      jessieReturnEmail,
    ],
    diagnoses: [
      globexDiagnosis,
      initechDiagnosis,
      wayneDiagnosis,
      starkDiagnosis,
      hooliDiagnosis,
      massiveDynamicInt1Diagnosis,
      massiveDynamicDiagnosis,
      cyberdyneDiagnosis,
      soylentDiagnosis,
      jessieMvpDiagnosis,
      jessieReturnDiagnosis,
    ],
    outcomes: [],
    scriptTemplates,
    precallIntelligence: [starkPrecall, waynePrecall, jessieReturnPrecall],
    importMappings,
  };
}
