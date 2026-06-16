import { Anchor, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { EnrichConfidenceTier, EnrichmentCandidate } from '@pg/shared';

// The candidate disambiguation chooser (PG-288). Enrichment returns ranked
// candidate people because the same name is often several real people; rather than
// silently pre-fill the wrong one, we let the rep pick. Built standalone so the
// bulk-CSV "Needs review" queue (Increment 2) reuses it verbatim.

interface CandidatePickerProps {
  candidates: EnrichmentCandidate[];
  onPick: (candidate: EnrichmentCandidate) => void;
  // "None of these" — fall through to manual entry.
  onManual: () => void;
}

const TIER_COLOR: Record<EnrichConfidenceTier, string> = {
  strong: 'teal',
  good: 'blue',
  moderate: 'yellow',
  weak: 'gray',
};

const TIER_LABEL: Record<EnrichConfidenceTier, string> = {
  strong: 'Strong match',
  good: 'Good match',
  moderate: 'Possible match',
  weak: 'Weak match',
};

function summarize(candidate: EnrichmentCandidate): string {
  const { title, company } = candidate.fields;
  const role = [title, company].filter(Boolean).join(' · ');
  return role || candidate.summary;
}

export function CandidatePicker({ candidates, onPick, onManual }: CandidatePickerProps) {
  return (
    <Stack gap="md" maw={560}>
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          We found {candidates.length} people — which one?
        </Text>
        <Text size="sm" c="dimmed">
          The same name can belong to different people. Pick the right one and we’ll pre-fill the
          form from what we found.
        </Text>
      </Stack>

      <Stack gap="sm">
        {candidates.map((candidate) => (
          <Card
            key={candidate.id}
            withBorder
            padding="md"
            radius="md"
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => onPick(candidate)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick(candidate);
              }
            }}
          >
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs" wrap="nowrap">
                  <Text fw={600} truncate>
                    {candidate.fields.firstName || candidate.label}
                    {candidate.fields.lastName ? ` ${candidate.fields.lastName}` : ''}
                  </Text>
                  <Badge size="sm" variant="light" color={TIER_COLOR[candidate.confidenceTier]}>
                    {TIER_LABEL[candidate.confidenceTier]}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" truncate>
                  {summarize(candidate)}
                </Text>
                {candidate.summary && summarize(candidate) !== candidate.summary && (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {candidate.summary}
                  </Text>
                )}
                {candidate.sources.length > 0 && (
                  <Text size="xs" c="dimmed">
                    {candidate.sources.length}{' '}
                    {candidate.sources.length === 1 ? 'source' : 'sources'}
                  </Text>
                )}
              </Stack>
              <IconChevronRight size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            </Group>
          </Card>
        ))}
      </Stack>

      <Anchor component="button" type="button" size="sm" c="dimmed" onClick={onManual}>
        None of these — enter details manually
      </Anchor>
    </Stack>
  );
}
