import {
  Anchor,
  Badge,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { useBuyerById } from '../../mock/store';
import { useOpportunity } from '../../mock/hooks';
import type { MockBuyer, MockOpportunity } from '../../mock/types';

export const Route = createFileRoute('/_authed/opportunities/$opportunityId')({
  component: OpportunityDetailPage,
});

// M4 prototype: Overview tab is filled in so the post-save flow isn't a dead
// end. M6 owns the remaining tabs (Evidence / Diagnosis / Outcome / Export).
function OpportunityDetailPage() {
  const { opportunityId } = Route.useParams();
  const { data: opportunity, isLoading } = useOpportunity(opportunityId);
  const buyer = useBuyerById(opportunity?.buyerId);

  return (
    <Container size="xl" py="lg">
      <Stack>
        {isLoading && <Text c="dimmed">Loading…</Text>}
        {!isLoading && !opportunity && <Text c="red">Opportunity not found.</Text>}
        {opportunity && (
          <>
            <DetailHeader opportunity={opportunity} buyer={buyer} />
            <Tabs defaultValue="overview" mt="sm">
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="evidence">Evidence</Tabs.Tab>
                <Tabs.Tab value="diagnosis">Diagnosis</Tabs.Tab>
                <Tabs.Tab value="outcome">Outcome</Tabs.Tab>
                <Tabs.Tab value="export">Export</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="overview" pt="lg">
                <OverviewTab opportunity={opportunity} buyer={buyer} />
              </Tabs.Panel>
              <Tabs.Panel value="evidence" pt="lg">
                <ComingInM6 surface="Evidence" />
              </Tabs.Panel>
              <Tabs.Panel value="diagnosis" pt="lg">
                <ComingInM6 surface="Diagnosis" />
              </Tabs.Panel>
              <Tabs.Panel value="outcome" pt="lg">
                <ComingInM6 surface="Outcome" />
              </Tabs.Panel>
              <Tabs.Panel value="export" pt="lg">
                <ComingInM6 surface="Export" />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}

function DetailHeader({
  opportunity,
  buyer,
}: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
}) {
  return (
    <Stack gap={4}>
      <Group gap="sm" align="center">
        <Title order={2}>{opportunity.opportunityName}</Title>
        {opportunity.atRisk && <Badge color="red">At risk</Badge>}
      </Group>
      {buyer && (
        <Text size="sm" c="dimmed">
          {fullName(buyer)} · {buyer.company}
          {buyer.title ? ` · ${buyer.title}` : ''}
        </Text>
      )}
      <Group gap="xs" mt={4}>
        <Badge variant="light" color="gray">
          {opportunity.currentCrmStage}
        </Badge>
        {opportunity.currentReadinessState && (
          <Badge variant="light">
            {opportunity.currentReadinessState.replace(/_/g, ' ')}
            {opportunity.currentReadinessScore != null
              ? ` · ${opportunity.currentReadinessScore}`
              : ''}
          </Badge>
        )}
        {opportunity.currentAlignmentOutcome && (
          <Badge
            variant="light"
            color={alignmentColor(
              opportunity.currentAlignmentOutcome,
              opportunity.currentAlignmentLevel,
            )}
          >
            {opportunity.currentAlignmentOutcome.replace(/_/g, ' ')}
            {opportunity.currentAlignmentLevel && opportunity.currentAlignmentLevel !== 'none'
              ? ` · ${opportunity.currentAlignmentLevel}`
              : ''}
          </Badge>
        )}
      </Group>
    </Stack>
  );
}

function OverviewTab({
  opportunity,
  buyer,
}: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
}) {
  return (
    <Stack gap="lg">
      <Section title="Buyer">
        {buyer ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Field label="Name" value={fullName(buyer)} />
            <Field label="Company" value={buyer.company} />
            <Field label="Title" value={buyer.title} />
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
          </SimpleGrid>
        ) : (
          <Text c="dimmed" size="sm">
            Buyer record missing.
          </Text>
        )}
      </Section>

      <Section title="Deal">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Field label="CRM stage" value={opportunity.currentCrmStage} />
          <Field
            label="Value"
            value={
              opportunity.opportunityValue != null
                ? `$${opportunity.opportunityValue.toLocaleString()}`
                : null
            }
          />
          <Field label="Expected close" value={opportunity.expectedCloseDate} />
          <Field label="At risk" value={opportunity.atRisk ? 'Yes' : 'No'} />
        </SimpleGrid>
      </Section>

      {(opportunity.knownPain || opportunity.knownObjection || opportunity.dealNotes) && (
        <Section title="Notes">
          <Stack gap="sm">
            <LongField label="Known pain" value={opportunity.knownPain} />
            <LongField label="Known objection" value={opportunity.knownObjection} />
            <LongField label="Deal notes" value={opportunity.dealNotes} />
          </Stack>
        </Section>
      )}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      {value ? (
        typeof value === 'string' ? (
          <Text size="sm">{value}</Text>
        ) : (
          value
        )
      ) : (
        <Text size="sm" c="dimmed">
          —
        </Text>
      )}
    </Stack>
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

function ComingInM6({ surface }: { surface: string }) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap={4}>
        <Text fw={500}>{surface} — coming in M6</Text>
        <Text size="sm" c="dimmed">
          The {surface.toLowerCase()} tab is part of the opportunity-detail milestone (M6).
        </Text>
      </Stack>
    </Paper>
  );
}

function fullName(buyer: MockBuyer): string {
  return [buyer.firstName, buyer.lastName].filter(Boolean).join(' ');
}

function alignmentColor(outcome: string, level: string | null): string {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'yellow';
  }
  if (outcome === 'under_projecting') return 'blue';
  return 'teal';
}
