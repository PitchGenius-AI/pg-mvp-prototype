import { Textarea, TextInput } from '@mantine/core';
import type { KeyboardEvent, ReactNode } from 'react';
import { OnboardingShell } from '../onboarding-shell';
import { MIN_CONTEXT_CHARS, onboardingMode, type OnboardingStepProps } from '../types';

// Shared layout for the four single-field steps — workspace name (2), industry
// (4), customer (6), problem (7). The configured wrappers below bake in the
// mode-aware copy so the wizard maps each step to a component 1:1.

interface SimpleFieldStepProps {
  step: number;
  title: string;
  subtitle: ReactNode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  multiline: boolean;
  /** 0 means "non-empty"; >0 enforces a minimum length with a live counter. */
  minChars: number;
  optional?: boolean;
  onBack: () => void;
  onContinue: () => void;
}

function SimpleFieldStep({
  step,
  title,
  subtitle,
  placeholder,
  value,
  onChange,
  multiline,
  minChars,
  optional,
  onBack,
  onContinue,
}: SimpleFieldStepProps) {
  const len = value.trim().length;
  const canContinue = optional ? true : len > 0 && len >= minChars;
  const tooShort = minChars > 0 && len > 0 && len < minChars;
  const counter = minChars > 0 ? `${len} characters` : undefined;

  const advanceOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canContinue) {
      e.preventDefault();
      onContinue();
    }
  };

  return (
    <OnboardingShell
      step={step}
      title={title}
      subtitle={subtitle}
      optional={optional}
      canContinue={canContinue}
      onBack={onBack}
      onContinue={onContinue}
    >
      {multiline ? (
        <Textarea
          size="md"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
          autoFocus
          error={
            tooShort
              ? `${counter} — needs at least ${minChars} before you can continue`
              : undefined
          }
          description={tooShort ? undefined : counter}
        />
      ) : (
        <TextInput
          size="md"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onKeyDown={advanceOnEnter}
          autoFocus
        />
      )}
    </OnboardingShell>
  );
}

// --- Step 2: workspace name ----------------------------------------------

export function WorkspaceNameStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  return (
    <SimpleFieldStep
      step={step}
      title="What should we call your workspace?"
      subtitle="Usually your company name — you can change it later. It's the home for your pipeline, products, and deals."
      placeholder="e.g. Acme Sales Co"
      value={draft.workspaceName}
      onChange={(workspaceName) => update({ workspaceName })}
      multiline={false}
      minChars={0}
      onBack={onBack}
      onContinue={onContinue}
    />
  );
}

// --- Step 4: verify industry ---------------------------------------------

export function IndustryStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const confirming = onboardingMode(draft) === 'confirmation';
  return (
    <SimpleFieldStep
      step={step}
      title={confirming ? 'Does this industry look right?' : 'What industry are you in?'}
      subtitle={
        confirming
          ? 'We picked this up from your website — edit it if it’s off.'
          : 'Helps us tailor your buyer-readiness diagnoses.'
      }
      placeholder="e.g. B2B SaaS, Manufacturing, Fintech"
      value={draft.industry}
      onChange={(industry) => update({ industry })}
      multiline={false}
      minChars={0}
      onBack={onBack}
      onContinue={onContinue}
    />
  );
}

// --- Step 6: review target customer --------------------------------------

export function CustomerStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const confirming = onboardingMode(draft) === 'confirmation';
  return (
    <SimpleFieldStep
      step={step}
      title={confirming ? 'Is this who you sell to?' : 'Who do you sell to?'}
      subtitle={
        confirming
          ? 'From your website — refine the title, segment, and company size.'
          : `Title, segment, company size — be specific. At least ${MIN_CONTEXT_CHARS} characters.`
      }
      placeholder="e.g. VP of Sales and RevOps leaders at 50–500 person B2B SaaS companies with multi-rep teams."
      value={draft.targetCustomer}
      onChange={(targetCustomer) => update({ targetCustomer })}
      multiline
      minChars={MIN_CONTEXT_CHARS}
      onBack={onBack}
      onContinue={onContinue}
    />
  );
}

// --- Step 7: review core problem -----------------------------------------

export function ProblemStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const confirming = onboardingMode(draft) === 'confirmation';
  return (
    <SimpleFieldStep
      step={step}
      title={confirming ? 'Is this the problem you solve?' : 'What problem do you usually solve?'}
      subtitle={
        confirming
          ? 'From your website — phrase it in your buyer’s words, not yours.'
          : `In your buyer’s words, not yours. At least ${MIN_CONTEXT_CHARS} characters.`
      }
      placeholder="e.g. Reps over-call deals in CRM stages, inflating the forecast. We surface those mismatches before forecast day."
      value={draft.coreProblem}
      onChange={(coreProblem) => update({ coreProblem })}
      multiline
      minChars={MIN_CONTEXT_CHARS}
      onBack={onBack}
      onContinue={onContinue}
    />
  );
}
