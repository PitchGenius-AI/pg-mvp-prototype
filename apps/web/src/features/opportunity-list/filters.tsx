import {
  Button,
  Chip,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { alignmentOutcomes, readinessStates, type ReadinessState, type AlignmentOutcome } from '@pg/shared';
import { hasActiveFilters, type ListSearchParams } from './search-schema';

interface FiltersProps {
  params: ListSearchParams;
  onChange: (next: ListSearchParams) => void;
}

const READINESS_LABEL: Record<ReadinessState, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  diagnosis_aligned: 'Diagnosis aligned',
  solution_curious: 'Solution curious',
  solution_confident: 'Solution confident',
  stakeholder_validation_needed: 'Stakeholder validation needed',
  commercially_ready: 'Commercially ready',
  commit_ready: 'Commit ready',
};

const ALIGNMENT_LABEL: Record<AlignmentOutcome, string> = {
  over_projecting: 'Over-projecting',
  aligned: 'Aligned',
  under_projecting: 'Under-projecting',
};

export function Filters({ params, onChange }: FiltersProps) {
  const active = hasActiveFilters(params);

  const setReadiness = (values: string[]) => {
    onChange({
      ...params,
      readiness: values.length > 0 ? (values as ReadinessState[]) : undefined,
    });
  };

  const setAlignment = (value: string) => {
    onChange({
      ...params,
      alignment: value === 'any' ? undefined : (value as AlignmentOutcome),
    });
  };

  const setAtRisk = (checked: boolean) => {
    onChange({ ...params, atRisk: checked ? true : undefined });
  };

  const clearAll = () => {
    onChange({ sort: params.sort });
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={6}>
          <Text size="xs" fw={500} c="dimmed">
            Readiness state
          </Text>
          <Chip.Group
            multiple
            value={params.readiness ?? []}
            onChange={setReadiness}
          >
            <Group gap={6} wrap="wrap">
              {readinessStates.map((state) => (
                <Chip key={state} value={state} size="xs">
                  {READINESS_LABEL[state]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>

        <Stack gap={6}>
          <Text size="xs" fw={500} c="dimmed">
            Alignment
          </Text>
          <SegmentedControl
            size="xs"
            value={params.alignment ?? 'any'}
            onChange={setAlignment}
            data={[
              { value: 'any', label: 'Any' },
              ...alignmentOutcomes.map((o) => ({
                value: o,
                label: ALIGNMENT_LABEL[o],
              })),
            ]}
          />
        </Stack>

        <Stack gap={6}>
          <Text size="xs" fw={500} c="dimmed">
            At risk
          </Text>
          <Switch
            checked={params.atRisk === true}
            onChange={(e) => setAtRisk(e.currentTarget.checked)}
            label="Only show at-risk"
            size="sm"
          />
        </Stack>
      </Group>

      {active && (
        <Group justify="flex-end">
          <Button variant="subtle" size="xs" onClick={clearAll}>
            Clear all filters
          </Button>
        </Group>
      )}
    </Stack>
  );
}
