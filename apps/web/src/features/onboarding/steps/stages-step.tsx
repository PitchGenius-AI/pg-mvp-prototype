import { OnboardingShell } from '../onboarding-shell';
import type { OnboardingStepProps } from '../types';
import { areStagesValid, CrmStagesEditor } from './crm-stages-editor';

// Step 10 (PG-195): the rep's pipeline stages — Simple B2B template or custom.
// The last wizard step; its Continue commits the workspace and hands off to
// step 11, the mock checkout (M11).

export function StagesStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  return (
    <OnboardingShell
      step={step}
      title="Set up your pipeline stages"
      subtitle="These drive the Pipeline Reality Check — comparing your CRM stage to the buyer’s evidence-based readiness."
      canContinue={areStagesValid(draft.stageTemplate, draft.customStages)}
      continueLabel="Continue to checkout"
      onBack={onBack}
      onContinue={onContinue}
    >
      <CrmStagesEditor
        template={draft.stageTemplate}
        customStages={draft.customStages}
        onChange={(patch) =>
          update({
            ...(patch.template !== undefined ? { stageTemplate: patch.template } : {}),
            ...(patch.customStages !== undefined ? { customStages: patch.customStages } : {}),
          })
        }
      />
    </OnboardingShell>
  );
}
