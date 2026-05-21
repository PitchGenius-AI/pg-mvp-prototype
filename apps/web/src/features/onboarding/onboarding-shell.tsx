import { Box, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { FIRST_WIZARD_STEP, ONBOARDING_TOTAL_STEPS } from './types';

interface OnboardingShellProps {
  /** Current step number (2–10) — drives the "Step N of 11" indicator. */
  step: number;
  title: string;
  subtitle?: ReactNode;
  /** Marks the step's content as optional (the step itself is still required). */
  optional?: boolean;
  children: ReactNode;
  canContinue: boolean;
  continueLabel?: string;
  /** Disables Back while async work is in flight (e.g. the website scrape). */
  busy?: boolean;
  onBack: () => void;
  onContinue: () => void;
}

// The inner frame for one onboarding step (PG-190): the N-of-11 progress
// indicator, the question prompt, the caller-supplied input, and Back/Continue.
// The wizard owns the surrounding card + brand; this owns everything inside it.
export function OnboardingShell({
  step,
  title,
  subtitle,
  optional = false,
  children,
  canContinue,
  continueLabel = 'Continue',
  busy = false,
  onBack,
  onContinue,
}: OnboardingShellProps) {
  const progress = (step / ONBOARDING_TOTAL_STEPS) * 100;
  // Back to recreating the account makes no sense — disabled on the first step.
  const backDisabled = step <= FIRST_WIZARD_STEP || busy;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed" fw={500}>
            Step {step} of {ONBOARDING_TOTAL_STEPS}
          </Text>
          {optional && (
            <Text size="xs" c="dimmed">
              Optional
            </Text>
          )}
        </Group>
        <Progress value={progress} size="xs" radius="xl" />
      </Stack>

      <Box key={step} style={{ animation: 'pg-onboarding-fade 220ms ease' }}>
        <Stack gap="md">
          <Stack gap={6}>
            <Title order={2}>{title}</Title>
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
          </Stack>
          {children}
        </Stack>
      </Box>

      <Group justify="space-between" mt="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
          disabled={backDisabled}
        >
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          rightSection={
            continueLabel === 'Continue' ? <IconArrowRight size={16} /> : null
          }
        >
          {continueLabel}
        </Button>
      </Group>

      <style>{`@keyframes pg-onboarding-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </Stack>
  );
}
