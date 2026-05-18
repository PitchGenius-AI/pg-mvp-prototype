import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { crmStageTemplateEnum } from './enums';
import { user } from './auth';

// One workspace per user in MVP. Workspace owns pipeline configuration.
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  website: text('website'),
  industry: text('industry'),
  crmStageTemplate: crmStageTemplateEnum('crm_stage_template')
    .notNull()
    .default('simple_b2b_sales'),
  // Array of { name: string, order: number } when template = 'custom'. Stored as JSON
  // for MVP shipping speed; see CLAUDE.md for the normalization tradeoff discussion.
  customCrmStages: jsonb('custom_crm_stages').$type<Array<{ name: string; order: number }>>(),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// MVP enforces one product per workspace via app-level check.
// Schema supports multi-product so post-MVP expansion needs no migration.
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  targetBuyer: text('target_buyer').notNull(),
  problemSolved: text('problem_solved').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Onboarding is a completion event only — collected data is written to workspace + product.
export const onboarding = pgTable('onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
