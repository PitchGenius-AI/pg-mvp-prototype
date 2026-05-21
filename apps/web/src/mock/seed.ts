import type { GeneratedScript, PsychProfile, SignalExtraction } from '@pg/shared';
import type {
  HydrateInput,
} from './store';
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
const PRODUCT_ID = 'prod_seed_pulse';
const ISO = (d: string) => new Date(d).toISOString();

export const SEED_USER: MockUser = {
  id: USER_ID,
  name: 'Casey Morgan',
  email: 'casey@acmesales.co',
};

const workspace: MockWorkspace = {
  id: WORKSPACE_ID,
  name: 'Acme Sales Co',
  website: 'https://acmesales.co',
  industry: 'SaaS — Sales Intelligence',
  crmStageTemplate: 'simple_b2b_sales',
  customCrmStages: null,
  crmType: 'hubspot',
  subscriptionStatus: 'active',
  createdByUserId: USER_ID,
  onboardingCompleted: true,
  createdAt: ISO('2026-02-01T15:00:00Z'),
  updatedAt: ISO('2026-05-12T15:00:00Z'),
};

// Multiple products per workspace, one primary (Pulse). The primary is the
// default product context for new opportunities.
const product: MockProduct = {
  id: PRODUCT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Pulse',
  description:
    'Pulse is a pipeline-intelligence platform that scores every B2B deal on buyer readiness using meeting evidence (transcripts, notes, checklists) and flags the deals reps are over-calling before forecast day.',
  targetBuyer:
    'VP of Sales, Head of RevOps, and Sales Operations leaders at 100-1,000 person SaaS companies with multi-rep teams and unreliable forecasting.',
  problemSolved:
    'Reps habitually advance deals through CRM stages without enough buyer-side evidence, which inflates the forecast. Pulse compares CRM stage to evidence-based readiness and surfaces dangerous mismatches before they cost the quarter.',
  isPrimary: true,
  createdAt: ISO('2026-02-01T15:00:00Z'),
  updatedAt: ISO('2026-02-01T15:00:00Z'),
};

const PRODUCT_SIGNAL_ID = 'prod_seed_signal';
const PRODUCT_BRIEF_ID = 'prod_seed_brief';

// A second product — same workspace, not primary. Gives the multi-product
// surfaces (M16 Products page, intake product picker) real content.
const productSignal: MockProduct = {
  id: PRODUCT_SIGNAL_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Signal',
  description:
    'Signal is a real-time call co-pilot that transcribes live sales conversations and surfaces the next question a rep should ask, matched to the buyer.',
  targetBuyer:
    'Individual account executives and SDRs who run a high volume of discovery and demo calls and want in-the-moment coaching.',
  problemSolved:
    'Reps miss buying signals and forget to ask the qualifying questions that decide a deal. Signal listens to the live call and prompts the rep in real time.',
  isPrimary: false,
  createdAt: ISO('2026-03-15T15:00:00Z'),
  updatedAt: ISO('2026-03-15T15:00:00Z'),
};

// A third product — added recently, no opportunities yet.
const productBrief: MockProduct = {
  id: PRODUCT_BRIEF_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Brief',
  description:
    'Brief generates a one-page pre-call intelligence sheet — buyer psychology, matched technique, and a tailored script — before every meeting.',
  targetBuyer:
    'Sales managers who want their reps walking into every call prepared without an hour of manual research.',
  problemSolved:
    'Reps wing their calls or spend too long prepping. Brief produces the prep automatically from enrichment data.',
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
  updatedAt: ISO('2026-05-08T15:00:00Z'),
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
    'JAMIE: Yeah, about that. I want to be straight with you — I haven\'t actually pulled the team together yet on whether we\'re replacing or just renegotiating the current contract. So I\'m not sure what next step looks like on my side.',
    'CASEY: Got it. Who needs to be in that room?',
    'JAMIE: Probably me, our VP of Marketing, and someone from Finance. We haven\'t talked about budget for this; I assumed if it came in under what we pay today it\'d be a no-brainer.',
    'CASEY: Makes sense. Want me to send the comparison deck so you can share it ahead of that conversation?',
    'JAMIE: Sure. No promises on timing — we\'re also dealing with a re-org so this might slip a month.',
  ].join('\n\n'),
  repSubjectiveNotes:
    'Feels stuck. Jamie is friendly but I don\'t think she has authority. Need to get marketing VP in the room.',
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
        "I want to be straight with you",
      ]),
      dim('urgency', 30, 'External July deadline exists but buyer signals it can slip.', [
        'this might slip a month',
      ]),
      dim(
        'solution_confidence',
        20,
        'No solution-confidence signals — buyer has not even decided to replace vs renegotiate.',
        ["I haven't actually pulled the team together yet on whether we're replacing or just renegotiating"],
      ),
      dim('commitment', 10, 'Zero commitment evidence. No next step, no stakeholders, no decision date.', [
        'No promises on timing',
      ]),
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
  updatedAt: ISO('2026-05-10T15:00:00Z'),
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
    'Hey Casey — sorry for the radio silence. We got your proposal and the other vendor\'s side by side last week. Honestly the team has been pulled into the new ERP rollout so this hasn\'t been front of mind. I\'ll be straight: I like Pulse better but I haven\'t had the bandwidth to put together a recommendation for the CFO yet, and procurement hasn\'t opened a ticket on our side.',
    'Can we push the close target back two weeks while I get this in front of the right people?',
  ].join('\n\n'),
  repSubjectiveNotes:
    'Good news he prefers us. Bad news: no procurement, no CFO ask, no real next step. I marked it Proposal because we sent the proposal but he\'s not actually evaluating.',
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
      evidence: "I like Pulse better",
      source: 'transcript',
      strength: 'strong',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Competing internal initiative (ERP rollout) is consuming bandwidth',
      evidence: 'the team has been pulled into the new ERP rollout so this hasn\'t been front of mind',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Preference stated, but no decision-confidence language',
      evidence: "I like Pulse better but I haven't had the bandwidth to put together a recommendation",
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
      dim('pain', 70, 'Real, recurring pain (late board reporting) and it lives in Marcus\' world.', [
        'Quarterly board reporting has been late three quarters running.',
      ]),
      dim('trust', 75, 'Marcus is candid and explicitly prefers us — trust is healthy.', [
        "I like Pulse better",
      ]),
      dim('urgency', 30, 'ERP rollout is crowding out this work; no internal urgency.', [
        "the team has been pulled into the new ERP rollout",
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
    secondaryBlocker:
      'ERP rollout is the buyer\'s real priority for the next few weeks.',
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
  dealNotes: 'Discovery and demo went well. Lucia is the strategic owner and asked about pilot scope.',
  crmRecordId: 'HS-2718281828',
  currentReadinessState: 'solution_curious',
  currentReadinessScore: 58,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  createdAt: ISO('2026-04-03T15:00:00Z'),
  updatedAt: ISO('2026-05-09T15:00:00Z'),
});

const wayneInteraction = makeActivity({
  id: 'int_seed_wayne_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: wayneOpp.id,
  activityType: 'demo',
  activityDate: ISO('2026-05-09T16:00:00Z'),
  participants: ['Lucia Ortiz (Wayne)', 'Devon Mills (Wayne, Sales Ops)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'CASEY: So that\'s the readiness scoring layered over your existing pipeline view. Curious what stood out.',
    'LUCIA: The dimension breakdown is exactly the conversation I keep trying to have with our reps — they\'ll say a deal is "almost there" and I can\'t articulate what\'s missing. This puts a name on it.',
    'DEVON: How disruptive is implementation? We\'re mid-quarter and I can\'t pull engineering for anything heavy.',
    'CASEY: Light. We\'re a Chrome extension plus a Salesforce package. Most teams are running in under two days, no engineering needed.',
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
      dim('pain', 75, 'Pain is articulated in the buyer\'s own words and tied to a recurring frustration.', [
        "they'll say a deal is \"almost there\" and I can't articulate what's missing",
      ]),
      dim('trust', 70, 'Lucia is enthusiastic; trust is healthy and growing.', [
        'exactly the conversation I keep trying to have with our reps',
      ]),
      dim('urgency', 45, 'No external forcing function; quarter-end is a constraint, not a deadline.', [
        "We're mid-quarter and I can't pull engineering",
      ]),
      dim('solution_confidence', 60, 'Pilot framing emerged and implementation concern was answered.', [
        'a 6-seat pilot for 90 days',
      ]),
      dim('commitment', 55, 'Concrete next step + new stakeholder added — early commitment evidence.', [
        'loop in Devon so we have the technical lens too',
      ]),
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
      'Healthy mid-funnel deal. Rep should focus on getting the economic buyer named before the pilot starts — common trap is letting the pilot run, succeed, and then discovering there\'s no commercial path.',
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
  dealNotes: 'Pilot ran Q1. CRO Priya is the champion and the economic buyer. Procurement is the last gate.',
  crmRecordId: 'HS-1123581321',
  currentReadinessState: 'commit_ready',
  currentReadinessScore: 86,
  currentAlignmentOutcome: 'aligned',
  currentAlignmentLevel: 'none',
  createdAt: ISO('2026-01-22T15:00:00Z'),
  updatedAt: ISO('2026-05-12T15:00:00Z'),
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
    'CASEY: I can do the 2-year at the 1-year price if there\'s no opt-out — that\'s how we model the discount. Happy to write a 30-day mutual termination for cause if that helps.',
    'MIKE: Let me take that back. If you can have paper to us by Friday we can be signed by month-end.',
    'PRIYA: Casey, what does kickoff look like? I want to make sure the wider team is using this within two weeks of signature.',
    'CASEY: Two-day onboarding workshop, then weekly office hours for the first month. I\'ll send the rollout plan with the paper.',
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
      dim('solution_confidence', 90, 'Pilot evidence is the strongest possible confidence signal.', [
        'we recovered two deals my team was going to lose blind',
      ]),
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
        'CRM Negotiation implies commit-ready, which matches the buyer\'s state exactly. The forecast call is sound.',
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
  dealNotes: 'Tomas ran his own POC with the trial. Already loops in his RevOps team without prompting.',
  currentReadinessState: 'solution_confident',
  currentReadinessScore: 71,
  currentAlignmentOutcome: 'under_projecting',
  currentAlignmentLevel: 'medium',
  createdAt: ISO('2026-04-27T15:00:00Z'),
  updatedAt: ISO('2026-05-11T15:00:00Z'),
});

const hooliInteraction = makeActivity({
  id: 'int_seed_hooli_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: hooliOpp.id,
  activityType: 'call',
  activityDate: ISO('2026-05-11T15:00:00Z'),
  participants: ['Tomas Vogel (Hooli)', 'Sarah Wu (Hooli, RevOps)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'TOMAS: I\'ve had a chance to actually run Pulse on three of our deals. The readiness scoring matches what my best AE would have said on every one — and it caught two deals that our CRM had at Negotiation but were really at Discovery.',
    'CASEY: That\'s the use case. How do you want to take it from here?',
    'TOMAS: I want to roll it to the full team. Sarah and I have a meeting with the CFO on the 21st — that\'s the budget approval. Before that I need a one-pager on year-one ROI and a 90-day rollout plan I can hand him.',
    'SARAH: And what does security want from us? We\'re mid-SOC2 audit, can\'t blow that up.',
    'CASEY: SOC2 Type II report and DPA, both in our trust center. Want me to send links?',
    'TOMAS: Send them and copy our security lead. If the CFO meeting goes well on the 21st I want to be in paper the following week.',
  ].join('\n\n'),
  repSubjectiveNotes:
    'Tomas is way further along than I marked him. He\'s already done the eval; this is a commercial conversation. CRM stage is wrong.',
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
      evidence: 'we have a meeting with the CFO on the 21st — that\'s the budget approval',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Buyer\'s own validation: scoring matched expert judgment + caught real misses',
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
        'I\'ve had a chance to actually run Pulse on three of our deals',
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
      'Do not push paper until the CFO meeting concludes — that\'s the gate, not the deal.',
    ],
    followUpSubject: 'For your CFO meeting on the 21st',
    followUpBody:
      "Tomas, Sarah,\n\nAttaching: year-one ROI 1-pager and the 90-day rollout plan, both ready to hand to the CFO.\n\nSeparately, I'll send our SOC2 Type II report and DPA to Sarah and your security lead in a separate thread so that work can happen in parallel and not block the commercial side.\n\nQuick ask: if the CFO meeting goes how you expect, what's the fastest path to paper your team has done before?\n\nCasey",
    managerCoachingNote:
      'This is the textbook under-call. Rep marked it Discovery because that\'s when the discovery call happened, but the buyer has already run his own POC and named a budget date. CRM stage should advance to Proposal or Negotiation. The forecast is leaving money on the table.',
  }),
});

// --- Deal 6: Pied Piper — over-projecting (low), unaware ---

const piedPiperBuyer: MockBuyer = {
  id: 'buy_seed_piedpiper',
  workspaceId: WORKSPACE_ID,
  firstName: 'Harold',
  lastName: 'Voss',
  title: 'Director of Marketing Operations',
  company: 'Pied Piper',
  email: 'hvoss@piedpiper.example',
  linkedin: null,
  notes: null,
  createdAt: ISO('2026-05-02T15:00:00Z'),
  updatedAt: ISO('2026-05-02T15:00:00Z'),
};

const piedPiperOpp = makeOpportunity({
  id: 'opp_seed_piedpiper',
  workspaceId: WORKSPACE_ID,
  buyerId: piedPiperBuyer.id,
  productId: PRODUCT_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Pied Piper – inbound eval',
  currentCrmStage: 'Qualified',
  opportunityValue: 38000,
  expectedCloseDate: '2026-08-31',
  knownPain: null,
  knownObjection: null,
  dealNotes: 'Inbound demo request. First call was an intro; Harold is friendly but exploring.',
  currentReadinessState: 'unaware',
  currentReadinessScore: 18,
  currentAlignmentOutcome: 'over_projecting',
  currentAlignmentLevel: 'low',
  createdAt: ISO('2026-05-03T15:00:00Z'),
  updatedAt: ISO('2026-05-07T15:00:00Z'),
});

const piedPiperInteraction = makeActivity({
  id: 'int_seed_piedpiper_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: piedPiperOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-05-07T17:30:00Z'),
  participants: ['Harold Voss (Pied Piper)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'HAROLD: Yeah, my CEO read a thing about pipeline scoring and forwarded it to me. He asked me to take a look. I don\'t really know what I\'m looking for.',
    'CASEY: What does forecasting look like at Pied Piper today?',
    'HAROLD: Honestly I don\'t touch the sales forecast — that\'s sales ops. I run marketing ops. I think he wants me to evaluate it for the sales team but I\'d be a weird buyer for that.',
    'CASEY: Got it — would it make sense to get the head of sales ops on the next call?',
    'HAROLD: Probably. Let me see if I can rope her in next week.',
  ].join('\n\n'),
  repSubjectiveNotes:
    'CEO-forwarded inbound. Harold isn\'t the buyer and doesn\'t own the problem. Need to pivot to whoever does.',
  nextStepAgreed: false,
  stakeholderAdded: false,
  pricingDiscussed: false,
  budgetDiscussed: false,
  competitorDiscussed: false,
  implementationDiscussed: false,
  securityDiscussed: false,
});

const piedPiperSignals: SignalExtraction = {
  pain: [],
  trust: [
    {
      signal: 'Buyer is candid about not owning the problem',
      evidence: "I'd be a weird buyer for that",
      source: 'transcript',
      strength: 'medium',
      dimension: 'trust',
    },
  ],
  urgency: [],
  solution_confidence: [],
  commitment: [
    {
      signal: 'Buyer agrees to try to find the right person',
      evidence: 'Let me see if I can rope her in next week',
      source: 'transcript',
      strength: 'weak',
      dimension: 'commitment',
    },
  ],
  risk: [
    {
      signal: 'No pain articulated; deal originated from CEO forward without context',
      evidence: "my CEO read a thing about pipeline scoring and forwarded it to me",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
    {
      signal: 'Wrong functional buyer',
      evidence: "I run marketing ops",
      source: 'transcript',
      strength: 'strong',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No pain articulated.',
    'No sales-org stakeholder engaged.',
    'No timeline, no budget, no decision criteria.',
  ],
};

const piedPiperDiagnosis = makeDiagnosis({
  id: 'dx_seed_piedpiper',
  workspaceId: WORKSPACE_ID,
  opportunityId: piedPiperOpp.id,
  activityId: piedPiperInteraction.id,
  signalExtraction: piedPiperSignals,
  createdAt: ISO('2026-05-07T18:00:00Z'),
  diagnosis: buildDiagnosis({
    readinessState: 'unaware',
    readinessScore: 18,
    confidence: 'high',
    dimensionScores: [
      dim('pain', 10, 'No pain articulated — buyer does not own the workflow.', [
        "I don't really know what I'm looking for",
      ]),
      dim('trust', 55, 'Friendly, candid — early trust but no relationship yet.', [
        "I'd be a weird buyer for that",
      ]),
      dim('urgency', 5, 'No urgency at all — pure exploratory inbound.', []),
      dim('solution_confidence', 10, 'No confidence yet — buyer hasn\'t seen anything meaningful.', []),
      dim('commitment', 20, 'Soft commitment to try to find the right person.', [
        'rope her in next week',
      ]),
    ],
    primaryBlocker:
      'Wrong buyer in the room. Deal cannot progress until someone from sales ops is the primary contact.',
    secondaryBlocker: null,
    pipelineRealityCheck: {
      crmStage: 'Qualified',
      outcome: 'over_projecting',
      level: 'low',
      reason:
        'CRM Qualified implies problem-aware, but the buyer explicitly says he does not own the problem. One stage of over-call — this is still a New Lead until the right person is engaged.',
    },
    recommendedNextAction:
      'Send Harold a short forwardable note he can use to introduce you to the head of sales ops. Move the CRM stage back to New Lead until then.',
    whatNotToDoYet: [
      'Do not run another demo with Harold.',
      'Do not send pricing or proposal materials.',
      'Do not include in the Q2 or Q3 forecast.',
    ],
    followUpSubject: 'A note you can forward to your sales ops lead',
    followUpBody:
      "Hi Harold,\n\nGreat meeting today, and thanks for being honest about the org fit. Below is a short note you can drop into an email or Slack to introduce me to whoever runs sales ops:\n\n---\n\nHey [name] — Harold here. My CEO forwarded me Pulse — a pipeline-readiness scoring tool. Looked relevant for what you do on forecasting, not really my world. Mind if I make an intro to Casey at Acme so you two can take it from there?\n\n---\n\nThanks Harold, I owe you one.\n\nCasey",
    managerCoachingNote:
      'This deal should be moved back to New Lead and removed from any forecast roll-up. Rep marked it Qualified prematurely. Coach to use the "wrong buyer" disqualifier explicitly in the qualification rubric.',
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
  updatedAt: ISO('2026-05-08T15:00:00Z'),
});

const massiveDynamicInt1 = makeActivity({
  id: 'int_seed_massivedynamic_1',
  workspaceId: WORKSPACE_ID,
  opportunityId: massiveDynamicOpp.id,
  activityType: 'video_meeting',
  activityDate: ISO('2026-04-22T18:00:00Z'),
  participants: ['Renee Adeyemi (Massive Dynamic)', 'Casey Morgan (Acme)'],
  transcriptOrNotes: [
    'RENEE: The manager-coaching note feature is the unlock for us. Our managers don\'t actually do 1:1 coaching consistently because they don\'t know what to coach on.',
    'CASEY: Good. What does the path to "yes" look like on your side?',
    'RENEE: I have to get the three regional VPs on board. They\'re skeptical of new tools after a CRM migration that didn\'t land last year. If they say yes, the rest is easy.',
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
    'DIEGO: I\'ll be honest — I\'m tired of getting handed tools my reps are supposed to use. So my question is just: what\'s different here, and how do we know my managers will actually use it?',
    'CASEY: Fair. Two things: the manager-coaching note is generated for them after every diagnosis, so they\'re not creating it from scratch. And we\'d run a 4-week pilot where the metric is coaching-note opens per manager. If it\'s low, you have your answer.',
    'DIEGO: A 4-week pilot I could actually defend. Renee, can you set that up with the East and Central VPs too?',
    'RENEE: Yeah, I\'ll have them on by next Friday.',
  ].join('\n\n'),
  repSubjectiveNotes: 'Diego is the first VP. He\'s leaning in. Need East and Central next.',
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
    secondaryBlocker:
      'Prior failed tool rollout means the VPs will arrive skeptical by default.',
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
      evidence: 'Our managers don\'t actually do 1:1 coaching consistently',
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
      evidence: "A 4-week pilot I could actually defend",
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
        "A 4-week pilot I could actually defend",
      ]),
      dim('commitment', 55, 'Champion committed to bringing in the remaining stakeholders.', [
        "I'll have them on by next Friday",
      ]),
    ],
    primaryBlocker:
      'East and Central VPs have not validated. The deal cannot move to commercial until all three regional VPs are bought in.',
    secondaryBlocker: 'Prior failed tool rollout creates skepticism that must be addressed proactively.',
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
      'Do not assume the East and Central conversations will go like Diego\'s — prepare for skepticism.',
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
  updatedAt: ISO('2026-05-09T15:00:00Z'),
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
    'REEMA: I have the SOC2 Type II. I need the DPA updated with our subprocessor language and confirmation that customer data isn\'t leaving the EU.',
    'CASEY: DPA edit is two-day turnaround on our side. Data residency — yes, EU-only is supported, I\'ll confirm in writing.',
    'NATE: Once those are done, our standard MSA amendment process is 7-10 business days. Helena wants this signed by mid-July.',
    'HELENA: Yes, mid-July is the target. Casey, your team has been good to work with — let\'s get this done.',
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
      evidence: "your team has been good to work with",
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
      'Healthy late-funnel renewal-expansion. Rep should advance to Negotiation in the CRM; Proposal is under-calling. Watch the DPA turnaround — that\'s the only thing that can slip the date.',
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
  updatedAt: ISO('2026-05-02T15:00:00Z'),
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
      evidence: 'Forecast accuracy was the board-level driver — but the exec who owned it has left.',
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
      dim('pain', 40, 'The pain was real, but its internal owner is gone — it may no longer be felt.', [
        'the exec who owned it has left',
      ]),
      dim('trust', 25, 'The relationship was with the departed champion; no trust established with Devon.', [
        'Devon inherited it and has gone quiet',
      ]),
      dim('urgency', 20, 'Any urgency left with the previous owner. No timeline has been re-confirmed.', [
        'New VP has not re-committed to the project or the timeline',
      ]),
      dim('solution_confidence', 30, 'Solution confidence built earlier has not transferred to the new buyer.', [
        'no one carrying it internally',
      ]),
      dim('commitment', 15, 'Commitment has collapsed — the proposal is out but unowned and unanswered.', [
        '[No reply to either email.]',
      ]),
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
// activity-less opportunity on a different product (Signal). Demonstrates a
// buyer carrying multiple opportunities + a provisional, undiagnosed deal.

const wayneCopilotOpp = makeOpportunity({
  id: 'opp_seed_wayne_copilot',
  workspaceId: WORKSPACE_ID,
  buyerId: wayneBuyer.id,
  productId: PRODUCT_SIGNAL_ID,
  ownerUserId: USER_ID,
  opportunityName: 'Wayne – live call co-pilot trial',
  currentCrmStage: 'Qualified',
  opportunityValue: 24000,
  expectedCloseDate: null,
  knownPain: 'Lucia mentioned her SDR team wants in-call coaching after seeing the Pulse pilot.',
  knownObjection: null,
  dealNotes: 'Spun out of the Wayne marketing-stack conversation. No discovery call booked yet.',
  // Carries a CRM Record ID but no activity — the M15 demo target: importing
  // an activity history file auto-joins to this deal and re-scores it from
  // provisional to a real readiness diagnosis.
  crmRecordId: 'HS-1618033988',
  createdAt: ISO('2026-05-11T15:00:00Z'),
  updatedAt: ISO('2026-05-11T15:00:00Z'),
});

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
    products: [product, productSignal, productBrief],
    buyers: [
      globexBuyer,
      initechBuyer,
      wayneBuyer,
      starkBuyer,
      hooliBuyer,
      piedPiperBuyer,
      massiveDynamicBuyer,
      cyberdyneBuyer,
      soylentBuyer,
      ...unassignedBuyers,
    ],
    opportunities: [
      globexOpp,
      initechOpp,
      wayneOpp,
      starkOpp,
      hooliOpp,
      piedPiperOpp,
      massiveDynamicOpp,
      cyberdyneOpp,
      soylentOpp,
      wayneCopilotOpp,
    ],
    activities: [
      globexInteraction,
      initechInteraction,
      wayneInteraction,
      starkInteraction,
      hooliInteraction,
      piedPiperInteraction,
      massiveDynamicInt1,
      massiveDynamicInt2,
      cyberdyneInteraction,
      soylentActivity,
    ],
    diagnoses: [
      globexDiagnosis,
      initechDiagnosis,
      wayneDiagnosis,
      starkDiagnosis,
      hooliDiagnosis,
      piedPiperDiagnosis,
      massiveDynamicInt1Diagnosis,
      massiveDynamicDiagnosis,
      cyberdyneDiagnosis,
      soylentDiagnosis,
    ],
    outcomes: [],
    scriptTemplates,
    precallIntelligence: [starkPrecall, waynePrecall],
    importMappings,
  };
}
