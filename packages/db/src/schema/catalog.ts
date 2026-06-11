import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { crmTypeEnum } from './enums';
import { workspaces } from './workspace';

// A reusable, workspace-level call-script template (managed on the M16 Scripts
// page). Distinct from a generated, per-opportunity script — see precall.ts.
// Exactly one `is_primary` per workspace, mirroring the products invariant.
export const scriptTemplates = pgTable(
  'script_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('script_templates_workspace_idx').on(t.workspaceId)],
);

// A saved, reusable column-mapping config for the Daily Workbench import (M14).
// `fields` holds the ordered Array<{ sourceColumn, targetField }>; targetField is
// null for unmapped columns (matches @pg/shared importMappingSchema).
export const importMappings = pgTable(
  'import_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    crmType: crmTypeEnum('crm_type'),
    fields: jsonb('fields')
      .notNull()
      .$type<Array<{ sourceColumn: string; targetField: string | null }>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('import_mappings_workspace_idx').on(t.workspaceId)],
);
