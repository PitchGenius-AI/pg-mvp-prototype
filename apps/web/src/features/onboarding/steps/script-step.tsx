import { Alert, Anchor, Button, FileButton, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { OnboardingShell } from '../onboarding-shell';
import type { OnboardingStepProps } from '../types';

// Step 8 (PG-194): capture an existing call script — paste or upload — or skip.
// Optional content, but a required step: you must either provide a script or
// explicitly skip. The script becomes the workspace's primary script template;
// generated pre-call scripts are modeled on it (or built from scratch if skipped).

export function ScriptStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const hasContent = draft.scriptContent.trim().length > 0;
  const canContinue = hasContent || draft.scriptSkipped;

  const handlePaste = (value: string) =>
    update({ scriptContent: value, scriptSkipped: false });

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    update({ scriptContent: text, scriptSkipped: false });
  };

  const skip = () => update({ scriptSkipped: true, scriptContent: '' });
  const unskip = () => update({ scriptSkipped: false });

  return (
    <OnboardingShell
      step={step}
      title="Share your call script"
      subtitle="Paste or upload a script you already use — we’ll model your generated pre-call scripts on it."
      optional
      canContinue={canContinue}
      onBack={onBack}
      onContinue={onContinue}
    >
      {draft.scriptSkipped ? (
        <Alert color="gray" variant="light" title="No script — that’s fine">
          <Stack gap={6}>
            <Text size="sm">
              We’ll generate your pre-call scripts from scratch, tuned to each buyer.
            </Text>
            <Anchor component="button" type="button" size="sm" onClick={unskip}>
              Add a script instead
            </Anchor>
          </Stack>
        </Alert>
      ) : (
        <Stack gap="md">
          <Textarea
            size="md"
            placeholder="Paste your call script or talk track here…"
            value={draft.scriptContent}
            onChange={(e) => handlePaste(e.currentTarget.value)}
            autosize
            minRows={5}
            maxRows={14}
            autoFocus
            description={
              hasContent ? `${draft.scriptContent.trim().length} characters captured` : undefined
            }
          />
          <Group justify="space-between">
            <FileButton onChange={handleUpload} accept=".txt,.md,text/plain,text/markdown">
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                  Upload a file
                </Button>
              )}
            </FileButton>
            <Anchor component="button" type="button" size="sm" c="dimmed" onClick={skip}>
              I don’t have a script
            </Anchor>
          </Group>
        </Stack>
      )}
    </OnboardingShell>
  );
}
