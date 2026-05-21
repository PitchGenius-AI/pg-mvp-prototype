import { Alert, Paper, Radio, Stack, Text, TextInput } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { OnboardingCrmChoice } from '../../../mock/types';
import { OnboardingShell } from '../onboarding-shell';
import type { OnboardingStepProps } from '../types';

// Step 9 (PG-195): pick the CRM the workspace round-trips against. HubSpot and
// Pipedrive get a CRM-importable Update Pack; None/Other degrade export to
// copy-ready notes.

const CRM_OPTIONS: Array<{
  value: OnboardingCrmChoice;
  label: string;
  description: string;
}> = [
  {
    value: 'hubspot',
    label: 'HubSpot',
    description: 'Your end-of-day Update Pack exports as a HubSpot-importable file.',
  },
  {
    value: 'pipedrive',
    label: 'Pipedrive',
    description: 'Your end-of-day Update Pack exports as a Pipedrive-importable file.',
  },
  {
    value: 'none',
    label: 'I don’t use a CRM',
    description: 'Your Update Pack exports as copy-ready notes you paste in yourself.',
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Tell us which — for now your Update Pack exports as copy-ready notes.',
  },
];

export function crmStepValid(
  choice: OnboardingCrmChoice | null,
  otherText: string,
): boolean {
  if (!choice) return false;
  if (choice === 'other') return otherText.trim().length > 0;
  return true;
}

export function CrmStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const { crmChoice, crmOtherText } = draft;
  const degradesExport = crmChoice === 'none' || crmChoice === 'other';

  return (
    <OnboardingShell
      step={step}
      title="Which CRM does your team use?"
      subtitle="This sets the format of your end-of-day CRM Update Pack."
      canContinue={crmStepValid(crmChoice, crmOtherText)}
      onBack={onBack}
      onContinue={onContinue}
    >
      <Radio.Group
        value={crmChoice ?? ''}
        onChange={(value) => update({ crmChoice: value as OnboardingCrmChoice })}
      >
        <Stack gap="sm">
          {CRM_OPTIONS.map((option) => (
            <Paper key={option.value} p="md" withBorder radius="md">
              <Radio
                value={option.value}
                label={
                  <Stack gap={2}>
                    <Text fw={500}>{option.label}</Text>
                    <Text size="xs" c="dimmed">
                      {option.description}
                    </Text>
                  </Stack>
                }
              />
              {option.value === 'other' && crmChoice === 'other' && (
                <TextInput
                  mt="sm"
                  pl={30}
                  placeholder="Which CRM?"
                  value={crmOtherText}
                  onChange={(e) => update({ crmOtherText: e.currentTarget.value })}
                />
              )}
            </Paper>
          ))}
        </Stack>
      </Radio.Group>

      {degradesExport && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
          We can’t generate a CRM-importable file for that yet — your Update Pack will be
          copy-ready notes instead. You can change this later in settings.
        </Alert>
      )}
    </OnboardingShell>
  );
}
