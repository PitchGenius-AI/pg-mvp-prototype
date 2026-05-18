import { Stack, Text, TextInput } from '@mantine/core';
import type { WizardData } from './types';

interface StepWorkspaceProps {
  data: WizardData['workspace'];
  onChange: (patch: Partial<WizardData['workspace']>) => void;
}

export function StepWorkspace({ data, onChange }: StepWorkspaceProps) {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Your workspace is the container for your pipeline configuration, product, and deals.
        One workspace per user in the MVP.
      </Text>
      <TextInput
        label="Workspace name"
        placeholder="e.g. Acme Sales Co"
        value={data.name}
        onChange={(e) => onChange({ name: e.currentTarget.value })}
        required
        data-autofocus
      />
      <TextInput
        label="Website"
        placeholder="https://acme.example"
        value={data.website}
        onChange={(e) => onChange({ website: e.currentTarget.value })}
        description="Optional"
      />
      <TextInput
        label="Industry"
        placeholder="e.g. SaaS, Manufacturing, Fintech"
        value={data.industry}
        onChange={(e) => onChange({ industry: e.currentTarget.value })}
        description="Optional — helps tailor diagnoses later."
      />
    </Stack>
  );
}

export function isWorkspaceStepValid(d: WizardData['workspace']): boolean {
  return d.name.trim().length > 0;
}
