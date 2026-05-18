import { Center, Container, Paper, Stack, Tabs, Text } from '@mantine/core';
import { useMemo } from 'react';
import {
  useInteractions,
  useLatestDiagnosis,
  useOpportunity,
} from '../../mock/hooks';
import { useBuyerById } from '../../mock/store';
import { DEFAULT_TAB, type DetailTab } from './detail-search';
import { EvidenceTab } from './evidence-tab';
import { ExportTab } from './export-tab';
import { DiagnosisTab } from './diagnosis-tab';
import { OpportunityHeader } from './opportunity-header';
import { OutcomeTab } from './outcome-tab';
import { OverviewTab } from './overview-tab';

interface DetailPageProps {
  opportunityId: string;
  tab: DetailTab | undefined;
  onTabChange: (tab: DetailTab) => void;
}

export function DetailPage({ opportunityId, tab, onTabChange }: DetailPageProps) {
  const { data: opportunity, isLoading } = useOpportunity(opportunityId);
  const buyer = useBuyerById(opportunity?.buyerId);
  const { data: interactions = [] } = useInteractions(opportunity?.id);
  const { data: latestDiagnosis = null } = useLatestDiagnosis(opportunity?.id);

  const latestInteractionDate = useMemo(() => {
    if (interactions.length === 0) return null;
    return interactions.reduce(
      (latest, i) => (i.interactionDate > latest ? i.interactionDate : latest),
      interactions[0]!.interactionDate,
    );
  }, [interactions]);

  if (isLoading) {
    return (
      <Container size="xl" py="lg">
        <Text c="dimmed">Loading…</Text>
      </Container>
    );
  }

  if (!opportunity) {
    return <NotFound />;
  }

  const activeTab = tab ?? DEFAULT_TAB;

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <OpportunityHeader
          opportunity={opportunity}
          buyer={buyer}
          latestInteractionDate={latestInteractionDate}
        />

        <Tabs
          value={activeTab}
          onChange={(value) => value && onTabChange(value as DetailTab)}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="evidence">
              Evidence
              {interactions.length > 0 && (
                <Text component="span" size="xs" c="dimmed" ml={6}>
                  {interactions.length}
                </Text>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="diagnosis">Diagnosis</Tabs.Tab>
            <Tabs.Tab value="outcome">Outcome</Tabs.Tab>
            <Tabs.Tab value="export">Export</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <OverviewTab
              opportunity={opportunity}
              buyer={buyer}
              latestDiagnosis={latestDiagnosis}
              interactionCount={interactions.length}
              interactions={interactions}
            />
          </Tabs.Panel>
          <Tabs.Panel value="evidence" pt="lg">
            <EvidenceTab
              opportunity={opportunity}
              interactions={interactions}
              onJumpToDiagnosis={() => onTabChange('diagnosis')}
            />
          </Tabs.Panel>
          <Tabs.Panel value="diagnosis" pt="lg">
            <DiagnosisTab opportunity={opportunity} diagnosis={latestDiagnosis} />
          </Tabs.Panel>
          <Tabs.Panel value="outcome" pt="lg">
            <OutcomeTab
              opportunity={opportunity}
              latestDiagnosis={latestDiagnosis}
            />
          </Tabs.Panel>
          <Tabs.Panel value="export" pt="lg">
            <ExportTab
              opportunity={opportunity}
              buyer={buyer}
              diagnosis={latestDiagnosis}
              interactions={interactions}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}

function NotFound() {
  return (
    <Container size="md" py="xl">
      <Center py="xl">
        <Paper withBorder p="xl" radius="md" maw={480}>
          <Stack align="center" gap="sm">
            <Text fw={600} size="lg">
              Opportunity not found
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              This opportunity may have been deleted or never existed. Head back to the list
              and try again.
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}
