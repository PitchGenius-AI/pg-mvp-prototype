import { Badge } from '@mantine/core';
import type { ReadinessState } from '@pg/shared';
import { READINESS_LABELS } from './workbench-data';

interface ReadinessBadgeProps {
  state: ReadinessState | null | undefined;
  score: number | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

// Readiness state + score in one chip. `at_risk` (regression) is the only state
// that carries a colour — it's the one a rep needs to catch at a glance.
export function ReadinessBadge({ state, score, size = 'sm' }: ReadinessBadgeProps) {
  if (!state) {
    return (
      <Badge variant="default" color="gray" size={size}>
        Not diagnosed
      </Badge>
    );
  }
  return (
    <Badge variant="light" color={state === 'at_risk' ? 'red' : 'gray'} size={size}>
      {READINESS_LABELS[state]}
      {score != null ? ` · ${score}` : ''}
    </Badge>
  );
}
