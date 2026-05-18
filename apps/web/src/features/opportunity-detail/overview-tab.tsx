import {
  Anchor,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { IconArrowNarrowRight, IconClock } from '@tabler/icons-react';
import { AlignmentBadge } from '../../components/alignment-badge';
import { useDiagnosesForOpportunity } from '../../mock/store';
import type {
  MockBuyer,
  MockDiagnosis,
  MockInteraction,
  MockOpportunity,
} from '../../mock/types';
import { confidenceColor, humanize } from './badges';

interface OverviewTabProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestDiagnosis: MockDiagnosis | null;
  interactionCount: number;
  interactions: MockInteraction[];
}

export function OverviewTab({
  opportunity,
  buyer,
  latestDiagnosis,
  interactionCount,
  interactions,
}: OverviewTabProps) {
  const diagnoses = useDiagnosesForOpportunity(opportunity.id);
  return (
    <Stack gap="lg">
      <AtAGlance
        opportunity={opportunity}
        latestDiagnosis={latestDiagnosis}
        interactionCount={interactionCount}
      />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <BuyerCard buyer={buyer} />
        <OpportunityCard opportunity={opportunity} />
      </SimpleGrid>
      {(opportunity.knownPain || opportunity.knownObjection || opportunity.dealNotes) && (
        <NotesCard opportunity={opportunity} />
      )}
      <ReadinessTrend interactions={interactions} diagnoses={diagnoses} />
    </Stack>
  );
}

function AtAGlance({
  opportunity,
  latestDiagnosis,
  interactionCount,
}: {
  opportunity: MockOpportunity;
  latestDiagnosis: MockDiagnosis | null;
  interactionCount: number;
}) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      <StatCard label="Readiness state">
        {opportunity.currentReadinessState ? (
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {humanize(opportunity.currentReadinessState)}
            </Text>
            {opportunity.currentReadinessScore != null && (
              <Text size="xs" c="dimmed">
                Score {opportunity.currentReadinessScore}/100
              </Text>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No diagnosis yet
          </Text>
        )}
      </StatCard>
      <StatCard label="Alignment">
        <AlignmentBadge
          outcome={opportunity.currentAlignmentOutcome}
          level={opportunity.currentAlignmentLevel}
          size="md"
        />
      </StatCard>
      <StatCard label="Confidence">
        {latestDiagnosis ? (
          <Badge variant="light" color={confidenceColor(latestDiagnosis.confidenceLevel)}>
            {latestDiagnosis.confidenceLevel}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </StatCard>
      <StatCard label="Interactions">
        <Text fw={600} size="lg">
          {interactionCount}
        </Text>
      </StatCard>
    </SimpleGrid>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
          {label}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

function BuyerCard({ buyer }: { buyer: MockBuyer | null }) {
  if (!buyer) {
    return (
      <Section title="Buyer">
        <Text size="sm" c="dimmed">
          Buyer record missing.
        </Text>
      </Section>
    );
  }
  return (
    <Section title="Buyer">
      <Stack gap="sm">
        <Field label="Name" value={[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')} />
        <Field label="Title" value={buyer.title} />
        <Field label="Company" value={buyer.company} />
        <Field
          label="Email"
          value={
            buyer.email ? (
              <Anchor href={`mailto:${buyer.email}`} size="sm">
                {buyer.email}
              </Anchor>
            ) : null
          }
        />
        <Field
          label="LinkedIn"
          value={
            buyer.linkedin ? (
              <Anchor href={buyer.linkedin} target="_blank" rel="noreferrer" size="sm">
                {buyer.linkedin}
              </Anchor>
            ) : null
          }
        />
      </Stack>
    </Section>
  );
}

function OpportunityCard({ opportunity }: { opportunity: MockOpportunity }) {
  return (
    <Section title="Opportunity">
      <Stack gap="sm">
        <Field label="Name" value={opportunity.opportunityName} />
        <Field
          label="Value"
          value={
            opportunity.opportunityValue != null
              ? `$${opportunity.opportunityValue.toLocaleString()}`
              : null
          }
        />
        <Field label="Expected close" value={opportunity.expectedCloseDate} />
        <Field label="CRM stage" value={opportunity.currentCrmStage} />
      </Stack>
    </Section>
  );
}

function NotesCard({ opportunity }: { opportunity: MockOpportunity }) {
  return (
    <Section title="Notes">
      <Stack gap="sm">
        <LongField label="Known pain" value={opportunity.knownPain} />
        <LongField label="Known objection" value={opportunity.knownObjection} />
        <LongField label="Deal notes" value={opportunity.dealNotes} />
      </Stack>
    </Section>
  );
}

function ReadinessTrend({
  interactions,
  diagnoses,
}: {
  interactions: MockInteraction[];
  diagnoses: MockDiagnosis[];
}) {
  if (interactions.length === 0) {
    return (
      <Section title="Activity timeline">
        <Text size="sm" c="dimmed">
          No interactions yet. Add one in the Evidence tab to run a diagnosis.
        </Text>
      </Section>
    );
  }
  const dxByInteraction = new Map(diagnoses.map((d) => [d.interactionId, d]));
  const sorted = [...interactions].sort((a, b) =>
    a.interactionDate.localeCompare(b.interactionDate),
  );
  const diagnosedSorted = sorted.filter((i) => dxByInteraction.has(i.id));
  const showTrend = diagnosedSorted.length >= 2;
  return (
    <Section title="Activity timeline">
      <Stack gap="md">
        {showTrend && (
          <Group gap="xs" wrap="wrap">
            {diagnosedSorted.map((i, idx) => {
              const d = dxByInteraction.get(i.id)!;
              return (
                <Group key={i.id} gap={4} wrap="nowrap">
                  {idx > 0 && (
                    <IconArrowNarrowRight size={14} color="var(--mantine-color-dimmed)" />
                  )}
                  <Badge variant="light" size="sm" radius="sm">
                    {humanize(d.readinessState)} · {d.readinessScore}
                  </Badge>
                </Group>
              );
            })}
          </Group>
        )}
        <Stack gap="xs">
          {sorted.map((i) => {
            const d = dxByInteraction.get(i.id);
            return (
              <Group key={i.id} gap="sm">
                <IconClock size={14} color="var(--mantine-color-dimmed)" />
                <Text size="sm">{new Date(i.interactionDate).toLocaleDateString()}</Text>
                <Text size="xs" c="dimmed">
                  {humanize(i.interactionType)} · {i.participants.length} participant
                  {i.participants.length === 1 ? '' : 's'}
                </Text>
                {d && (
                  <Badge variant="default" size="xs">
                    {humanize(d.readinessState)} · {d.readinessScore}
                  </Badge>
                )}
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          {title}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Text size="xs" c="dimmed" w={100} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm">
        {value ?? (
          <Text component="span" size="sm" c="dimmed">
            —
          </Text>
        )}
      </Text>
    </Group>
  );
}

function LongField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {value}
      </Text>
    </Stack>
  );
}
