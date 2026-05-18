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
        These three answers flow into every diagnosis prompt — so be specific. Each needs at
        least {MIN_CHARS} characters before you can continue.
      </Text>
      <TextInput
        label="Product name"
        placeholder="e.g. Pulse"
        value={data.name}
        onChange={(e) => onChange({ name: e.currentTarget.value })}
        required
        data-autofocus
      />
      <FieldWithCount
        label="What do you sell?"
        placeholder="e.g. Pulse is a pipeline-intelligence platform that scores every B2B deal on buyer readiness using meeting evidence."
        value={data.description}
        onChange={(value) => onChange({ description: value })}
      />
      <FieldWithCount
        label="Who do you sell to?"
        placeholder="e.g. VP of Sales, Head of RevOps at 100-1,000 person SaaS companies."
        value={data.targetBuyer}
        onChange={(value) => onChange({ targetBuyer: value })}
      />
      <FieldWithCount
        label="What problem do you usually solve?"
        placeholder="e.g. Reps over-call deals in CRM stages, inflating the forecast. We surface those mismatches before forecast day."
        value={data.problemSolved}
        onChange={(value) => onChange({ problemSolved: value })}
      />
    </Stack>
  );
}

interface FieldWithCountProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

// Validation feedback states:
//   empty       → dimmed counter only (don't shout at untouched fields)
//   1..MIN-1    → red error (user engaged but hasn't met the bar)
//   MIN..       → dimmed counter (satisfied)
function FieldWithCount({ label, placeholder, value, onChange }: FieldWithCountProps) {
  const len = value.trim().length;
  const tooShort = len > 0 && len < MIN_CHARS;
  const helperText = `${len} / ~${TARGET_CHARS} chars`;

  return (
    <Textarea
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      autosize
      minRows={3}
      required
      error={
        tooShort
          ? `${helperText} — needs at least ${MIN_CHARS} characters before you can continue`
          : undefined
      }
      description={tooShort ? undefined : helperText}
    />
  );
}

export function isProductStepValid(d: WizardData['product']): boolean {
  return (
    d.name.trim().length > 0 &&
    d.description.trim().length >= MIN_CHARS &&
    d.targetBuyer.trim().length >= MIN_CHARS &&
    d.problemSolved.trim().length >= MIN_CHARS
  );
}
