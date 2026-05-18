import { Button, Group, Loader, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import type { ParsedOpportunity } from '@pg/shared';
import { FAKE_PARSE_STEPS, fakeParseOpportunity } from '../../mock/fake-ai';
import { mockAiCall } from '../../mock/mock-api';
import { ParsedReview } from './parsed-review';

interface QuickPasteProps {
  onSuccess: (opportunityId: string) => void;
}

type PasteStep = 'paste' | 'parsing' | 'review';

const EXAMPLE = `Quick notes from yesterday:

Talking to Jamie Park at Globex Industries — Director of Revenue Operations. They have a CDP renewal in July and finance flagged the cost. Stage: Negotiation. Roughly $84,000. Expected close 2026-06-30.

Pain: existing CDP contract is up for renewal and finance wants a better number. Pushed back on multi-year terms.

jamie.park@globex.example`;

export function QuickPaste({ onSuccess }: QuickPasteProps) {
  const [step, setStep] = useState<PasteStep>('paste');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedOpportunity | null>(null);
  const [parseStepIndex, setParseStepIndex] = useState(0);

  const handleParse = async () => {
    if (!text.trim()) return;
    setStep('parsing');
    setParseStepIndex(0);

    // Walk through the stage messages so the UX feels like a real chain.
    // Each stage is a short pause so the user sees the progression.
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

  const handleUseExample = () => {
    setText(EXAMPLE);
  };

  if (step === 'paste') {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paste deal notes, meeting summary, or transcript snippet. The parser will pull out
          buyer + opportunity fields for you to review.
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
          <Button variant="subtle" onClick={handleUseExample}>
            Use example text
          </Button>
          <Button onClick={handleParse} disabled={text.trim().length === 0}>
            Parse
          </Button>
        </Group>
      </Stack>
    );
  }

  if (step === 'parsing') {
    return (
      <Stack gap="md" align="center" py="lg">
        <Loader />
        <Text fw={500}>{FAKE_PARSE_STEPS[parseStepIndex]}</Text>
        <Text size="xs" c="dimmed">
          Pulling structured fields from your notes…
        </Text>
      </Stack>
    );
  }

  if (step === 'review' && parsed) {
    return <ParsedReview parsed={parsed} onSuccess={onSuccess} onBack={handleBack} />;
  }

  return null;
}
