/**
 * Local dev seed (M27). Populates a demo workspace so the wired web app (M29)
 * and Drizzle Studio have realistic data to render. Idempotent: it deletes the
 * domain rows it owns (in FK-safe order) and re-inserts a fresh set.
 *
 * Data-only: the seed user has no Better Auth credential, so it cannot log in
 * yet — real sign-up/login lands in M28. Inspect via `pnpm db:studio`.
 *
 * This is a CLI script, not library code — so unlike the rest of @pg/db it does
 * read DATABASE_URL (mirroring drizzle.config.ts's precedent). Nothing imported
 * by apps/web or apps/api pulls this file in.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readinessDiagnosisSchema, signalExtractionSchema } from '@pg/shared';
import { createDbClient } from './client';
import {
  activities,
  buyers,
  onboarding,
  opportunities,
  products,
  readinessDiagnoses,
  scriptTemplates,
  user,
  workspaces,
} from './schema';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env at the repo root.');
}

const db = createDbClient(databaseUrl);

const USER_ID = 'seed-user-demo';
const DEMO_EMAIL = 'demo@pitchgenius.test';

// A validated signal-extraction + diagnosis bundle for the seeded diagnosis,
// matching the @pg/shared contract exactly (parsed below before insert).
const signalExtraction = signalExtractionSchema.parse({
  pain: [
    {
      signal: 'Manual pipeline reviews eat a day a week',
      evidence: "We're spending basically every Friday cleaning up the CRM by hand.",
      source: 'transcript',
      strength: 'strong',
      dimension: 'pain',
    },
  ],
  trust: [
    {
      signal: 'Buyer engaged the team in a working session',
      evidence: 'Looped in two of my reps to pressure-test it with you.',
      source: 'transcript',
      strength: 'medium',
      dimension: 'trust',
    },
  ],
  urgency: [
    {
      signal: 'Tied to a board commitment this quarter',
      evidence: 'I told the board we would have forecast accuracy fixed by Q3.',
      source: 'transcript',
      strength: 'strong',
      dimension: 'urgency',
    },
  ],
  solution_confidence: [
    {
      signal: 'Sees how the readiness score maps to their stages',
      evidence: 'The over-projection flag is exactly the thing we keep getting burned on.',
      source: 'transcript',
      strength: 'medium',
      dimension: 'solution_confidence',
    },
  ],
  commitment: [],
  risk: [
    {
      signal: 'No procurement or pricing conversation yet',
      evidence: 'Haven’t looped in procurement — that’s usually a whole thing here.',
      source: 'transcript',
      strength: 'medium',
      dimension: 'risk',
    },
  ],
  missing_evidence: [
    'No commercial/pricing discussion',
    'No explicit next step agreed on the call',
  ],
});

const diagnosis = readinessDiagnosisSchema.parse({
  readiness_state: 'solution_confident',
  readiness_score: 62,
  confidence_level: 'medium',
  dimension_scores: [
    {
      dimension: 'pain',
      score: 78,
      evidence: ['Spending basically every Friday cleaning up the CRM by hand.'],
      diagnosis: 'Pain is concrete, quantified, and owned by the buyer.',
    },
    {
      dimension: 'trust',
      score: 60,
      evidence: ['Looped in two of my reps to pressure-test it with you.'],
      diagnosis: 'Growing trust — buyer is investing their team’s time.',
    },
    {
      dimension: 'urgency',
      score: 70,
      evidence: ['Told the board we would have forecast accuracy fixed by Q3.'],
      diagnosis: 'Real deadline pressure tied to a board commitment.',
    },
    {
      dimension: 'solution_confidence',
      score: 64,
      evidence: ['The over-projection flag is exactly the thing we keep getting burned on.'],
      diagnosis: 'Buyer connects the product to their specific failure mode.',
    },
    {
      dimension: 'commitment',
      score: 35,
      evidence: [],
      diagnosis: 'No commercial motion or agreed next step yet — the key gap.',
    },
  ],
  primary_blocker: 'No commercial conversation (pricing / procurement) has started.',
  secondary_blocker: 'No explicit next step was agreed on the call.',
  pipeline_reality_check: {
    crm_stage: 'Proposal',
    readiness_state: 'solution_confident',
    outcome: 'over_projecting',
    level: 'high',
    reason:
      'Deal sits at Proposal in the CRM but the buyer has shown no commercial or commitment evidence — the stage is ahead of the buyer.',
  },
  recommended_next_action:
    'Book a 30-minute working session to map procurement + pricing, and get the buyer to name the next step.',
  what_not_to_do_yet: ['Do not send a formal quote', 'Do not ask for a verbal commit'],
  follow_up_email: {
    subject: 'Next step on forecast accuracy by Q3',
    body: 'Hi — great session today. To hit your Q3 board commitment, I’d suggest a short working session to walk procurement through how this fits. Does Thursday work?',
  },
  manager_coaching_note:
    'Rep has strong discovery but is over-projecting the stage. Coach to slow down and earn the commercial conversation before quoting.',
});

async function seed() {
  console.log('Seeding demo data…');

  // Delete in FK-safe order (children first). Auth tables are left untouched.
  await db.delete(readinessDiagnoses);
  await db.delete(activities);
  await db.delete(opportunities);
  await db.delete(buyers);
  await db.delete(scriptTemplates);
  await db.delete(products);
  await db.delete(onboarding);
  await db.delete(workspaces);
  await db.delete(user);

  await db.insert(user).values({
    id: USER_ID,
    name: 'Demo Rep',
    firstName: 'Demo',
    lastName: 'Rep',
    email: DEMO_EMAIL,
    emailVerified: true,
  });

  const [ws] = await db
    .insert(workspaces)
    .values({
      name: 'Northwind Demo',
      website: 'https://northwind.example',
      industry: 'B2B SaaS',
      crmStageTemplate: 'simple_b2b_sales',
      crmType: 'hubspot',
      subscriptionStatus: 'active',
      createdByUserId: USER_ID,
    })
    .returning();
  if (!ws) throw new Error('Failed to insert workspace');

  await db.insert(onboarding).values({
    workspaceId: ws.id,
    completed: true,
    completedAt: new Date(),
  });

  const [primaryProduct, secondaryProduct] = await db
    .insert(products)
    .values([
      {
        workspaceId: ws.id,
        name: 'Pitch Genius Platform',
        description: 'Buyer-readiness intelligence layered on top of the rep’s CRM.',
        targetBuyer: 'B2B sales reps and front-line managers at SaaS companies.',
        problemSolved: 'Pipelines over-project; reps can’t see which deals are really ready.',
        isPrimary: true,
      },
      {
        workspaceId: ws.id,
        name: 'Pipeline Insights',
        description: 'Aggregate forecast-accuracy reporting for sales leaders.',
        targetBuyer: 'VPs of Sales and RevOps leaders.',
        problemSolved: 'Leaders lack an evidence-based read on forecast risk.',
        isPrimary: false,
      },
    ])
    .returning();
  if (!primaryProduct) throw new Error('Failed to insert products');
  void secondaryProduct;

  await db.insert(scriptTemplates).values({
    workspaceId: ws.id,
    name: 'Discovery Call',
    isPrimary: true,
    content:
      'Open with the buyer’s context. Ask why now. Quantify the pain. Map decision process. Confirm next step.',
  });

  const buyerRows = await db
    .insert(buyers)
    .values([
      {
        workspaceId: ws.id,
        firstName: 'Jordan',
        lastName: 'Reyes',
        title: 'VP Sales',
        company: 'Helios Logistics',
        email: 'jordan@helios.example',
      },
      {
        workspaceId: ws.id,
        firstName: 'Sam',
        lastName: 'Okafor',
        title: 'RevOps Lead',
        company: 'Brightwave',
        email: 'sam@brightwave.example',
      },
      {
        workspaceId: ws.id,
        firstName: 'Priya',
        lastName: 'Nadar',
        title: 'Director of Sales',
        company: 'Cedar & Co',
        email: 'priya@cedar.example',
      },
    ])
    .returning();
  const [buyer1, buyer2, buyer3] = buyerRows;
  if (!buyer1 || !buyer2 || !buyer3) throw new Error('Failed to insert buyers');

  const [opp1, opp2] = await db
    .insert(opportunities)
    .values([
      {
        workspaceId: ws.id,
        buyerId: buyer1.id,
        productId: primaryProduct.id,
        ownerUserId: USER_ID,
        opportunityName: 'Helios — Forecast accuracy',
        currentCrmStage: 'Proposal',
        opportunityValue: '48000.00',
        knownPain: 'Manual pipeline reviews; board commitment on forecast accuracy.',
        crmRecordId: 'HS-100231',
        currentReadinessState: 'solution_confident',
        currentReadinessScore: 62,
        currentAlignmentOutcome: 'over_projecting',
        currentAlignmentLevel: 'high',
        atRisk: false,
      },
      {
        workspaceId: ws.id,
        buyerId: buyer2.id,
        productId: primaryProduct.id,
        ownerUserId: USER_ID,
        opportunityName: 'Brightwave — RevOps rollout',
        currentCrmStage: 'Discovery',
        opportunityValue: '22000.00',
        knownPain: 'No shared definition of a qualified deal.',
        currentReadinessState: 'problem_aware',
        currentReadinessScore: 34,
        currentAlignmentOutcome: 'aligned',
        currentAlignmentLevel: 'low',
        atRisk: false,
      },
      {
        workspaceId: ws.id,
        buyerId: buyer3.id,
        productId: primaryProduct.id,
        ownerUserId: USER_ID,
        opportunityName: 'Cedar & Co — Renewal expansion',
        currentCrmStage: 'Negotiation',
        opportunityValue: '75000.00',
        knownObjection: 'Champion went quiet after pricing pushback.',
        crmRecordId: 'HS-100244',
        currentReadinessState: 'at_risk',
        currentReadinessScore: 41,
        currentAlignmentOutcome: 'over_projecting',
        currentAlignmentLevel: 'critical',
        atRisk: true,
      },
    ])
    .returning();
  if (!opp1 || !opp2) throw new Error('Failed to insert opportunities');

  const [activity1] = await db
    .insert(activities)
    .values({
      workspaceId: ws.id,
      opportunityId: opp1.id,
      activityType: 'video_meeting',
      activityDate: new Date(),
      participants: ['Demo Rep', 'Jordan Reyes'],
      transcriptOrNotes:
        'Buyer described manual Friday CRM cleanup, a board commitment to fix forecast accuracy by Q3, and looped in two reps. No pricing or procurement discussed.',
      nextStepAgreed: false,
      stakeholderAdded: true,
    })
    .returning();
  if (!activity1) throw new Error('Failed to insert activity');

  await db.insert(readinessDiagnoses).values({
    workspaceId: ws.id,
    opportunityId: opp1.id,
    activityId: activity1.id,
    signalExtraction,
    diagnosis,
    readinessState: diagnosis.readiness_state,
    readinessScore: diagnosis.readiness_score,
    confidenceLevel: diagnosis.confidence_level,
    alignmentOutcome: diagnosis.pipeline_reality_check.outcome,
    alignmentLevel: diagnosis.pipeline_reality_check.level,
    alignmentReason: diagnosis.pipeline_reality_check.reason,
    primaryBlocker: diagnosis.primary_blocker,
    secondaryBlocker: diagnosis.secondary_blocker,
    crmNoteText: diagnosis.recommended_next_action,
    followUpSubject: diagnosis.follow_up_email.subject,
    followUpBody: diagnosis.follow_up_email.body,
    managerCoachingNote: diagnosis.manager_coaching_note,
  });

  console.log(
    `Seeded workspace "${ws.name}" (${DEMO_EMAIL}): 2 products, 1 script, 3 buyers, 3 opportunities, 1 diagnosis.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
