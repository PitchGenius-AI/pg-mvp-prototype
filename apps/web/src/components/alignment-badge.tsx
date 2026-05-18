import { Badge, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import type { AlignmentLevel, AlignmentOutcome } from '@pg/shared';

interface AlignmentBadgeProps {
  outcome: AlignmentOutcome | null | undefined;
  level: AlignmentLevel | null | undefined;
  size?: 'sm' | 'md';
}

// Binary aligned/mismatch read with the direction + severity carried in a small
// text sublabel underneath. Replaces the previous 4-color (yellow/orange/red)
// gradient that crowded the list rows. See PG-181 for the design rationale.
export function AlignmentBadge({ outcome, level, size = 'sm' }: AlignmentBadgeProps) {
  if (!outcome) {
    return (
      <Text size={size === 'md' ? 'sm' : 'xs'} c="dimmed">
        —
      </Text>
    );
  }

  const isAligned = outcome === 'aligned';
  const tooltipLabel = TOOLTIP_BY_OUTCOME[outcome];
  const sublabel = isAligned ? null : sublabelFor(outcome, level);

  const badge = (
    <Badge
      variant="light"
      color={isAligned ? 'gray' : 'red'}
      size={size}
      leftSection={
        isAligned ? <IconCheck size={12} stroke={2.5} /> : <IconAlertTriangle size={12} stroke={2.5} />
      }
      style={{ textTransform: 'uppercase' }}
    >
      {isAligned ? 'Aligned' : 'Mismatch'}
    </Badge>
  );

  return (
    <Stack gap={2} align="flex-start">
      <Tooltip label={tooltipLabel} withArrow position="top-start" maw={280} multiline>
        {badge}
      </Tooltip>
      {sublabel && (
        <Text size="xs" c="dimmed">
          {sublabel}
        </Text>
      )}
    </Stack>
  );
}

function sublabelFor(outcome: AlignmentOutcome, level: AlignmentLevel | null | undefined): string {
  const direction = outcome === 'over_projecting' ? 'Over-projecting' : 'Under-projecting';
  if (!level || level === 'none') return direction;
  return `${direction} · ${level}`;
}

const TOOLTIP_BY_OUTCOME: Record<AlignmentOutcome, string> = {
  aligned: "Your CRM stage matches the buyer's evidence.",
  over_projecting:
    "Deal is at risk — buyer evidence doesn't support the CRM stage.",
  under_projecting:
    'Hidden opportunity — buyer is further along than the CRM stage suggests.',
};
