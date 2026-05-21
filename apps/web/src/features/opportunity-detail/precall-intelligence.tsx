import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCheck,
  IconRefresh,
  IconScript,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type {
  DiscType,
  GeneratedScript,
  PsychProfile,
} from '@pg/shared';
import {
  DISC_TYPE_LABELS,
  FAKE_PRECALL_STEPS,
  fakeGenerateScript,
  fakeGeneratePrecall,
  TECHNIQUE_LABELS,
  type GeneratePrecallInput,
} from '../../mock/fake-precall';
import {
  usePrecallIntelligence,
  useScriptTemplates,
  useSetPrecallIntelligence,
} from '../../mock/hooks';
import type {
  MockBuyer,
  MockDiagnosis,
  MockOpportunity,
  MockPrecallIntelligence,
} from '../../mock/types';

interface PrecallIntelligenceProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestDiagnosis: MockDiagnosis | null;
}

// The pre-call intelligence block on the Overview tab (M17, PG-222/PG-223):
// a DISC/OCEAN psychological profile, a matched sales technique, and a generated
// pre-call script. Generated from enrichment on first view (no activity needed)
// and cached per opportunity; the script is editable + regenerable.
export function PrecallIntelligence({
  opportunity,
  buyer,
  latestDiagnosis,
}: PrecallIntelligenceProps) {
  const { data: precall, isLoading } = usePrecallIntelligence(opportunity.id);
  const { data: scriptTemplates = [], isLoading: templatesLoading } = useScriptTemplates();
  const { mutateAsync: setPrecall } = useSetPrecallIntelligence();

  const [stepIndex, setStepIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const triggered = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const regenCount = useRef(0);

  const scriptTemplate =
    scriptTemplates.find((t) => t.isPrimary) ?? scriptTemplates[0] ?? null;

  const buildInput = (): GeneratePrecallInput => ({
    opportunity,
    buyer,
    scriptTemplate,
    latestDiagnosis,
  });

  // Clean up the stepper interval if the tab unmounts mid-generation.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const runGeneration = async () => {
    setFailed(false);
    setStepIndex(0);
    intervalRef.current = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, FAKE_PRECALL_STEPS.length - 1));
    }, 650);
    try {
      const result = fakeGeneratePrecall(buildInput());
      await setPrecall({ opportunityId: opportunity.id, ...result });
    } catch {
      setFailed(true);
    } finally {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  // Generate on first view once both queries have settled and nothing exists.
  useEffect(() => {
    if (
      !isLoading &&
      !templatesLoading &&
      !precall &&
      !triggered.current
    ) {
      triggered.current = true;
      void runGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, templatesLoading, precall]);

  const handleRegenerateScript = async () => {
    if (!precall) return;
    setRegenerating(true);
    try {
      regenCount.current += 1;
      const script = fakeGenerateScript(
        buildInput(),
        precall.matchedTechnique.technique,
        regenCount.current,
      );
      await setPrecall({
        opportunityId: opportunity.id,
        psychProfile: precall.psychProfile,
        matchedTechnique: precall.matchedTechnique,
        generatedScript: script,
      });
      notifications.show({
        color: 'teal',
        title: 'Script regenerated',
        message: 'A fresh pre-call script for this buyer.',
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'Couldn’t regenerate',
        message: 'Something went wrong. Try again.',
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveScript = async (sections: GeneratedScript['sections']) => {
    if (!precall) return;
    await setPrecall({
      opportunityId: opportunity.id,
      psychProfile: precall.psychProfile,
      matchedTechnique: precall.matchedTechnique,
      generatedScript: { ...precall.generatedScript, sections },
    });
    notifications.show({
      color: 'teal',
      title: 'Script saved',
      message: 'Your edits to the pre-call script are saved.',
    });
  };

  if (failed) {
    return (
      <SectionCard
        icon={<IconSparkles size={18} />}
        title="Pre-call intelligence"
      >
        <Stack align="center" gap="sm" py="md">
          <Text size="sm" c="dimmed" ta="center">
            Couldn&rsquo;t generate the pre-call intelligence for this buyer.
          </Text>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void runGeneration()}
          >
            Try again
          </Button>
        </Stack>
      </SectionCard>
    );
  }

  // No bundle yet — it is loading, generating, or about to. The stepped card
  // covers all three; once the bundle exists we render the real sections.
  if (!precall) {
    return <GeneratingCard stepIndex={stepIndex} />;
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <IconSparkles size={18} color="var(--mantine-color-violet-6)" />
        <Text fw={600}>Pre-call intelligence</Text>
        <Tooltip
          multiline
          w={300}
          label="Generated from buyer enrichment so you can prep before the conversation. No activity required — it's ready the moment the opportunity exists."
        >
          <IconSparkles size={13} color="var(--mantine-color-dimmed)" />
        </Tooltip>
      </Group>
      <ProfileCard profile={precall.psychProfile} />
      <TechniqueCard precall={precall} />
      <ScriptCard
        precall={precall}
        regenerating={regenerating}
        onRegenerate={handleRegenerateScript}
        onSave={handleSaveScript}
      />
    </Stack>
  );
}

// --- Generating animation --------------------------------------------------

function GeneratingCard({ stepIndex }: { stepIndex: number }) {
  const clamped = Math.max(0, Math.min(stepIndex, FAKE_PRECALL_STEPS.length - 1));
  return (
    <SectionCard icon={<IconSparkles size={18} />} title="Pre-call intelligence">
      <Stack gap="md" py="xs">
        <Text size="sm" c="dimmed">
          Reading the buyer&rsquo;s profile and preparing your pre-call brief&hellip;
        </Text>
        <Stack gap="xs">
          {FAKE_PRECALL_STEPS.map((label, i) => {
            const status = i < clamped ? 'done' : i === clamped ? 'active' : 'pending';
            return (
              <Group key={label} gap="sm" wrap="nowrap">
                <ThemeIcon
                  size={22}
                  radius="xl"
                  variant={status === 'pending' ? 'default' : 'filled'}
                  color={
                    status === 'done' ? 'teal' : status === 'active' ? 'violet' : 'gray'
                  }
                >
                  {status === 'done' ? (
                    <IconCheck size={14} />
                  ) : status === 'active' ? (
                    <Loader size={12} color="white" />
                  ) : (
                    <Text size="xs" c="dimmed" fw={600}>
                      {i + 1}
                    </Text>
                  )}
                </ThemeIcon>
                <Text
                  size="sm"
                  c={status === 'pending' ? 'dimmed' : undefined}
                  fw={status === 'active' ? 500 : 400}
                >
                  {label}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </SectionCard>
  );
}

// --- Psychological profile -------------------------------------------------

const DISC_ROWS: DiscType[] = ['D', 'I', 'S', 'C'];

const OCEAN_ROWS: { key: keyof PsychProfile['ocean']; label: string }[] = [
  { key: 'o', label: 'Openness' },
  { key: 'c', label: 'Conscientiousness' },
  { key: 'e', label: 'Extraversion' },
  { key: 'a', label: 'Agreeableness' },
  { key: 'n', label: 'Neuroticism' },
];

function ProfileCard({ profile }: { profile: PsychProfile }) {
  const { disc, ocean } = profile;
  const discValue = (t: DiscType): number =>
    t === 'D' ? disc.d : t === 'I' ? disc.i : t === 'S' ? disc.s : disc.c;

  return (
    <SectionCard icon={<IconBrain size={18} />} title="Buyer psychological profile">
      <Stack gap="md">
        <Text size="sm">{profile.summary}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          <Stack gap={8}>
            <Group gap="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                DISC
              </Text>
              <Badge size="xs" variant="light" color="blue">
                {disc.primaryType} · {DISC_TYPE_LABELS[disc.primaryType]}
              </Badge>
            </Group>
            {DISC_ROWS.map((t) => (
              <TraitRow
                key={t}
                label={DISC_TYPE_LABELS[t]}
                value={discValue(t)}
                color="blue"
                highlighted={t === disc.primaryType}
              />
            ))}
          </Stack>
          <Stack gap={8}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              OCEAN · Big Five
            </Text>
            {OCEAN_ROWS.map((row) => (
              <TraitRow
                key={row.key}
                label={row.label}
                value={ocean[row.key]}
                color="grape"
              />
            ))}
          </Stack>
        </SimpleGrid>
      </Stack>
    </SectionCard>
  );
}

function TraitRow({
  label,
  value,
  color,
  highlighted = false,
}: {
  label: string;
  value: number;
  color: string;
  highlighted?: boolean;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="xs" w={128} fw={highlighted ? 700 : 400} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Progress
        value={value}
        color={highlighted ? `${color}.7` : `${color}.4`}
        size={highlighted ? 'md' : 'sm'}
        radius="xl"
        style={{ flex: 1 }}
      />
      <Text size="xs" w={26} ta="right" fw={highlighted ? 700 : 600} style={{ flexShrink: 0 }}>
        {value}
      </Text>
    </Group>
  );
}

// --- Matched technique -----------------------------------------------------

function TechniqueCard({ precall }: { precall: MockPrecallIntelligence }) {
  const { technique, reasoning } = precall.matchedTechnique;
  return (
    <SectionCard icon={<IconTargetArrow size={18} />} title="Matched sales technique">
      <Stack gap="sm">
        <Badge size="lg" variant="filled" color="violet">
          {TECHNIQUE_LABELS[technique]}
        </Badge>
        <Text size="sm">{reasoning}</Text>
      </Stack>
    </SectionCard>
  );
}

// --- Generated script ------------------------------------------------------

function ScriptCard({
  precall,
  regenerating,
  onRegenerate,
  onSave,
}: {
  precall: MockPrecallIntelligence;
  regenerating: boolean;
  onRegenerate: () => void;
  onSave: (sections: GeneratedScript['sections']) => Promise<void>;
}) {
  const script = precall.generatedScript;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GeneratedScript['sections']>(script.sections);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(script.sections.map((s) => ({ ...s })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(script.sections);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (idx: number, patch: Partial<GeneratedScript['sections'][number]>) => {
    setDraft((d) => d.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  return (
    <SectionCard
      icon={<IconScript size={18} />}
      title="Generated pre-call script"
      action={
        editing ? (
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="xs" onClick={() => void save()} loading={saving}>
              Save
            </Button>
          </Group>
        ) : (
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              onClick={startEdit}
              disabled={regenerating}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={onRegenerate}
              loading={regenerating}
            >
              Regenerate
            </Button>
          </Group>
        )
      }
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          A per-opportunity script in the {TECHNIQUE_LABELS[script.technique]} technique
          {script.basedOnTemplateId
            ? ', adapted from your workspace script template'
            : ' — no workspace template, generated from scratch'}
          . Distinct from the reusable template; edit it freely for this call.
        </Text>

        {editing ? (
          <Stack gap="md">
            {draft.map((section, idx) => (
              <Stack key={idx} gap={6}>
                <TextInput
                  size="xs"
                  label={`Section ${idx + 1} heading`}
                  value={section.heading}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateSection(idx, { heading: value });
                  }}
                />
                <Textarea
                  size="sm"
                  value={section.body}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateSection(idx, { body: value });
                  }}
                  autosize
                  minRows={2}
                  maxRows={6}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Stack gap="md">
            {script.sections.map((section, idx) => (
              <Group key={idx} gap="sm" align="flex-start" wrap="nowrap">
                <ThemeIcon size={22} radius="xl" variant="light" color="gray">
                  <Text size="xs" fw={700}>
                    {idx + 1}
                  </Text>
                </ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>
                    {section.heading}
                  </Text>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                    {section.body}
                  </Text>
                </Stack>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}

// --- Shared card shell -----------------------------------------------------

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs">
            <ActionIcon variant="transparent" color="gray" size="sm" aria-hidden>
              {icon}
            </ActionIcon>
            <Text fw={600} size="sm">
              {title}
            </Text>
          </Group>
          {action}
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}
