import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  activityTypeEnum,
  alignmentLevelEnum,
  alignmentOutcomeEnum,
  closedStatusEnum,
  readinessStateEnum,
} from './enums';
import { user } from './auth';
import { products, workspaces } from './workspace';

// A buyer is a person at a company; separate from opportunity so the same buyer
// can have multiple opportunities (current, historical, reframed).
export const buyers = pgTable(
  'buyers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    title: text('title'),
    company: text('company').notNull(),
    email: text('email'),
    linkedin: text('linkedin'),
    website: text('website'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('buyers_workspace_idx').on(t.workspaceId),
    index('buyers_workspace_company_idx').on(t.workspaceId, t.company, t.firstName),
    index('buyers_workspace_email_idx').on(t.workspaceId, t.email),
  ],
);

// An opportunity is a unique buyer + product + deal context combination.
export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => buyers.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id),
    opportunityName: text('opportunity_name').notNull(),
    currentCrmStage: text('current_crm_stage').notNull(),
    opportunityValue: numeric('opportunity_value', { precision: 14, scale: 2 }),
    expectedCloseDate: date('expected_close_date'),
    knownPain: text('known_pain'),
    knownObjection: text('known_objection'),
    dealNotes: text('deal_notes'),
    // CRM record identifier (HubSpot Record ID / Pipedrive System ID). Drives the
    // two-tier export model (CRM note vs. Copy-only) and bulk-activity auto-join.
    crmRecordId: text('crm_record_id'),
    // Denormalized from the latest diagnosis for cheap list-view rendering.
    currentReadinessState: readinessStateEnum('current_readiness_state'),
    currentReadinessScore: integer('current_readiness_score'),
    currentAlignmentOutcome: alignmentOutcomeEnum('current_alignment_outcome'),
    currentAlignmentLevel: alignmentLevelEnum('current_alignment_level'),
    // At-Risk is a flag on the state, not a state itself.
    atRisk: boolean('at_risk').notNull().default(false),
    closedStatus: closedStatusEnum('closed_status').notNull().default('open'),
    reframedFromOpportunityId: uuid('reframed_from_opportunity_id').references(
      (): AnyPgColumn => opportunities.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('opportunities_workspace_idx').on(t.workspaceId),
    index('opportunities_workspace_buyer_idx').on(t.workspaceId, t.buyerId),
    index('opportunities_workspace_owner_idx').on(t.workspaceId, t.ownerUserId),
    index('opportunities_workspace_alignment_idx').on(
      t.workspaceId,
      t.currentAlignmentOutcome,
      t.currentAlignmentLevel,
    ),
  ],
);

// One row per activity = unit of buyer evidence diagnosed. Renamed from
// `interactions` in the May-2026 re-scope.
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    activityType: activityTypeEnum('activity_type').notNull(),
    activityDate: timestamp('activity_date', { withTimezone: true }).notNull(),
    participants: jsonb('participants').$type<string[]>(),
    transcriptOrNotes: text('transcript_or_notes'),
    repSubjectiveNotes: text('rep_subjective_notes'),
    nextStepAgreed: boolean('next_step_agreed').notNull().default(false),
    stakeholderAdded: boolean('stakeholder_added').notNull().default(false),
    pricingDiscussed: boolean('pricing_discussed').notNull().default(false),
    budgetDiscussed: boolean('budget_discussed').notNull().default(false),
    competitorDiscussed: boolean('competitor_discussed').notNull().default(false),
    implementationDiscussed: boolean('implementation_discussed').notNull().default(false),
    securityDiscussed: boolean('security_discussed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activities_opportunity_date_idx').on(t.opportunityId, t.activityDate)],
);
