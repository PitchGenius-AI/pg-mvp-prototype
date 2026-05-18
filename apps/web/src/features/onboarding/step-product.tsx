import { Stack, Text, Textarea, TextInput } from '@mantine/core';
import type { WizardData } from './types';

interface StepProductProps {
  data: WizardData['product'];
  onChange: (patch: Partial<WizardData['product']>) => void;
}

const MIN_CHARS = 30;
const TARGET_CHARS = 180;

export function StepProduct({ data, onChange }: StepProductProps) {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        These three answers flow into every diagnosis prompt — so be specific. Aim for 1-3
        sentences each, in the words you'd use with a real buyer.
      </Text>
      <TextInput
        label="Product name"
        placeholder="e.g. Pulse"
        value={data.name}
        onChange={(e) => onChange({ name: e.currentTarget.value })}
        required
        data-autofocus
      />
      <Textarea
        label="What do you sell?"
        placeholder="e.g. Pulse is a pipeline-intelligence platform that scores every B2B deal on buyer readiness using meeting evidence."
        value={data.description}
        onChange={(e) => onChange({ description: e.currentTarget.value })}
        autosize
        minRows={3}
        required
        description={charHint(data.description)}
      />
      <Textarea
        label="Who do you sell to?"
        placeholder="e.g. VP of Sales, Head of RevOps at 100-1,000 person SaaS companies."
        value={data.targetBuyer}
        onChange={(e) => onChange({ targetBuyer: e.currentTarget.value })}
        autosize
        minRows={3}
        required
        description={charHint(data.targetBuyer)}
      />
      <Textarea
        label="What problem do you usually solve?"
        placeholder="e.g. Reps over-call deals in CRM stages, inflating the forecast. We surface those mismatches before forecast day."
        value={data.problemSolved}
        onChange={(e) => onChange({ problemSolved: e.currentTarget.value })}
        autosize
        minRows={3}
        required
        description={charHint(data.problemSolved)}
      />
    </Stack>
  );
}

function charHint(value: string): string {
  const len = value.trim().length;
  if (len === 0) return `0 / ~${TARGET_CHARS} chars`;
  if (len < MIN_CHARS) return `${len} / ~${TARGET_CHARS} chars — a little more detail helps`;
  return `${len} / ~${TARGET_CHARS} chars`;
}

export function isProductStepValid(d: WizardData['product']): boolean {
  return (
    d.name.trim().length > 0 &&
    d.description.trim().length >= MIN_CHARS &&
    d.targetBuyer.trim().length >= MIN_CHARS &&
    d.problemSolved.trim().length >= MIN_CHARS
  );
}
