import {
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { outcomeTypes, type OutcomeType } from '@pg/shared';
import { useOutcomes, useRecordOutcome } from '../../mock/hooks';
import { useCurrentSession } from '../../mock/store';
import type { MockDiagnosis, MockOpportunity, MockOutcome } from '../../mock/types';
import { humanize } from './badges';

interface OutcomeTabProps {
  opportunity: MockOpportunity;
  latestDiagnosis: MockDiagnosis | null;
}

const OUTCOME_OPTIONS = outcomeTypes.map((value) => ({
  value,
  label: humanize(value),
}));

export function OutcomeTab({ opportunity, latestDiagnosis }: OutcomeTabProps) {
  const session = useCurrentSession();
  const { data: history = [] } = useOutcomes(opportunity.id);
  const { mutate, isPending } = useRecordOutcome();

  const [outcomeType, setOutcomeType] = useState<OutcomeType>('buyer_replied');
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState({
    dealAdvanced: false,
    buyerReplied: true,
    nextMeetingBooked: false,
    stakeholderAdded: false,
    closedWon: false,
    closedLost: false,
  });

  const handleSave = () => {
    if (!session || !latestDiagnosis) {
      notifications.show({
        color: 'red',
        title: 'No diagnosis yet',
        message: 'Add an interaction to generate a diagnosis before recording an outcome.',
      });
      return;
    }
    mutate(
      {
        workspaceId: session.workspaceId,
        opportunityId: opportunity.id,
        diagnosisId: latestDiagnosis.id,
        outcomeType,
        outcomeNotes: notes.trim() || null,
        ...flags,
      },
      {
        onSuccess: () => {
          notifications.show({
            color: 'teal',
            title: 'Outcome recorded',
            message: 'Saved against the latest diagnosis.',
          });
          setNotes('');
        },
      },
    );
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Stack gap={2}>
            <Text fw={600}>Record outcome</Text>
            <Text size="xs" c="dimmed">
              {latestDiagnosis
                ? 'Saved against the latest diagnosis so the system can learn what worked.'
                : 'You need at least one diagnosis to record an outcome.'}
            </Text>
          </Stack>

          <Select
            label="Primary outcome"
            data={OUTCOME_OPTIONS}
            value={outcomeType}
            onChange={(v) => v && setOutcomeType(v as OutcomeType)}
            allowDeselect={false}
            disabled={!latestDiagnosis}
          />

          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Additional signals
            </Text>
            <Group gap="md" wrap="wrap">
              <Checkbox
                label="Deal advanced"
                checked={flags.dealAdvanced}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, dealAdvanced: checked }));
                }}
                disabled={!latestDiagnosis}
              />
              <Checkbox
                label="Buyer replied"
                checked={flags.buyerReplied}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, buyerReplied: checked }));
                }}
                disabled={!latestDiagnosis}
              />
              <Checkbox
                label="Next meeting booked"
                checked={flags.nextMeetingBooked}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, nextMeetingBooked: checked }));
                }}
                disabled={!latestDiagnosis}
              />
              <Checkbox
                label="Stakeholder added"
                checked={flags.stakeholderAdded}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, stakeholderAdded: checked }));
                }}
                disabled={!latestDiagnosis}
              />
              <Checkbox
                label="Closed won"
                color="teal"
                checked={flags.closedWon}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, closedWon: checked }));
                }}
                disabled={!latestDiagnosis}
              />
              <Checkbox
                label="Closed lost"
                color="red"
                checked={flags.closedLost}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setFlags((f) => ({ ...f, closedLost: checked }));
                }}
                disabled={!latestDiagnosis}
              />
            </Group>
          </Stack>

          <Textarea
            label="Notes"
            placeholder="What happened? Anything worth remembering for the next call?"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={3}
            disabled={!latestDiagnosis}
          />

          <Group justify="flex-end">
            <Button onClick={handleSave} loading={isPending} disabled={!latestDiagnosis}>
              Record outcome
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Divider label="History" labelPosition="left" />

      {history.length === 0 ? (
        <Text size="sm" c="dimmed">
          No outcomes recorded yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {history.map((o) => (
            <OutcomeHistoryCard key={o.id} outcome={o} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function OutcomeHistoryCard({ outcome }: { outcome: MockOutcome }) {
  const flags = collectFlags(outcome);
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap={6}>
        <Group justify="space-between">
          <Text fw={500} size="sm">
            {humanize(outcome.outcomeType)}
          </Text>
          <Text size="xs" c="dimmed">
            {new Date(outcome.createdAt).toLocaleString()}
          </Text>
        </Group>
        {flags.length > 0 && (
          <Text size="xs" c="dimmed">
            {flags.join(' · ')}
          </Text>
        )}
        {outcome.outcomeNotes && (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {outcome.outcomeNotes}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function collectFlags(o: MockOutcome): string[] {
  const flags: string[] = [];
  if (o.dealAdvanced) flags.push('Deal advanced');
  if (o.buyerReplied) flags.push('Buyer replied');
  if (o.nextMeetingBooked) flags.push('Next meeting booked');
  if (o.stakeholderAdded) flags.push('Stakeholder added');
  if (o.closedWon) flags.push('Closed won');
  if (o.closedLost) flags.push('Closed lost');
  return flags;
}
