import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ReadinessDiagnosis, SignalExtraction } from '@pg/shared';
import {
  alignmentLevelEnum,
  alignmentOutcomeEnum,
  confidenceLevelEnum,
  diagnosisJobStatusEnum,
  exportTypeEnum,
  exportedObjectTypeEnum,
  outcomeTypeEnum,
  readinessStateEnum,
} from './enums';
import { user } from './auth';
import { workspaces } from './workspace';
import { activities, opportunities } from './pipeline';

// One diagnosis per activity. JSON columns hold the validated AI output verbatim;
// the discrete columns are denormalized for filtering/sorting.
export const readinessDiagnoses = pgTable(
  'readiness_diagnoses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    // Structured AI outputs (validated by zod schemas in @pg/shared before insert).
    signalExtraction: jsonb('signal_extraction').$type<SignalExtraction>().notNull(),
    diagnosis: jsonb('diagnosis').$type<ReadinessDiagnosis>().notNull(),
    // Denormalized fields.
    readinessState: readinessStateEnum('readiness_state').notNull(),
    readinessScore: integer('readiness_score').notNull(),
    confidenceLevel: confidenceLevelEnum('confidence_level').notNull(),
    alignmentOutcome: alignmentOutcomeEnum('alignment_outcome').notNull(),
    alignmentLevel: alignmentLevelEnum('alignment_level').notNull(),
    alignmentReason: text('alignment_reason').notNull(),
    primaryBlocker: text('primary_blocker'),
    secondaryBlocker: text('secondary_blocker'),
    // Ready-to-copy artifacts.
    crmNoteText: text('crm_note_text').notNull(),
    followUpSubject: text('follow_up_subject'),
    followUpBody: text('follow_up_body'),
    managerCoachingNote: text('manager_coaching_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('diagnoses_opportunity_created_idx').on(t.opportunityId, t.createdAt),
    index('diagnoses_activity_idx').on(t.activityId),
  ],
);

// Tracks one background diagnosis run per enqueue (M-async). The diagnosis itself
// still lands in `readiness_diagnoses` fully-formed in a single transaction when the
// worker finishes — this table only carries the run's lifecycle so the UI can poll
// for "diagnosing… / done / failed" without blocking on the AI chain. `diagnosisId`
// is set when the run succeeds. All three parent FKs cascade so deleting an activity
// (or its opportunity/workspace) cleans up its job rows too.
export const diagnosisJobs = pgTable(
  'diagnosis_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    status: diagnosisJobStatusEnum('status').notNull().default('running'),
    error: text('error'),
    diagnosisId: uuid('diagnosis_id').references(() => readinessDiagnoses.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('diagnosis_jobs_opportunity_created_idx').on(t.opportunityId, t.createdAt),
    index('diagnosis_jobs_activity_idx').on(t.activityId),
  ],
);

export const outcomeFeedback = pgTable(
  'outcome_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    diagnosisId: uuid('diagnosis_id')
      .notNull()
      .references(() => readinessDiagnoses.id, { onDelete: 'cascade' }),
    outcomeType: outcomeTypeEnum('outcome_type').notNull(),
    outcomeNotes: text('outcome_notes'),
    // Convenience flags per spec — a single outcome can mark multiple things.
    dealAdvanced: boolean('deal_advanced').notNull().default(false),
    buyerReplied: boolean('buyer_replied').notNull().default(false),
    nextMeetingBooked: boolean('next_meeting_booked').notNull().default(false),
    stakeholderAdded: boolean('stakeholder_added').notNull().default(false),
    closedWon: boolean('closed_won').notNull().default(false),
    closedLost: boolean('closed_lost').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('outcomes_diagnosis_idx').on(t.diagnosisId)],
);

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  exportType: exportTypeEnum('export_type').notNull(),
  exportedObjectType: exportedObjectTypeEnum('exported_object_type').notNull(),
  exportedObjectIds: jsonb('exported_object_ids').notNull().$type<string[]>(),
  fileUrlOrText: text('file_url_or_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
