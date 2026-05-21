// Mock column-mapper for the bulk Activities import (M15, PG-216/218). A sibling
// of fake-import-mapper.ts: deterministic pattern-matching on the source column
// name, with a per-column confidence score so the UI can flag low-confidence
// mappings at the confirmation gate. A CRM activity export carries an arbitrary
// column structure; this adapts to whatever headers it finds.
//
// PG-218 also lives here: `normalizeActivityType` maps the free-text activity
// type a CRM emits (Call / Logged Call / Email / Meeting / Note …) onto the
// internal `ActivityType` enum so imported activities feed the readiness model.

import type { ActivityType } from '@pg/shared';
import type { ConfidenceTier } from './fake-import-mapper';

// Fields the Activities import can land in. `crm_record_id` is the auto-join key
// (PG-217); the rest populate the created activity. Type/date carry sensible
// defaults when unmapped, so the only truly required fields are the record id
// plus some content (subject or body).
export const ACTIVITY_TARGET_FIELDS = [
  'crm_record_id',
  'activity_type',
  'activity_date',
  'activity_subject',
  'activity_body',
  'activity_participants',
] as const;

export type ActivityTargetField = (typeof ACTIVITY_TARGET_FIELDS)[number];

export const ACTIVITY_FIELD_LABELS: Record<ActivityTargetField, string> = {
  crm_record_id: 'CRM Record ID',
  activity_type: 'Activity type',
  activity_date: 'Activity date',
  activity_subject: 'Subject',
  activity_body: 'Notes / body',
  activity_participants: 'Participants',
};

interface MappingRule {
  pattern: RegExp;
  target: ActivityTargetField;
  confidence: number;
  reasoning: string;
}

const RULES: MappingRule[] = [
  // Record ID — checked first; it's the deal/contact the activity joins to.
  {
    pattern:
      /record[_\s-]?id|associated[_\s-]?deal|deal[_\s-]?id|system[_\s-]?id|hubspot[_\s-]?id|pipedrive[_\s-]?id|^id$/i,
    target: 'crm_record_id',
    confidence: 1,
    reasoning: 'Matches a CRM record identifier column',
  },

  { pattern: /^activity[_\s-]?type$|^engagement[_\s-]?type$|^type$|^kind$/i, target: 'activity_type', confidence: 1, reasoning: 'Activity / engagement type column' },

  { pattern: /date|timestamp|logged[_\s-]?at|occurred|^when$/i, target: 'activity_date', confidence: 0.9, reasoning: 'Activity date / timestamp column' },

  { pattern: /^subject$|^title$|^summary$/i, target: 'activity_subject', confidence: 0.95, reasoning: 'Activity subject / title column' },
  { pattern: /^name$|^topic$/i, target: 'activity_subject', confidence: 0.6, reasoning: 'Generic name assumed to be the subject' },

  { pattern: /notes?$|body|description|details?|content|^message$|comment/i, target: 'activity_body', confidence: 0.9, reasoning: 'Free-text notes / body column' },

  { pattern: /attendee|participant|^contacts?$|invitee|^with$|people/i, target: 'activity_participants', confidence: 0.85, reasoning: 'Participants / attendees column' },
];

export interface ActivityColumnMapping {
  sourceColumn: string;
  targetField: ActivityTargetField | null;
  confidence: number;
  reasoning: string;
}

// Tier of a confidence score, for the mapping table's badge. Mirrors
// fake-import-mapper's `confidenceTier` for the activity field type.
export function activityConfidenceTier(
  confidence: number,
  target: ActivityTargetField | null,
): ConfidenceTier {
  if (!target) return 'unmapped';
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

function autoMapHeader(
  header: string,
): Omit<ActivityColumnMapping, 'sourceColumn'> {
  for (const rule of RULES) {
    if (rule.pattern.test(header)) {
      return { targetField: rule.target, confidence: rule.confidence, reasoning: rule.reasoning };
    }
  }
  return { targetField: null, confidence: 0, reasoning: 'No confident match — set this manually' };
}

// Auto-map a set of Activities-file headers. Each source column gets at most one
// target; when two columns would claim the same target the later one is dropped
// to `null` so the rep resolves the collision at the confirmation gate.
export function autoMapActivityColumns(headers: string[]): ActivityColumnMapping[] {
  const claimed = new Set<ActivityTargetField>();
  return headers.map((raw) => {
    const sourceColumn = raw.trim();
    const guess = autoMapHeader(sourceColumn);
    if (guess.targetField && claimed.has(guess.targetField)) {
      return {
        sourceColumn,
        targetField: null,
        confidence: 0,
        reasoning: `Another column already maps to "${ACTIVITY_FIELD_LABELS[guess.targetField]}"`,
      };
    }
    if (guess.targetField) claimed.add(guess.targetField);
    return { sourceColumn, ...guess };
  });
}

// The minimum to commit an Activities import: a column mapped to the CRM Record
// ID (the auto-join key) and one carrying content (subject or notes/body).
export function requiredActivityFieldsMapped(
  mappings: ActivityColumnMapping[],
): boolean {
  const targets = new Set(
    mappings
      .map((m) => m.targetField)
      .filter((t): t is ActivityTargetField => t !== null),
  );
  return (
    targets.has('crm_record_id') &&
    (targets.has('activity_body') || targets.has('activity_subject'))
  );
}

// --- Activity-type normalization (PG-218) ----------------------------------

interface TypeRule {
  pattern: RegExp;
  type: ActivityType;
  confidence: number;
}

// Order matters — more specific patterns first (a "Demo call" reads as a demo,
// not a phone call).
const TYPE_RULES: TypeRule[] = [
  { pattern: /demo/i, type: 'demo', confidence: 1 },
  { pattern: /proposal|quote|contract|redline/i, type: 'proposal_review', confidence: 0.9 },
  { pattern: /meeting|video|zoom|teams|webinar|in[_\s-]?person|onsite/i, type: 'video_meeting', confidence: 0.95 },
  { pattern: /call|phone|dial|spoke/i, type: 'phone_call', confidence: 0.95 },
  { pattern: /e-?mail|message|linkedin|inmail|sms|text/i, type: 'email_thread', confidence: 0.95 },
  { pattern: /note|task|to-?do|^log$/i, type: 'other', confidence: 0.7 },
];

export interface NormalizedActivityType {
  type: ActivityType;
  confidence: number;
  // The raw string from the file, kept for the review-step breakdown.
  raw: string;
}

// Map a CRM's free-text activity type onto the internal `ActivityType` enum.
// Unrecognized values fall back to `other` rather than dropping the row.
export function normalizeActivityType(raw: string): NormalizedActivityType {
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'other', confidence: 0.3, raw: trimmed };
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { type: rule.type, confidence: rule.confidence, raw: trimmed };
    }
  }
  return { type: 'other', confidence: 0.4, raw: trimmed };
}

// Human-readable labels for the internal activity types — used in the review
// step's type breakdown.
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  phone_call: 'Phone call',
  video_meeting: 'Video meeting',
  email_thread: 'Email',
  demo: 'Demo',
  proposal_review: 'Proposal review',
  other: 'Note / other',
};
