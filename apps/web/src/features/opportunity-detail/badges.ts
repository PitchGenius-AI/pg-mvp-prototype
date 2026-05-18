// Shared inline color mappings for the detail surfaces. M7 replaces with semantic
// tokens (<ReadinessBadge>, <AlignmentBadge>) — for now we mirror what M5 does.

export function alignmentColor(
  outcome: string | null | undefined,
  level: string | null | undefined,
): string {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'yellow';
  }
  if (outcome === 'under_projecting') return 'blue';
  if (outcome === 'aligned') return 'teal';
  return 'gray';
}

export function severityFromAlignment(
  outcome: string | null | undefined,
  level: string | null | undefined,
): 'high' | 'medium' | 'low' | 'none' {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'high';
    if (level === 'medium') return 'medium';
    return 'low';
  }
  if (outcome === 'under_projecting') {
    if (level === 'high' || level === 'critical') return 'medium';
    return 'low';
  }
  return 'none';
}

export function confidenceColor(level: string): string {
  if (level === 'high') return 'teal';
  if (level === 'medium') return 'yellow';
  return 'orange';
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}
