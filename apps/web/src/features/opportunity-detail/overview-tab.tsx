import { Anchor, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  IconBuilding,
  IconCalendarEvent,
  IconCoin,
  IconUser,
} from '@tabler/icons-react';
import type { MockBuyer, MockDiagnosis, MockOpportunity } from '../../mock/types';
import { PrecallIntelligence } from './precall-intelligence';

interface OverviewTabProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestDiagnosis: MockDiagnosis | null;
}

// The Overview tab (M17, PG-222/PG-223) — pre-call intelligence up top, then the
// opportunity context the rep captured. Readiness + alignment moved to the
// persistent score header, so this tab is prep-focused.
export function OverviewTab({ opportunity, buyer, latestDiagnosis }: OverviewTabProps) {
  return (
    <Stack gap="lg">
      <PrecallIntelligence
        opportunity={opportunity}
        buyer={buyer}
        latestDiagnosis={latestDiagnosis}
      />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <OpportunityContextCard opportunity={opportunity} />
        <BuyerContactCard buyer={buyer} />
      </SimpleGrid>
    </Stack>
  );
}

function OpportunityContextCard({ opportunity }: { opportunity: MockOpportunity }) {
  const hasNotes =
    !!opportunity.knownPain || !!opportunity.knownObjection || !!opportunity.dealNotes;
  return (
    <Section title="Opportunity context">
      <Stack gap="sm">
        <Field
          icon={<IconCoin size={14} />}
          label="Value"
          value={
            opportunity.opportunityValue != null
              ? `$${opportunity.opportunityValue.toLocaleString()}`
              : null
          }
        />
        <Field
          icon={<IconCalendarEvent size={14} />}
          label="Expected close"
          value={opportunity.expectedCloseDate}
        />
        <Field
          icon={<IconBuilding size={14} />}
          label="CRM stage"
          value={opportunity.currentCrmStage}
        />
        {hasNotes && (
          <Stack gap="sm" mt={4}>
            <LongField label="Known pain" value={opportunity.knownPain} />
            <LongField label="Known objection" value={opportunity.knownObjection} />
            <LongField label="Deal notes" value={opportunity.dealNotes} />
          </Stack>
        )}
        {!hasNotes && (
          <Text size="xs" c="dimmed" fs="italic">
            No pain, objection, or deal notes captured yet.
          </Text>
        )}
      </Stack>
    </Section>
  );
}

function BuyerContactCard({ buyer }: { buyer: MockBuyer | null }) {
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
        <Field
          icon={<IconUser size={14} />}
          label="Name"
          value={[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')}
        />
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
        {buyer.notes && <LongField label="Notes" value={buyer.notes} />}
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

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Group gap={4} w={120} wrap="nowrap" style={{ flexShrink: 0 }}>
        {icon && (
          <Text component="span" c="dimmed" style={{ display: 'inline-flex' }}>
            {icon}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </Group>
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
