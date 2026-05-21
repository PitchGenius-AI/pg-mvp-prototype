import { Container, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { Brand } from '../../components/layout/brand';
import { mockActions, useCurrentSession, useOnboardingDraft } from '../../mock/store';
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

  const step = clampStep(draft.currentStep);

  const handleBack = () => update({ currentStep: Math.max(FIRST_WIZARD_STEP, step - 1) });

  const handleContinue = () => {
    if (step < LAST_WIZARD_STEP) {
      update({ currentStep: step + 1 });
      return;
    }
    finishOnboarding();
  };

  // Commit the draft to real entities, then mark onboarding complete. Mirrors a
  // single transactional write the real backend would do.
  const finishOnboarding = () => {
    if (!session) return;
    const workspaceId = session.workspaceId;

    mockActions.updateWorkspace(workspaceId, {
      name: draft.workspaceName.trim(),
      website: draft.website.trim() || null,
      industry: draft.industry.trim() || null,
      crmStageTemplate: draft.stageTemplate,
      customCrmStages:
        draft.stageTemplate === 'custom'
          ? draft.customStages
              .map((s) => s.name.trim())
              .filter((name) => name.length > 0)
              .map((name, order) => ({ name, order }))
          : null,
      crmType:
        draft.crmChoice === 'hubspot'
          ? 'hubspot'
          : draft.crmChoice === 'pipedrive'
            ? 'pipedrive'
            : null,
    });

    // The workspace-level customer + problem fan into every product; the rep can
    // differentiate them per-product later on the M16 Products page.
    const targetBuyer = draft.targetCustomer.trim();
    const problemSolved = draft.coreProblem.trim();
    let primaryProductId: string | null = null;
    for (const product of draft.products) {
      const created = mockActions.addProduct(workspaceId, {
        name: product.name.trim(),
        description: product.description.trim(),
        targetBuyer,
        problemSolved,
        isPrimary: product.isPrimary,
      });
      if (product.isPrimary) primaryProductId = created.id;
    }
    if (primaryProductId) mockActions.setPrimaryProduct(primaryProductId);

    if (!draft.scriptSkipped && draft.scriptContent.trim().length > 0) {
      mockActions.addScriptTemplate(workspaceId, {
        name: 'My call script',
        content: draft.scriptContent.trim(),
      });
    }

    // Marks the workspace + session onboarding-complete and clears the draft.
    mockActions.completeOnboarding();

    notifications.show({
      color: 'teal',
      title: 'Workspace ready',
      message: 'One last step — activate your subscription.',
    });

    // Onboarding step 11: the mock checkout + hard paywall (M11). The paywall
    // holds the rep at /checkout until payment "completes".
    navigate({ to: '/checkout' });
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
