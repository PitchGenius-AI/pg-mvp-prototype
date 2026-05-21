import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Paper,
  RingProgress,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconBox, IconBroadcast } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { useStartCopilot } from '../copilot';
import type { MockBuyer, MockOpportunity } from '../../mock/types';
import {
  confidenceColor,
  READINESS_LABELS,
  readinessColor,
  scoreColor,
  type ReadinessVm,
} from './badges';

interface ScoreHeaderProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  // Product name — shown only in multi-product workspaces (null = single product).
  productName: string | null;
  vm: ReadinessVm;
}

// The persistent score header (M17, PG-221) — fixed across all four tabs. The
// hero readiness score dominates; state, alignment, product, CRM stage, and
// confidence sit alongside it so the rep never loses the deal's headline.
export function ScoreHeader({ opportunity, buyer, productName, vm }: ScoreHeaderProps) {
  const startCopilot = useStartCopilot();
  const buyerLine = buyer
    ? [
        [buyer.firstName, buyer.lastName].filter(Boolean).join(' '),
        buyer.company,
        buyer.title,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Stack gap="sm">
      <Breadcrumbs separator="›">
        <Anchor component={Link} to="/" size="sm" c="dimmed">
          Workbench
        </Anchor>
        <Text size="sm">{opportunity.opportunityName}</Text>
      </Breadcrumbs>

      <Paper withBorder p="lg" radius="md">
        <Group align="center" gap="xl" wrap="nowrap">
          <Stack gap={6} align="center">
            <RingProgress
              size={108}
              thickness={9}
              roundCaps
              sections={[{ value: vm.score, color: scoreColor(vm.score) }]}
              label={
                <Stack gap={0} align="center">
                  <Text fw={700} fz={30} lh={1}>
                    {vm.score}
                  </Text>
                  <Text fz={9} c="dimmed" tt="uppercase" fw={600} lts={0.5}>
                    / 100
                  </Text>
                </Stack>
              }
            />
            {vm.isProvisional && (
              <Badge size="xs" variant="light" color="gray">
                Provisional
              </Badge>
            )}
          </Stack>

          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" align="center" wrap="nowrap">
              <Title order={3} lineClamp={2}>
                {opportunity.opportunityName}
              </Title>
              {opportunity.atRisk && (
                <Tooltip label="Flagged at risk">
                  <IconAlertTriangle
                    size={20}
                    color="var(--mantine-color-red-6)"
                    style={{ flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </Group>

            {buyerLine && (
              <Text size="sm" c="dimmed">
                {buyerLine}
              </Text>
            )}

            <Group gap="xs" mt={2} align="center">
              <Badge variant="light" color={readinessColor(vm.state)}>
                {READINESS_LABELS[vm.state]}
              </Badge>

              {vm.isProvisional ? (
                <Tooltip
                  multiline
                  w={260}
                  label="Pipeline alignment needs buyer evidence. Add an activity to check the deal against its CRM stage."
                >
                  <Badge variant="default" color="gray">
                    Alignment pending
                  </Badge>
                </Tooltip>
              ) : (
                <AlignmentBadge
                  outcome={opportunity.currentAlignmentOutcome}
                  level={opportunity.currentAlignmentLevel}
                  size="md"
                />
              )}

              {productName && (
                <Badge
                  variant="default"
                  color="gray"
                  leftSection={<IconBox size={12} />}
                >
                  {productName}
                </Badge>
              )}

              <Badge variant="default" color="gray">
                {opportunity.currentCrmStage}
              </Badge>

              {vm.confidence ? (
                <Badge variant="light" color={confidenceColor(vm.confidence)}>
                  {vm.confidence} confidence
                </Badge>
              ) : (
                <Tooltip
                  multiline
                  w={260}
                  label="This readiness is provisional — based on the CRM stage, not buyer evidence. It firms up after the first activity."
                >
                  <Badge variant="light" color="gray">
                    Unconfirmed
                  </Badge>
                </Tooltip>
              )}
            </Group>
          </Stack>

          {/* Launch-from-opportunity happy path (PG-236) — one button for both
              states: deep-link handoff if the desktop app is installed, route
              to /copilot to get it if not. */}
          <Button
            variant="light"
            leftSection={<IconBroadcast size={16} />}
            onClick={() => startCopilot(opportunity.id)}
            style={{ flexShrink: 0 }}
          >
            Start live co-pilot
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
