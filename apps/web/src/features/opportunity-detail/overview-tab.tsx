import { Divider, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import type { MockBuyer, MockDiagnosis, MockOpportunity } from '../../mock/types';
import type { ReadinessVm } from './badges';
import {
  FollowUpEmailCard,
  PipelineRealityCheck,
  ProvisionalDiagnosis,
  RecommendedAction,
  WhatNotToDoCard,
} from './diagnosis-tab';
import { PrecallIntelligence } from './precall-intelligence';

interface OverviewTabProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestDiagnosis: MockDiagnosis | null;
  vm: ReadinessVm;
  onAddActivity: () => void;
  onViewDiagnosis: () => void;
}

// The Overview tab (M17, PG-222/PG-223) — the deal's prep surface. Leads with the
// Pipeline Reality Check (the flagship insight), which links into the Diagnosis
// tab for the full supporting detail; before any activity it shows a provisional
// read instead. Then pre-call intelligence, then the qualitative context the rep
// captured. The headline score/state live in the persistent score header above;
// value/close/CRM stage moved there too, so the context card here is notes-only.
export function OverviewTab({
  opportunity,
  buyer,
  latestDiagnosis,
  vm,
  onAddActivity,
  onViewDiagnosis,
}: OverviewTabProps) {
  return (
    <Stack gap="xl">
      {latestDiagnosis ? (
        <Stack gap="md">
          <PipelineRealityCheck
            opportunity={opportunity}
            diagnosis={latestDiagnosis}
            onViewDiagnosis={onViewDiagnosis}
          />
          {/* Copies of the action guidance from the Diagnosis tab, surfaced here
              so the rep gets next-step direction without leaving the Overview. */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <RecommendedAction diagnosis={latestDiagnosis} />
            <WhatNotToDoCard items={latestDiagnosis.diagnosis.what_not_to_do_yet} />
          </SimpleGrid>
          <FollowUpEmailCard
            subject={latestDiagnosis.diagnosis.follow_up_email.subject}
            body={latestDiagnosis.diagnosis.follow_up_email.body}
          />
        </Stack>
      ) : (
        <ProvisionalDiagnosis
          opportunity={opportunity}
          vm={vm}
          onAddActivity={onAddActivity}
        />
      )}
      <Divider />
      <PrecallIntelligence
        opportunity={opportunity}
        buyer={buyer}
        latestDiagnosis={latestDiagnosis}
      />
      <Divider />
      <OpportunityContextCard opportunity={opportunity} buyer={buyer} />
    </Stack>
  );
}

// Notes-only now — the structured deal facts (value, close, CRM stage) live in
// the persistent score header, so this card holds just the qualitative context
// the rep captured.
function OpportunityContextCard({
  opportunity,
  buyer,
}: {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
}) {
  const hasNotes =
    !!opportunity.knownPain || !!opportunity.knownObjection || !!opportunity.dealNotes;
  return (
    <Section title="Opportunity context">
      <Stack gap="sm">
        {hasNotes ? (
          <Stack gap="sm">
            <LongField label="Known pain" value={opportunity.knownPain} />
            <LongField label="Known objection" value={opportunity.knownObjection} />
            <LongField label="Deal notes" value={opportunity.dealNotes} />
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            No pain, objection, or deal notes captured yet.
          </Text>
        )}
        {buyer?.notes && (
          <Stack gap="sm" mt={4}>
            <LongField label="Buyer notes" value={buyer.notes} />
          </Stack>
        )}
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
