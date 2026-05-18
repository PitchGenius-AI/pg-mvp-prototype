import { Box, Center, Container, Paper, Stack, Tabs, Text, Transition } from '@mantine/core';
import { useMemo } from 'react';
import { ErrorState } from '../../components/error-boundary';
import { OpportunityDetailSkeleton } from '../../components/skeletons/opportunity-detail-skeleton';
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
  const {
    data: opportunity,
    isLoading,
    isError,
    error,
    refetch,
  } = useOpportunity(opportunityId);
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
    return <OpportunityDetailSkeleton />;
  }

  if (isError) {
    return (
      <Container size="md" py="xl">
        <ErrorState
          title="Couldn't load this opportunity"
          description="Something went wrong fetching the deal. Retry, or head back to your list."
          error={error instanceof Error ? error : null}
          onRetry={() => refetch()}
        />
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
            <TabFade keyName={activeTab === 'overview' ? 'overview' : null}>
              <OverviewTab
                opportunity={opportunity}
                buyer={buyer}
                latestDiagnosis={latestDiagnosis}
                interactionCount={interactions.length}
                interactions={interactions}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="evidence" pt="lg">
            <TabFade keyName={activeTab === 'evidence' ? 'evidence' : null}>
              <EvidenceTab
                opportunity={opportunity}
                interactions={interactions}
                onJumpToDiagnosis={() => onTabChange('diagnosis')}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="diagnosis" pt="lg">
            <TabFade keyName={activeTab === 'diagnosis' ? 'diagnosis' : null}>
              <DiagnosisTab opportunity={opportunity} diagnosis={latestDiagnosis} />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="outcome" pt="lg">
            <TabFade keyName={activeTab === 'outcome' ? 'outcome' : null}>
              <OutcomeTab
                opportunity={opportunity}
                latestDiagnosis={latestDiagnosis}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="export" pt="lg">
            <TabFade keyName={activeTab === 'export' ? 'export' : null}>
              <ExportTab
                opportunity={opportunity}
                buyer={buyer}
                diagnosis={latestDiagnosis}
                interactions={interactions}
              />
            </TabFade>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}

// `keepMounted={false}` on Tabs unmounts inactive panels. The `mounted` flag is
// truthy only while the panel is the active tab, so Transition runs its fade
// each time the user switches. `keyName` doubles as the tab id so React resets
// the inner subtree when navigating between tabs.
function TabFade({ keyName, children }: { keyName: string | null; children: React.ReactNode }) {
  return (
    <Transition mounted={keyName !== null} transition="fade" duration={160} timingFunction="ease">
      {(styles) => <Box style={styles}>{children}</Box>}
    </Transition>
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
