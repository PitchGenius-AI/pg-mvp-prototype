import { Button, Container, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconFileSpreadsheet,
  IconForms,
  IconHistory,
} from '@tabler/icons-react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { ActivityImport } from './activity-import';
import { DailyImport } from './daily-import';
import { DEFAULT_INTAKE_METHOD, type IntakeMethod } from './intake-search';
import { StructuredForm } from './structured-form';

const routeApi = getRouteApi('/_authed/buyers/new');

// The /buyers/new intake surface (M14, PG-209; +M15 PG-216; reworked PG-241) —
// reached from the Workbench "Add opportunity" button and the Buyers
// "Add buyer" button. Three methods as tabs: Daily Workbench import (bulk
// onboarding from the rep's CRM, default), Manual Entry (one fully-formed
// deal), and Activity history (M15 — backfills evidence onto deals that
// already exist).
export function BuyersIntakePage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const rootNavigate = useNavigate();
  const method = search.method ?? DEFAULT_INTAKE_METHOD;

  const handleSingleSuccess = (opportunityId: string, sourceLabel: string) => {
    notifications.show({
      color: 'teal',
      title: 'Opportunity added',
      message: `Saved via ${sourceLabel}.`,
    });
    rootNavigate({ to: '/opportunities/$opportunityId', params: { opportunityId } });
  };

  const setMethod = (value: string | null) => {
    const next = (value ?? DEFAULT_INTAKE_METHOD) as IntakeMethod;
    navigate({
      search: { method: next === DEFAULT_INTAKE_METHOD ? undefined : next },
      replace: true,
    });
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Group>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => rootNavigate({ to: '/' })}
            >
              Back to workbench
            </Button>
          </Group>
          <Title order={2}>Add to your workbench</Title>
          <Text size="sm" c="dimmed">
            Bring buyers in — a bulk import from your CRM or one fully-formed
            deal at a time — then backfill their activity history so readiness
            scores from real conversations.
          </Text>
        </Stack>

        <Tabs value={method} onChange={setMethod} keepMounted={false}>
          <Tabs.List grow mb="lg">
            <Tabs.Tab value="import" leftSection={<IconFileSpreadsheet size={16} />}>
              Daily Workbench import
            </Tabs.Tab>
            <Tabs.Tab value="structured" leftSection={<IconForms size={16} />}>
              Manual Entry
            </Tabs.Tab>
            <Tabs.Tab value="activity" leftSection={<IconHistory size={16} />}>
              Activity history
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="import">
            <DailyImport />
          </Tabs.Panel>
          <Tabs.Panel value="structured">
            <StructuredForm
              onSuccess={(id) => handleSingleSuccess(id, 'manual entry')}
            />
          </Tabs.Panel>
          <Tabs.Panel value="activity">
            <ActivityImport />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
