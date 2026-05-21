import { Alert, Button, Group, Loader, Stack, Text, Textarea } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import type { ParsedOpportunity } from '@pg/shared';
import { FAKE_PARSE_STEPS, fakeParseOpportunity } from '../../mock/fake-ai';
import { mockAiCall } from '../../mock/mock-api';
import { PasteReview } from './paste-review';

interface PasteMethodProps {
  onSuccess: (opportunityId: string) => void;
}

type PasteStep = 'paste' | 'parsing' | 'review';

const EXAMPLE = `Quick notes from yesterday:

Talking to Jamie Park at Globex Industries — Director of Revenue Operations. They have a CDP renewal in July and finance flagged the cost. Stage: Negotiation. Roughly $84,000. Expected close 2026-06-30.

Pain: existing CDP contract is up for renewal and finance wants a better number. Pushed back on multi-year terms.

jamie.park@globex.example`;

// Method B — Paste (PG-211). [FLAG — BLOCKED on Russell] Paste is retained as an
// MVP intake method but its final behavior is undefined. This is the placeholder
// only: accept pasted text, fake-AI extract buyer + opportunity fields, present a
// draft for review/confirm before saving — never inventing missing fields. Do
// not build past this until the behavior is defined.
export function PasteMethod({ onSuccess }: PasteMethodProps) {
  const [step, setStep] = useState<PasteStep>('paste');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedOpportunity | null>(null);
  const [parseStepIndex, setParseStepIndex] = useState(0);

  const handleParse = async () => {
    if (!text.trim()) return;
    setStep('parsing');
    setParseStepIndex(0);

    // Walk the stage messages so the UX feels like a real chain.
    const totalSteps = FAKE_PARSE_STEPS.length;
    const stepInterval = window.setInterval(() => {
      setParseStepIndex((i) => (i < totalSteps - 1 ? i + 1 : i));
    }, 500);

    try {
      const result = await mockAiCall<ParsedOpportunity>(() => fakeParseOpportunity(text));
      setParsed(result);
      setStep('review');
    } finally {
      window.clearInterval(stepInterval);
    }
  };

  const handleBack = () => {
    setStep('paste');
    setParsed(null);
  };

  if (step === 'parsing') {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader />
        <Text fw={500}>{FAKE_PARSE_STEPS[parseStepIndex]}</Text>
        <Text size="xs" c="dimmed">
          Pulling structured fields from your notes…
        </Text>
      </Stack>
    );
  }

  if (step === 'review' && parsed) {
    return <PasteReview parsed={parsed} onSuccess={onSuccess} onBack={handleBack} />;
  }

  return (
    <Stack gap="md">
      <Alert
        icon={<IconInfoCircle size={18} />}
        color="gray"
        variant="light"
        title="Placeholder method"
      >
        Paste is a placeholder pending product sign-off — it fake-parses your text into a
        draft you review before saving. Final behaviour (what it accepts, how it differs
        from the structured form and the Daily Workbench import) is still to be defined.
      </Alert>
      <Text size="sm" c="dimmed">
        Paste deal notes, a meeting summary, or a transcript snippet. The parser pulls out
        buyer + opportunity fields for you to review — it never invents what isn't there.
      </Text>
      <Textarea
        placeholder={`Examples:\n\n"Talking to Jamie Park at Globex — Director of RevOps. CDP renewal in July, $84k, stage Negotiation."\n\n"Met with Marcus Bennett (Initech). Quarterly reporting tool eval. Pain: late board reporting. Stage: Proposal."`}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        autosize
        minRows={8}
        maxRows={16}
      />
      <Group justify="space-between">
        <Button variant="subtle" onClick={() => setText(EXAMPLE)}>
          Use example text
        </Button>
        <Button onClick={handleParse} disabled={text.trim().length === 0}>
          Parse
        </Button>
      </Group>
    </Stack>
  );
}
