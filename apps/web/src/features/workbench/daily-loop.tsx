import { Button, Group, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBriefcase, IconFileExport, IconFileImport, IconHelpCircle } from '@tabler/icons-react';
import type { ComponentType } from 'react';

// The daily cadence Pitch Genius is built around — Import → Work → Export.
// Taught inline in the Workbench empty state (a first-time rep's first
// encounter with the loop) and, once the rep has opportunities, available on
// demand via the header "How Pitch Genius fits your day" panel.
interface DailyLoopStep {
  label: string;
  title: string;
  body: string;
  Icon: ComponentType<{ size?: number }>;
}

const DAILY_LOOP_STEPS: DailyLoopStep[] = [
  {
    label: 'Morning',
    title: "Import today's leads",
    body: "Export the deals you're working from your CRM and drop the file in. We map the columns and start scoring.",
    Icon: IconFileImport,
  },
  {
    label: 'Through the day',
    title: 'Work your deals',
    body: 'See where each buyer really stands, prep and run calls with PG.AI PILOT, log what happens.',
    Icon: IconBriefcase,
  },
  {
    label: 'End of day',
    title: 'Export your Update Pack',
    body: "One step turns the day's work into notes ready to drop straight back into your CRM.",
    Icon: IconFileExport,
  },
];

export const DAILY_LOOP_NOTE = 'Tomorrow, start again — import, work, export.';

// A row of three labeled steps (stacks on narrow screens).
export function DailyLoopSteps() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" w="100%">
      {DAILY_LOOP_STEPS.map((step) => (
        <Paper key={step.title} withBorder radius="md" p="md">
          <Stack gap={8}>
            <Group justify="space-between" align="center">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                {step.label}
              </Text>
              <ThemeIcon variant="light" size="lg" radius="md">
                <step.Icon size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={600}>{step.title}</Text>
            <Text size="sm" c="dimmed">
              {step.body}
            </Text>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

// The persistent "How this works" affordance for the Workbench header (PG-264).
// Low-profile trigger that opens the cadence content in an in-app panel.
// [FLAG — DEPENDENCY] The KB article is a content dependency, not yet authored;
// the panel renders the cadence inline until a link target exists.
export function CadenceHelp() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        leftSection={<IconHelpCircle size={15} />}
        onClick={open}
      >
        How Pitch Genius fits your day
      </Button>
      <Modal opened={opened} onClose={close} title="How Pitch Genius fits your day" size="lg" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Pitch Genius fits around your sales day. Bring in the deals you're working each morning,
            work them with live buyer intelligence, then push your updates back to your CRM before
            you log off.
          </Text>
          <DailyLoopSteps />
          <Text size="sm" c="dimmed" ta="center" fs="italic">
            {DAILY_LOOP_NOTE}
          </Text>
        </Stack>
      </Modal>
    </>
  );
}
