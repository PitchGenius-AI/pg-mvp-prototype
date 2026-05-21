import { Box, Center, Container, Paper, Stack, Tabs, Text, Transition } from '@mantine/core';
import { useMemo } from 'react';
import { ErrorState } from '../../components/error-boundary';
import { OpportunityDetailSkeleton } from '../../components/skeletons/opportunity-detail-skeleton';
import {
  useActivities,
  useLatestDiagnosis,
  useOpportunity,
  useProducts,
} from '../../mock/hooks';
import { useBuyerById } from '../../mock/store';
import { ActivityTab } from './activity-tab';
import { deriveReadinessVm } from './badges';
import { DEFAULT_TAB, type DetailTab } from './detail-search';
import { DiagnosisTab } from './diagnosis-tab';
import { ExportTab } from './export-tab';
import { OverviewTab } from './overview-tab';
import { ScoreHeader } from './score-header';

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
  const { data: activities = [] } = useActivities(opportunity?.id);
  const { data: latestDiagnosis = null } = useLatestDiagnosis(opportunity?.id);
  const { data: products = [] } = useProducts();

  const vm = useMemo(
    () => (opportunity ? deriveReadinessVm(opportunity, latestDiagnosis) : null),
    [opportunity, latestDiagnosis],
  );

  // Product name is only worth showing when the workspace runs more than one.
  const productName = useMemo(() => {
    if (!opportunity || products.length <= 1) return null;
    return products.find((p) => p.id === opportunity.productId)?.name ?? null;
  }, [opportunity, products]);

  if (isLoading) {
    return <OpportunityDetailSkeleton />;
  }

  if (isError) {
    return (
      <Container size="md" py="xl">
        <ErrorState
          title="Couldn't load this opportunity"
          description="Something went wrong fetching the deal. Retry, or head back to your workbench."
          error={error instanceof Error ? error : null}
          onRetry={() => refetch()}
        />
      </Container>
    );
  }

  if (!opportunity || !vm) {
    return <NotFound />;
  }

  const activeTab = tab ?? DEFAULT_TAB;

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <ScoreHeader
          opportunity={opportunity}
          buyer={buyer}
          productName={productName}
          vm={vm}
        />

        <Tabs
          value={activeTab}
          onChange={(value) => value && onTabChange(value as DetailTab)}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="activity">
              Activity
              {activities.length > 0 && (
                <Text component="span" size="xs" c="dimmed" ml={6}>
                  {activities.length}
                </Text>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="diagnosis">Diagnosis</Tabs.Tab>
            <Tabs.Tab value="export">Export</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <TabFade keyName={activeTab === 'overview' ? 'overview' : null}>
              <OverviewTab
                opportunity={opportunity}
                buyer={buyer}
                latestDiagnosis={latestDiagnosis}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="activity" pt="lg">
            <TabFade keyName={activeTab === 'activity' ? 'activity' : null}>
              <ActivityTab
                opportunity={opportunity}
                activities={activities}
                onJumpToDiagnosis={() => onTabChange('diagnosis')}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="diagnosis" pt="lg">
            <TabFade keyName={activeTab === 'diagnosis' ? 'diagnosis' : null}>
              <DiagnosisTab
                opportunity={opportunity}
                diagnosis={latestDiagnosis}
                vm={vm}
                onAddActivity={() => onTabChange('activity')}
              />
            </TabFade>
          </Tabs.Panel>
          <Tabs.Panel value="export" pt="lg">
            <TabFade keyName={activeTab === 'export' ? 'export' : null}>
              <ExportTab
                opportunity={opportunity}
                buyer={buyer}
                diagnosis={latestDiagnosis}
                vm={vm}
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
              This opportunity may have been deleted or never existed. Head back to the
              workbench and try again.
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}
