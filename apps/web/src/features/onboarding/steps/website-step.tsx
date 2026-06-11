import { Alert, Anchor, Button, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconWorldWww } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { FAKE_SCRAPE_STEPS } from '../../../mock/fake-scrape';
import { newDraftId, type OnboardingDraft } from '../../../mock/types';
import { trpc } from '../../../trpc';
import { OnboardingShell } from '../onboarding-shell';
import type { OnboardingStepProps } from '../types';

// Step 3 (PG-192): website URL + a fake "Reading your website…" scrape. Success
// pre-fills steps 4–7 (confirmation mode); failure or skip leaves them blank
// (manual-entry mode — the mandatory fallback).

// Fields the scrape owns — reset to blank when the scrape fails or is skipped so
// the downstream steps start empty for manual entry.
function blankExtraction(): Pick<
  OnboardingDraft,
  'industry' | 'products' | 'targetCustomer' | 'coreProblem'
> {
  return {
    industry: '',
    products: [{ id: newDraftId('prod'), name: '', description: '', isPrimary: true }],
    targetCustomer: '',
    coreProblem: '',
  };
}

export function WebsiteStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const [running, setRunning] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const scrape = trpc.parser.scrapeWebsite.useMutation();

  // Cycle the progress messages while the scrape runs, independent of the
  // promise — purely so the wait has a sense of motion.
  useEffect(() => {
    if (!running) return;
    setMessageIndex(0);
    const id = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, FAKE_SCRAPE_STEPS.length - 1));
    }, 650);
    return () => clearInterval(id);
  }, [running]);

  const url = draft.website.trim();
  const status = draft.scrapeStatus;
  const canAnalyze = url.length > 0 && !running;
  const canContinue = status !== 'idle' && !running;

  const handleUrlChange = (value: string) => {
    // Editing the URL after a resolved scrape forces a fresh analyze.
    update({ website: value, ...(status !== 'idle' ? { scrapeStatus: 'idle' } : {}) });
  };

  const handleAnalyze = async () => {
    setRunning(true);
    try {
      const extraction = await scrape.mutateAsync({ url });
      const products = extraction.products.filter((p) => p.name.trim().length > 0);
      update({
        scrapeStatus: 'done',
        industry: extraction.industry,
        products:
          products.length > 0
            ? products.map((p, i) => ({
                id: newDraftId('prod'),
                name: p.name,
                description: p.description,
                isPrimary: i === 0,
              }))
            : blankExtraction().products,
        targetCustomer: extraction.targetCustomer,
        coreProblem: extraction.coreProblem,
      });
    } catch {
      update({ scrapeStatus: 'failed', ...blankExtraction() });
    } finally {
      setRunning(false);
    }
  };

  const handleSkip = () => update({ scrapeStatus: 'skipped', ...blankExtraction() });
  const resetToIdle = () => update({ scrapeStatus: 'idle' });

  return (
    <OnboardingShell
      step={step}
      title="Let’s pull your details from your website"
      subtitle="We’ll read it to pre-fill the next few steps. No website? Skip and enter everything yourself."
      canContinue={canContinue}
      busy={running}
      onBack={onBack}
      onContinue={onContinue}
    >
      <Stack gap="md">
        <TextInput
          size="md"
          label="Website"
          placeholder="https://acme.example"
          leftSection={<IconWorldWww size={16} />}
          value={draft.website}
          onChange={(e) => handleUrlChange(e.currentTarget.value)}
          disabled={running}
          autoFocus
        />

        {running && (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {FAKE_SCRAPE_STEPS[messageIndex]}
            </Text>
          </Group>
        )}

        {!running && status === 'idle' && (
          <Group justify="space-between">
            <Button onClick={handleAnalyze} disabled={!canAnalyze}>
              Analyze my website
            </Button>
            <Anchor component="button" type="button" size="sm" c="dimmed" onClick={handleSkip}>
              Skip — I’ll enter my details myself
            </Anchor>
          </Group>
        )}

        {!running && status === 'done' && (
          <Alert
            color="teal"
            variant="light"
            icon={<IconCheck size={18} />}
            title="We read your website"
          >
            <Stack gap={6}>
              <Text size="sm">
                Found your industry, {draft.products.length}{' '}
                {draft.products.length === 1 ? 'product' : 'products'}, and your customer and
                problem. Review and refine them on the next few steps.
              </Text>
              <Anchor component="button" type="button" size="sm" onClick={resetToIdle}>
                Analyze a different site
              </Anchor>
            </Stack>
          </Alert>
        )}

        {!running && status === 'failed' && (
          <Alert
            color="orange"
            variant="light"
            icon={<IconAlertTriangle size={18} />}
            title="We couldn’t read enough from your site"
          >
            <Stack gap={6}>
              <Text size="sm">
                No problem — we’ll walk you through the details on the next few screens instead.
              </Text>
              <Anchor component="button" type="button" size="sm" onClick={resetToIdle}>
                Try a different URL
              </Anchor>
            </Stack>
          </Alert>
        )}

        {!running && status === 'skipped' && (
          <Alert color="gray" variant="light" title="No website — that’s fine">
            <Stack gap={6}>
              <Text size="sm">
                You’ll enter your industry, products, customer, and problem on the next few
                screens.
              </Text>
              <Anchor component="button" type="button" size="sm" onClick={resetToIdle}>
                Analyze my website instead
              </Anchor>
            </Stack>
          </Alert>
        )}
      </Stack>
    </OnboardingShell>
  );
}
