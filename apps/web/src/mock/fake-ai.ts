import type { ParsedOpportunity } from '@pg/shared';

// Heuristic regex-based parser that stands in for the real Anthropic call in M4
// (Quick Paste tab). Aim is to gracefully extract what it can and leave fields
// null when the input is ambiguous — same contract as the real parser will
// eventually produce (parsedOpportunitySchema in @pg/shared).

interface ExtractedNames {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
}

const TITLE_HINTS = [
  'CEO', 'CTO', 'CFO', 'COO', 'CRO', 'CMO', 'CISO',
  'VP', 'Director', 'Head', 'Manager', 'Lead',
  'President', 'Founder', 'Chief',
] as const;

const STAGE_HINTS: Record<string, string> = {
  'new lead': 'New Lead',
  qualified: 'Qualified',
  discovery: 'Discovery',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  'closed won': 'Closed Won',
  'closed lost': 'Closed Lost',
};

// Tries patterns in priority order; first match wins. Each handles a common
// way reps mention a buyer + company in notes:
//   "talking with Jesse Roesch of Downland"
//   "met with Jamie Park at Globex"
//   "spoke to Casey from Acme"
//   "Talking to Jamie (Globex)"
//   "JAMIE:" (transcript speaker label)
function extractNames(text: string): ExtractedNames {
  const NAME = `[A-Z][a-z]+(?:-[A-Z][a-z]+)?`;
  const COMPANY = `[A-Z][A-Za-z0-9.& '\\-]+?`;
  const CONNECTOR = `(?:of|from|at|@|with)`;
  const VERB = `(?:talking|chatting|met|meeting|spoke|speaking|working|chat(?:ting)?|call(?:ed|ing)?)`;

  const patterns: RegExp[] = [
    // Verb-led: "talking with X (Y)? of/at/from Z"
    new RegExp(
      `\\b${VERB}\\b(?:\\s+(?:to|with|w\\/))?\\s+(${NAME})(?:\\s+(${NAME}))?\\s+${CONNECTOR}\\s+(${COMPANY})(?=[\\s,.!?]|$)`,
      'i',
    ),
    // "X (Y)? at|@ Z" (no verb required)
    new RegExp(
      `\\b(${NAME})(?:\\s+(${NAME}))?\\s+(?:at|@)\\s+(${COMPANY})(?=[\\s,.!?]|$)`,
    ),
    // "X (Y)? of Z" — only when preceded by `with` or `,` to avoid catching
    // "Director of Sales" / "Head of Marketing" as a name.
    new RegExp(
      `(?:^|[\\s,])with\\s+(${NAME})(?:\\s+(${NAME}))?\\s+of\\s+(${COMPANY})(?=[\\s,.!?]|$)`,
    ),
    // "Talking to X (Y) (Z)" — paren-bound company
    new RegExp(
      `\\b${VERB}\\s+(?:to|with)?\\s*(${NAME})(?:\\s+(${NAME}))?\\s*\\(([^)]+)\\)`,
      'i',
    ),
    // Verb-led with no connector: "talking with X (Y)?" — name only, company stays null
    new RegExp(
      `\\b${VERB}\\s+(?:to|with|w\\/)\\s+(${NAME})(?:\\s+(${NAME}))?(?=[\\s,.!?]|$)`,
      'i',
    ),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      return {
        firstName: m[1] ?? null,
        lastName: m[2] ?? null,
        company: m[3]?.trim() ?? null,
      };
    }
  }

  // Last resort: speaker label like "JAMIE:" → first name only
  const speakerMatch = text.match(/^([A-Z][A-Z]+)(?:\s+[A-Z][A-Z]+)?:/m);
  if (speakerMatch?.[1]) {
    return {
      firstName: speakerMatch[1].slice(0, 1) + speakerMatch[1].slice(1).toLowerCase(),
      lastName: null,
      company: null,
    };
  }

  return { firstName: null, lastName: null, company: null };
}

function extractEmail(text: string): string | null {
  const m = text.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/);
  return m?.[0] ?? null;
}

function extractTitle(text: string): string | null {
  // "VP of Sales" / "Director of Revenue Operations" / "Head of Marketing"
  const m = text.match(
    new RegExp(`\\b(${TITLE_HINTS.join('|')})(?:\\s+of\\s+[A-Z][\\w ]+?)?(?=[,.\\n]|\\s+(?:at|@)\\b|$)`, 'i'),
  );
  return m?.[0]?.trim() ?? null;
}

function extractDealValue(text: string): number | null {
  // "$84,000" / "$84k" / "$1.2M"
  const m = text.match(/\$\s?([\d,.]+)\s?(k|K|m|M)?/);
  if (!m?.[1]) return null;
  const base = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(base)) return null;
  const suffix = m[2]?.toLowerCase();
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  return Math.round(base);
}

function extractCloseDate(text: string): string | null {
  // ISO-ish "2026-06-30" or "June 30" — we only confidently catch ISO format.
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function extractCrmStage(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [hint, canonical] of Object.entries(STAGE_HINTS)) {
    if (lower.includes(hint)) return canonical;
  }
  return null;
}

function extractOpportunityName(
  text: string,
  names: ExtractedNames,
): string | null {
  if (!names.company) return null;
  // "<Company> – <something>" / "<Company> - <something>"
  const m = text.match(new RegExp(`${escape(names.company)}\\s*[–-]\\s*([^\\n.]+)`));
  if (m?.[1]) return `${names.company} – ${m[1].trim()}`;
  return `${names.company} – New opportunity`;
}

function extractKnownPain(text: string): string | null {
  // "Pain:" / "Pain point:" / "Their pain is …"
  const m =
    text.match(/(?:^|\n)\s*(?:pain|pain point)\s*[:\-]\s*(.+?)(?=\n|$)/i) ||
    text.match(/\btheir pain (?:is|was)\s+(.+?)(?=\.|\n|$)/i);
  return m?.[1]?.trim() ?? null;
}

function extractKnownObjection(text: string): string | null {
  const m =
    text.match(/(?:^|\n)\s*objection\s*[:\-]\s*(.+?)(?=\n|$)/i) ||
    text.match(/\bpushed back on\s+(.+?)(?=\.|\n|$)/i);
  return m?.[1]?.trim() ?? null;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function fakeParseOpportunity(text: string): ParsedOpportunity {
  const names = extractNames(text);
  return {
    opportunity_name: extractOpportunityName(text, names),
    buyer: {
      first_name: names.firstName,
      last_name: names.lastName,
      title: extractTitle(text),
      company: names.company,
      email: extractEmail(text),
      linkedin: null,
    },
    current_crm_stage: extractCrmStage(text),
    opportunity_value: extractDealValue(text),
    expected_close_date: extractCloseDate(text),
    known_pain: extractKnownPain(text),
    known_objection: extractKnownObjection(text),
    deal_notes: null,
  };
}

// Staged loading messages shown during the simulated parse.
export const FAKE_PARSE_STEPS = [
  'Reading content…',
  'Extracting buyer info…',
  'Identifying deal stage…',
  'Surfacing pain + objections…',
] as const;
