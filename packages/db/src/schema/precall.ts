import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { discTypeEnum, salesTechniqueEnum } from './enums';
import { workspaces } from './workspace';
import { opportunities } from './pipeline';

// Pre-call intelligence (May-2026 re-scope) — DISC/OCEAN profile + matched
// technique + generated script, keyed per opportunity. Mirrors how diagnoses are
// stored: the validated AI output bundle lives in jsonb columns; discrete columns
// are denormalized for filtering. History is kept (regeneration appends a row);
// read the latest by (opportunity_id, generated_at). The bundle is validated by
// @pg/shared precallIntelligenceSchema before insert.
export const precallIntelligence = pgTable(
  'precall_intelligence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    // Structured AI outputs (validated by zod schemas in @pg/shared before insert).
    psychProfile: jsonb('psych_profile').notNull(),
    matchedTechnique: jsonb('matched_technique').notNull(),
    generatedScript: jsonb('generated_script').notNull(),
    // Denormalized for filtering/display without parsing the jsonb.
    technique: salesTechniqueEnum('technique').notNull(),
    discPrimaryType: discTypeEnum('disc_primary_type').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('precall_opportunity_generated_idx').on(t.opportunityId, t.generatedAt)],
);
