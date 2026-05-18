import { Box, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface QuestionScreenProps {
  stepIndex: number;
  totalSteps: number;
  question: string;
  helper?: string;
  children: ReactNode;
  canContinue: boolean;
  isLast: boolean;
  isOptional?: boolean;
  onBack: () => void;
  onContinue: () => void;
}

// Single-question layout for the conversational onboarding redesign (PG-178).
// Provides the shell — question prompt, progress, back/continue — while the
// caller supplies the actual input control as `children`.
export function QuestionScreen({
  stepIndex,
  totalSteps,
  question,
  helper,
  children,
  canContinue,
  isLast,
  isOptional = false,
  onBack,
  onContinue,
}: QuestionScreenProps) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed" fw={500}>
            Step {stepIndex + 1} of {totalSteps}
          </Text>
          {isOptional && (
            <Text size="xs" c="dimmed">
              Optional
            </Text>
          )}
        </Group>
        <Progress value={progress} size="xs" radius="xl" />
      </Stack>

      <Box
        key={stepIndex}
        style={{
          animation: 'pg-question-fade 220ms ease',
        }}
      >
        <Stack gap="md">
          <Stack gap={6}>
            <Title order={2}>{question}</Title>
            {helper && (
              <Text size="sm" c="dimmed">
                {helper}
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
          disabled={stepIndex === 0}
        >
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          rightSection={isLast ? null : <IconArrowRight size={16} />}
        >
          {isLast ? 'Finish onboarding' : 'Continue'}
        </Button>
      </Group>

      <style>{`@keyframes pg-question-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </Stack>
  );
}
