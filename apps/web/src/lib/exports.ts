import type {
  MockBuyer,
  MockDiagnosis,
  MockInteraction,
  MockOpportunity,
} from '../mock/types';

// Build a paste-into-CRM text block summarizing the opportunity + its latest diagnosis.
// The seed already stores `crmNoteText` per diagnosis; this composes a richer block
// including buyer + recommended next action + email for the manual paste use case.
export function buildCrmNoteText(args: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  diagnosis: MockDiagnosis | null;
}): string {
  const { opportunity, buyer, diagnosis } = args;
  const lines: string[] = [];
  lines.push(`Opportunity: ${opportunity.opportunityName}`);
  if (buyer) {
    const fullName = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ');
    lines.push(`Buyer: ${fullName} · ${buyer.company}${buyer.title ? ` (${buyer.title})` : ''}`);
  }
  lines.push(`CRM stage: ${opportunity.currentCrmStage}`);
  if (opportunity.opportunityValue != null) {
    lines.push(`Value: $${opportunity.opportunityValue.toLocaleString()}`);
  }
  if (opportunity.expectedCloseDate) {
    lines.push(`Expected close: ${opportunity.expectedCloseDate}`);
  }

  if (diagnosis) {
    lines.push('');
    lines.push(
      `Readiness: ${diagnosis.readinessState.replace(/_/g, ' ')} (${diagnosis.readinessScore}/100, ${diagnosis.confidenceLevel} confidence)`,
    );
    lines.push(
      `Pipeline alignment: ${diagnosis.alignmentOutcome.replace(/_/g, ' ')} (${diagnosis.alignmentLevel})`,
    );
    lines.push(`Reason: ${diagnosis.alignmentReason}`);
    if (diagnosis.primaryBlocker) {
      lines.push(`Primary blocker: ${diagnosis.primaryBlocker}`);
    }
    if (diagnosis.secondaryBlocker) {
      lines.push(`Secondary blocker: ${diagnosis.secondaryBlocker}`);
    }
    lines.push('');
    lines.push(`Next action: ${diagnosis.diagnosis.recommended_next_action}`);
    if (diagnosis.followUpSubject && diagnosis.followUpBody) {
      lines.push('');
      lines.push('--- Follow-up email ---');
      lines.push(`Subject: ${diagnosis.followUpSubject}`);
      lines.push('');
      lines.push(diagnosis.followUpBody);
    }
  }

  return lines.join('\n');
}

// One-row CSV for the opportunity + its latest diagnosis. Headers always rendered
// (single-row exports are still useful for spreadsheet append).
export function buildSingleOpportunityCsv(args: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  diagnosis: MockDiagnosis | null;
}): string {
  const { opportunity: o, buyer, diagnosis: d } = args;
  const headers = [
    'opportunity_name',
    'crm_stage',
    'value',
    'expected_close',
    'at_risk',
    'buyer_first_name',
    'buyer_last_name',
    'buyer_company',
    'buyer_title',
    'buyer_email',
    'readiness_state',
    'readiness_score',
    'confidence',
    'alignment_outcome',
    'alignment_level',
    'primary_blocker',
    'recommended_next_action',
  ];
  const row = [
    o.opportunityName,
    o.currentCrmStage,
    o.opportunityValue ?? '',
    o.expectedCloseDate ?? '',
    o.atRisk ? 'true' : 'false',
    buyer?.firstName ?? '',
    buyer?.lastName ?? '',
    buyer?.company ?? '',
    buyer?.title ?? '',
    buyer?.email ?? '',
    d?.readinessState ?? '',
    d?.readinessScore ?? '',
    d?.confidenceLevel ?? '',
    d?.alignmentOutcome ?? '',
    d?.alignmentLevel ?? '',
    d?.primaryBlocker ?? '',
    d?.diagnosis.recommended_next_action ?? '',
  ];
  return [headers.map(csvEscape).join(','), row.map(csvEscape).join(',')].join('\n');
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Full structured JSON dump — opportunity + buyer + interactions + diagnosis.
export function buildOpportunityJson(args: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  diagnosis: MockDiagnosis | null;
  interactions: MockInteraction[];
}): string {
  return JSON.stringify(
    {
      opportunity: args.opportunity,
      buyer: args.buyer,
      latest_diagnosis: args.diagnosis,
      interactions: args.interactions,
      exported_at: new Date().toISOString(),
    },
    null,
    2,
  );
}

// Trigger a browser download for the given text payload.
export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function safeFilenameSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
