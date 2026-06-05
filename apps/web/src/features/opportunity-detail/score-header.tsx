import {
  ActionIcon,
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
import {
  IconAlertTriangle,
  IconBrandLinkedin,
  IconBroadcast,
  IconCircleCheck,
  IconMail,
  IconWorld,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useStartCopilot } from '../copilot';
import type { MockBuyer, MockOpportunity } from '../../mock/types';
import { scoreColor, type ReadinessVm } from './badges';

interface ScoreHeaderProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  // Product name — shown only in multi-product workspaces (null = single product).
  productName: string | null;
  vm: ReadinessVm;
}

// The persistent score header (M17, PG-221) — fixed across all tabs. Identity +
// key deal facts sit on the left; the hero readiness score and self-describing
// diagnosis pills sit on the right, so the rep never loses the deal's headline.
// The Co-pilot launch lives up on the breadcrumb row, out of the card.
export function ScoreHeader({ opportunity, buyer, productName, vm }: ScoreHeaderProps) {
  const startCopilot = useStartCopilot();
  // Lead identity headlines the card — the auto-generated opportunityName
  // (e.g. "Acme – inbound eval") is a weak identifier, so the buyer's
  // name leads and Company · Role sit beneath it. Falls back to the
  // opportunity name only when there's no buyer record.
  const leadName = buyer
    ? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ').trim()
    : '';
  const heroTitle = leadName || opportunity.opportunityName;
  const subLine = buyer
    ? [buyer.company, buyer.title].filter(Boolean).join(' · ')
    : null;

  const valueText =
    opportunity.opportunityValue != null
      ? `$${opportunity.opportunityValue.toLocaleString()}`
      : '—';

  // Alignment indicator on the CRM stage pill: a green check when the stage
  // matches the buyer's evidence-based readiness, otherwise a warning whose
  // severity tracks confidence (red when we're confident the stage is wrong,
  // yellow when the read is softer). Hidden while the deal is provisional —
  // there's no evidence-based alignment to compare against yet.
  const stageIndicator = buildStageIndicator(
    vm.isProvisional ? null : opportunity.currentAlignmentOutcome,
    vm.confidence,
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Breadcrumbs separator="›">
          <Anchor component={Link} to="/" size="sm" c="dimmed">
            Workbench
          </Anchor>
          <Text size="sm">{opportunity.opportunityName}</Text>
        </Breadcrumbs>

        {/* Launch-from-opportunity happy path (PG-236) — one button for both
            states: deep-link handoff if the desktop app is installed, route to
            /copilot to get it if not. */}
        <Button
          variant="light"
          leftSection={<IconBroadcast size={16} />}
          onClick={() => startCopilot(opportunity.id)}
          style={{ flexShrink: 0 }}
        >
          Start PG.AI PILOT
        </Button>
      </Group>

      <Paper withBorder p="lg" radius="md">
        <Group align="flex-start" justify="space-between" gap="xl" wrap="nowrap">
          {/* LEFT — identity + key deal facts */}
          <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
            <Stack gap={6}>
              <Group gap="xs" align="center" wrap="nowrap">
                <Title order={3} lineClamp={2}>
                  {heroTitle}
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

              {(subLine || buyer?.email || buyer?.linkedin || buyer?.website) && (
                <Group gap="xs" align="center" wrap="nowrap">
                  {subLine && (
                    <Text size="sm" c="dimmed">
                      {subLine}
                    </Text>
                  )}
                  {buyer?.email && (
                    <Tooltip label={buyer.email}>
                      <ActionIcon
                        component="a"
                        href={`mailto:${buyer.email}`}
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={`Email ${leadName || 'the buyer'}`}
                      >
                        <IconMail size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {buyer?.linkedin && (
                    <Tooltip label="LinkedIn profile">
                      <ActionIcon
                        component="a"
                        href={buyer.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={`LinkedIn profile for ${leadName || 'the buyer'}`}
                      >
                        <IconBrandLinkedin size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {buyer?.website && (
                    <Tooltip label={buyer.website}>
                      <ActionIcon
                        component="a"
                        href={buyer.website}
                        target="_blank"
                        rel="noreferrer"
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={`Website for ${buyer.company || 'the company'}`}
                      >
                        <IconWorld size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              )}
            </Stack>

            <Group gap="xs" wrap="wrap">
              {productName && <FieldPill label="Product" value={productName} />}
              <FieldPill label="Value" value={valueText} />
              <FieldPill
                label="CRM stage"
                value={opportunity.currentCrmStage}
                indicator={stageIndicator}
              />
              <FieldPill label="Expected close" value={opportunity.expectedCloseDate || '—'} />
            </Group>
          </Stack>

          {/* RIGHT — buyer readiness score (the diagnosis detail now lives in
              the Overview tab, so the header carries just the headline number) */}
          <Stack gap={6} align="center" style={{ flexShrink: 0 }}>
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
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
              Buyer readiness
            </Text>
            {vm.isProvisional && (
              <Badge size="xs" variant="light" color="gray">
                Provisional
              </Badge>
            )}
          </Stack>
        </Group>
      </Paper>
    </Stack>
  );
}

// CRM-stage alignment indicator. Green check when the stage is aligned with the
// buyer's evidence-based readiness; a warning otherwise, red when confidence in
// the misalignment is high and yellow when it's softer. `outcome` is null while
// the deal is provisional (no diagnosis), which renders no indicator.
function buildStageIndicator(
  outcome: string | null | undefined,
  confidence: string | null | undefined,
): React.ReactNode {
  if (!outcome) return null;
  if (outcome === 'aligned') {
    return (
      <Tooltip label="CRM stage matches the buyer's evidence-based readiness">
        <IconCircleCheck size={16} color="var(--mantine-color-teal-6)" />
      </Tooltip>
    );
  }
  const color = confidence === 'high' ? 'red' : 'yellow';
  const label =
    outcome === 'over_projecting'
      ? 'CRM stage is ahead of the buyer’s evidence-based readiness (over-projecting)'
      : 'Buyer is more ready than the CRM stage suggests (under-projecting)';
  return (
    <Tooltip multiline w={240} label={label}>
      <IconAlertTriangle size={16} color={`var(--mantine-color-${color}-7)`} />
    </Tooltip>
  );
}

// A self-describing pill: an uppercase label paired with its value, so the
// reader never has to guess what a bare badge represents. `color` tints the
// value (and a faint background) for the diagnosis pills; deal facts stay
// neutral.
function FieldPill({
  label,
  value,
  color,
  indicator,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  // Optional trailing status icon (e.g. alignment check/warning on CRM stage).
  indicator?: React.ReactNode;
}) {
  return (
    <Group
      gap={8}
      wrap="nowrap"
      px={10}
      py={4}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-sm)',
        backgroundColor: color
          ? `var(--mantine-color-${color}-light)`
          : 'var(--mantine-color-body)',
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} style={{ whiteSpace: 'nowrap' }}>
        {label}
      </Text>
      <Text
        size="sm"
        fw={600}
        c={color ? `${color}.8` : undefined}
        style={{ whiteSpace: 'nowrap' }}
      >
        {value}
      </Text>
      {indicator && (
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{indicator}</span>
      )}
    </Group>
  );
}
