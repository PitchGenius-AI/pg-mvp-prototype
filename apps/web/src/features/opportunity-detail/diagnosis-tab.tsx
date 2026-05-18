import {
  Accordion,
  ActionIcon,
  Badge,
  Card,
  Center,
  Code,
  Divider,
  Group,
  List,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBan,
  IconCheck,
  IconCopy,
  IconInfoCircle,
  IconMail,
  IconNotebook,
  IconPlayerPlay,
  IconTarget,
} from '@tabler/icons-react';
import type {
  Signal,
  SignalDimension,
  SignalExtraction,
} from '@pg/shared';
import type { MockDiagnosis, MockOpportunity } from '../../mock/types';
import { alignmentColor, confidenceColor, humanize, severityFromAlignment } from './badges';

interface DiagnosisTabProps {
  opportunity: MockOpportunity;
  diagnosis: MockDiagnosis | null;
}

const DIMENSION_LABELS: Record<SignalDimension, string> = {
  pain: 'Pain',
  trust: 'Trust',
  urgency: 'Urgency',
  solution_confidence: 'Solution confidence',
  commitment: 'Commitment',
  risk: 'Risk',
};

export function DiagnosisTab({ opportunity, diagnosis }: DiagnosisTabProps) {
  if (!diagnosis) {
    return (
      <Center py="xl">
        <Paper withBorder p="xl" radius="md" maw={520}>
          <Stack align="center" gap="sm">
            <IconInfoCircle size={36} color="var(--mantine-color-dimmed)" />
            <Text fw={600}>No diagnosis yet</Text>
            <Text size="sm" c="dimmed" ta="center">
              Add an interaction in the Evidence tab to generate a buyer readiness diagnosis.
            </Text>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const dx = diagnosis.diagnosis;
  return (
    <Stack gap="lg">
      <PipelineRealityCheck opportunity={opportunity} diagnosis={diagnosis} />

      <DimensionScores diagnosis={diagnosis} />

      <Blockers diagnosis={diagnosis} />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <RecommendedAction diagnosis={diagnosis} />
        <WhatNotToDoCard items={dx.what_not_to_do_yet} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <FollowUpEmailCard subject={dx.follow_up_email.subject} body={dx.follow_up_email.body} />
        <CoachingNoteCard note={dx.manager_coaching_note} />
      </SimpleGrid>

      <SignalsSection extraction={diagnosis.signalExtraction} />

      <MissingEvidence missing={diagnosis.signalExtraction.missing_evidence} />
    </Stack>
  );
}

// --- Pipeline Reality Check (FLAGSHIP) ---

function PipelineRealityCheck({
  opportunity,
  diagnosis,
}: {
  opportunity: MockOpportunity;
  diagnosis: MockDiagnosis;
}) {
  const dx = diagnosis.diagnosis;
  const check = dx.pipeline_reality_check;
  const severity = severityFromAlignment(check.outcome, check.level);
  const palette = wash(check.outcome, severity);

  return (
    <Card withBorder padding="lg" radius="md" style={{ background: palette.bg }}>
      <Stack gap="md">
        <Group gap="xs" align="center">
          {palette.icon}
          <Text fw={700} size="lg" c={palette.heading}>
            Pipeline Reality Check
          </Text>
          <Tooltip
            multiline
            w={280}
            label="The flagship insight: compares the rep's CRM stage to the buyer's evidence-based readiness, surfacing over- or under-projection before forecast day."
          >
            <IconInfoCircle size={14} color={palette.heading} />
          </Tooltip>
        </Group>

        <Group grow gap="md" align="flex-start" wrap="nowrap">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Your CRM stage
            </Text>
            <Text fw={600} size="xl">
              {opportunity.currentCrmStage}
            </Text>
          </Stack>
          <Center>
            <IconArrowRight size={28} color={palette.heading} />
          </Center>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Buyer's evidence-based readiness
            </Text>
            <Text fw={600} size="xl">
              {humanize(check.readiness_state)}
            </Text>
          </Stack>
        </Group>

        <Divider color={palette.divider} />

        <Stack gap="xs">
          <Group gap="xs">
            <Badge color={alignmentColor(check.outcome, check.level)} variant="filled">
              {humanize(check.outcome)}
              {check.level !== 'none' ? ` · ${check.level}` : ''}
            </Badge>
            <Badge variant="light" color={confidenceColor(diagnosis.confidenceLevel)}>
              {diagnosis.confidenceLevel} confidence
            </Badge>
          </Group>
          <Text size="sm">{check.reason}</Text>
        </Stack>
      </Stack>
    </Card>
  );
}

interface WashPalette {
  bg: string;
  heading: string;
  divider: string;
  icon: React.ReactNode;
}

function wash(outcome: string, severity: 'high' | 'medium' | 'low' | 'none'): WashPalette {
  if (outcome === 'over_projecting' && (severity === 'high' || severity === 'medium')) {
    return {
      bg: 'var(--mantine-color-red-light)',
      heading: 'var(--mantine-color-red-7)',
      divider: 'var(--mantine-color-red-3)',
      icon: <IconAlertTriangle size={20} color="var(--mantine-color-red-7)" />,
    };
  }
  if (outcome === 'over_projecting') {
    return {
      bg: 'var(--mantine-color-yellow-light)',
      heading: 'var(--mantine-color-yellow-8)',
      divider: 'var(--mantine-color-yellow-3)',
      icon: <IconAlertTriangle size={20} color="var(--mantine-color-yellow-8)" />,
    };
  }
  if (outcome === 'under_projecting') {
    return {
      bg: 'var(--mantine-color-blue-light)',
      heading: 'var(--mantine-color-blue-7)',
      divider: 'var(--mantine-color-blue-3)',
      icon: <IconInfoCircle size={20} color="var(--mantine-color-blue-7)" />,
    };
  }
  return {
    bg: 'var(--mantine-color-teal-light)',
    heading: 'var(--mantine-color-teal-8)',
    divider: 'var(--mantine-color-teal-3)',
    icon: <IconCheck size={20} color="var(--mantine-color-teal-8)" />,
  };
}

// --- Dimension scores ---

function DimensionScores({ diagnosis }: { diagnosis: MockDiagnosis }) {
  const dx = diagnosis.diagnosis;
  return (
    <Stack gap="sm">
      <Title order={4}>Dimension scores</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
        {dx.dimension_scores.map((d) => (
          <Paper key={d.dimension} withBorder p="md" radius="md">
            <Stack gap={6}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                {DIMENSION_LABELS[d.dimension] ?? humanize(d.dimension)}
              </Text>
              <Text fw={700} size="xl">
                {d.score}
                <Text component="span" size="sm" c="dimmed">
                  {' '}
                  / 100
                </Text>
              </Text>
              <Progress value={d.score} size="sm" color={scoreColor(d.score)} />
              <Text size="xs" c="dimmed">
                {d.diagnosis}
              </Text>
              {d.evidence.length > 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  {d.evidence.length} citation{d.evidence.length === 1 ? '' : 's'}
                </Text>
              )}
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return 'teal';
  if (score >= 40) return 'yellow';
  return 'red';
}

// --- Blockers ---

function Blockers({ diagnosis }: { diagnosis: MockDiagnosis }) {
  const { primaryBlocker, secondaryBlocker } = diagnosis;
  if (!primaryBlocker && !secondaryBlocker) return null;
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      {primaryBlocker && (
        <Paper withBorder p="md" radius="md" style={{ background: 'var(--mantine-color-red-light)' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <IconAlertTriangle size={16} color="var(--mantine-color-red-7)" />
              <Text fw={600} size="sm" c="red.7">
                Primary blocker
              </Text>
            </Group>
            <Text size="sm">{primaryBlocker}</Text>
          </Stack>
        </Paper>
      )}
      {secondaryBlocker && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Group gap="xs">
              <IconAlertTriangle size={16} color="var(--mantine-color-orange-7)" />
              <Text fw={600} size="sm" c="orange.7">
                Secondary blocker
              </Text>
            </Group>
            <Text size="sm">{secondaryBlocker}</Text>
          </Stack>
        </Paper>
      )}
    </SimpleGrid>
  );
}

// --- Recommended action + What not to do ---

function RecommendedAction({ diagnosis }: { diagnosis: MockDiagnosis }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group gap="xs">
          <IconPlayerPlay size={16} color="var(--mantine-color-teal-7)" />
          <Text fw={600} size="sm">
            Recommended next action
          </Text>
        </Group>
        <Text size="sm">{diagnosis.diagnosis.recommended_next_action}</Text>
      </Stack>
    </Paper>
  );
}

function WhatNotToDoCard({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group gap="xs">
          <IconBan size={16} color="var(--mantine-color-red-7)" />
          <Text fw={600} size="sm">
            What not to do yet
          </Text>
        </Group>
        <List size="sm" spacing={4}>
          {items.map((item, i) => (
            <List.Item key={i}>{item}</List.Item>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}

// --- Copy-to-clipboard cards ---

function FollowUpEmailCard({ subject, body }: { subject: string; body: string }) {
  const clipboard = useClipboard({ timeout: 2000 });
  const copyAll = () => {
    clipboard.copy(`Subject: ${subject}\n\n${body}`);
    notifications.show({ color: 'teal', title: 'Copied', message: 'Email copied to clipboard.' });
  };
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconMail size={16} color="var(--mantine-color-blue-7)" />
            <Text fw={600} size="sm">
              Follow-up email
            </Text>
          </Group>
          <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy email'}>
            <ActionIcon variant="subtle" onClick={copyAll} aria-label="Copy email">
              {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="sm" fw={500}>
          {subject}
        </Text>
        <Code block style={{ whiteSpace: 'pre-wrap' }}>
          {body}
        </Code>
      </Stack>
    </Paper>
  );
}

function CoachingNoteCard({ note }: { note: string }) {
  const clipboard = useClipboard({ timeout: 2000 });
  const copy = () => {
    clipboard.copy(note);
    notifications.show({
      color: 'teal',
      title: 'Copied',
      message: 'Coaching note copied to clipboard.',
    });
  };
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconNotebook size={16} color="var(--mantine-color-violet-7)" />
            <Text fw={600} size="sm">
              Manager coaching note
            </Text>
          </Group>
          <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy note'}>
            <ActionIcon variant="subtle" onClick={copy} aria-label="Copy coaching note">
              {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {note}
        </Text>
      </Stack>
    </Paper>
  );
}

// --- Signal cards (Observed + Inference) ---

function SignalsSection({ extraction }: { extraction: SignalExtraction }) {
  const dimensions: SignalDimension[] = [
    'pain',
    'trust',
    'urgency',
    'solution_confidence',
    'commitment',
    'risk',
  ];
  const nonEmpty = dimensions.filter((d) => (extraction[d] ?? []).length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <IconTarget size={18} />
        <Title order={4}>Signals</Title>
        <Tooltip
          multiline
          w={320}
          label="Each card shows what we observed (direct quote from your evidence) and what we inferred (interpretation). Source-coded so rep-attributed claims are visible: transcript = neutral, rep note = amber, checklist = blue."
        >
          <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" />
        </Tooltip>
      </Group>
      <Accordion multiple variant="separated" defaultValue={nonEmpty.slice(0, 2)}>
        {nonEmpty.map((dimension) => (
          <Accordion.Item key={dimension} value={dimension}>
            <Accordion.Control>
              <Group gap="xs">
                <Text fw={500}>{DIMENSION_LABELS[dimension]}</Text>
                <Badge size="sm" variant="light" color="gray">
                  {extraction[dimension].length}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {extraction[dimension].map((s, i) => (
                  <SignalCard key={i} signal={s} />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <Paper withBorder p="sm" radius="sm">
      <Stack gap={6}>
        <Group gap={6}>
          <Badge size="xs" color={sourceColor(signal.source)} variant="light">
            {humanize(signal.source)}
          </Badge>
          <Badge size="xs" color={strengthColor(signal.strength)} variant="light">
            {signal.strength}
          </Badge>
        </Group>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={500}>
            Observed evidence
          </Text>
          <Text size="sm" fs="italic">
            "{signal.evidence}"
          </Text>
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={500}>
            AI inference
          </Text>
          <Text size="sm">{signal.signal}</Text>
        </Stack>
      </Stack>
    </Paper>
  );
}

function sourceColor(source: string): string {
  if (source === 'rep_note') return 'orange';
  if (source === 'checklist') return 'blue';
  return 'gray';
}

function strengthColor(strength: string): string {
  if (strength === 'strong') return 'teal';
  if (strength === 'medium') return 'yellow';
  return 'gray';
}

function MissingEvidence({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group gap="xs">
          <IconInfoCircle size={16} color="var(--mantine-color-orange-7)" />
          <Text fw={600} size="sm">
            Missing evidence
          </Text>
          <Tooltip label="Things we'd need to see in your evidence to raise confidence on this diagnosis.">
            <IconInfoCircle size={12} color="var(--mantine-color-dimmed)" />
          </Tooltip>
        </Group>
        <List size="sm" spacing={4} icon={<IconInfoCircle size={12} />}>
          {missing.map((item, i) => (
            <List.Item key={i}>{item}</List.Item>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}
