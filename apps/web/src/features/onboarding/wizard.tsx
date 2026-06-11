import { Container, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { Brand } from '../../components/layout/brand';
import { mockActions, useCurrentSession, useOnboardingDraft } from '../../mock/store';
import { crmTypeFromOnboardingChoice } from '../../mock/types';
import { trpc } from '../../trpc';
import { CrmStep } from './steps/crm-step';
import { ProductsStep } from './steps/products-step';
import { ScriptStep } from './steps/script-step';
import {
  CustomerStep,
  IndustryStep,
  ProblemStep,
  WorkspaceNameStep,
} from './steps/simple-field-step';
import { StagesStep } from './steps/stages-step';
import { WebsiteStep } from './steps/website-step';
import { FIRST_WIZARD_STEP, LAST_WIZARD_STEP, type OnboardingStepProps } from './types';

// The M10 onboarding wizard (PG-190). A linear single-column flow rendered
// outside the app shell — steps 2–10 of the 11-step account-creation sequence
// (step 1 is /signup; step 11, checkout, lands in M11). State lives in the mock
// store's onboarding draft, so per-step edits survive in-app navigation.

const STEP_COMPONENTS: Record<number, (props: OnboardingStepProps) => ReactElement> = {
  2: WorkspaceNameStep,
  3: WebsiteStep,
  4: IndustryStep,
  5: ProductsStep,
  6: CustomerStep,
  7: ProblemStep,
  8: ScriptStep,
  9: CrmStep,
  10: StagesStep,
};

const clampStep = (step: number) =>
  Math.min(LAST_WIZARD_STEP, Math.max(FIRST_WIZARD_STEP, step));

export function OnboardingWizard() {
  const navigate = useNavigate();
  const session = useCurrentSession();
  const draft = useOnboardingDraft();
  const update = mockActions.updateOnboardingDraft;
  const utils = trpc.useUtils();
  const completeOnboarding = trpc.workspace.completeOnboarding.useMutation();

  const step = clampStep(draft.currentStep);

  const handleBack = () => update({ currentStep: Math.max(FIRST_WIZARD_STEP, step - 1) });

  const handleContinue = () => {
    if (step < LAST_WIZARD_STEP) {
      update({ currentStep: step + 1 });
      return;
    }
    void finishOnboarding();
  };

  // Commit the whole draft to the backend in one transactional write (creates the
  // workspace + products + script template, marks onboarding complete).
  const finishOnboarding = async () => {
    if (!session || completeOnboarding.isPending) return;

    const products = draft.products
      .map((p) => ({
        name: p.name.trim(),
        description: p.description.trim(),
        isPrimary: p.isPrimary,
      }))
      .filter((p) => p.name.length > 0 && p.description.length > 0);

    try {
      await completeOnboarding.mutateAsync({
        workspaceName: draft.workspaceName.trim(),
        website: draft.website.trim() || undefined,
        industry: draft.industry.trim() || undefined,
        crmType: crmTypeFromOnboardingChoice(draft.crmChoice),
        targetBuyer: draft.targetCustomer.trim(),
        problemSolved: draft.coreProblem.trim(),
        products,
        scriptContent:
          !draft.scriptSkipped && draft.scriptContent.trim().length > 0
            ? draft.scriptContent.trim()
            : undefined,
        crmStageTemplate: draft.stageTemplate,
        customStages:
          draft.stageTemplate === 'custom'
            ? draft.customStages
                .map((s) => s.name.trim())
                .filter((name) => name.length > 0)
                .map((name, order) => ({ name, order }))
            : undefined,
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Could not finish setup',
        message: err instanceof Error ? err.message : 'Please review your answers and try again.',
      });
      return;
    }

    // Refresh the session-derived queries so the guard sees onboarding complete.
    await utils.workspace.getCurrent.invalidate();
    mockActions.resetOnboardingDraft();

    notifications.show({
      color: 'teal',
      title: 'Workspace ready',
      message: 'You’re all set — welcome to Pitch Genius.',
    });

    // Billing (M31) is not yet enforced, so go straight into the app.
    navigate({ to: '/' });
  };

  const StepComponent = STEP_COMPONENTS[step] ?? WorkspaceNameStep;

  return (
    <Container size={560} py="xl">
      <Stack gap="xl">
        <Stack gap="md" align="center">
          <Brand size="lg" />
          <Stack gap={4} align="center">
            <Title order={3} ta="center">
              Set up your workspace
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              A few quick questions and you’re in.
            </Text>
          </Stack>
        </Stack>

        <Paper p="xl" withBorder radius="md">
          <StepComponent
            key={step}
            step={step}
            draft={draft}
            update={update}
            onBack={handleBack}
            onContinue={handleContinue}
          />
        </Paper>
      </Stack>
    </Container>
  );
}
