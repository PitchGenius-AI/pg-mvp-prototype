import { Container, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Brand } from '../../components/layout/brand';
import { mockActions, useMockStore } from '../../mock/store';
import { QuestionScreen } from './question-screen';
import { StepCrmStages, isCrmStepValid } from './step-crm-stages';
import { initialWizardData, type WizardData } from './types';

const MIN_PRODUCT_CHARS = 30;

interface QuestionDef {
  id: string;
  question: string;
  helper?: string;
  optional?: boolean;
  render: (
    data: WizardData,
    setData: (patch: (d: WizardData) => WizardData) => void,
    onEnterAdvance: () => void,
  ) => ReactNode;
  isValid: (data: WizardData) => boolean;
}

const QUESTIONS: QuestionDef[] = [
  {
    id: 'workspace-name',
    question: 'What should we call your workspace?',
    helper:
      'Usually your company name. The workspace is the container for your pipeline configuration, product, and deals.',
    render: (data, setData, advance) => (
      <TextInput
        size="md"
        placeholder="e.g. Acme Sales Co"
        value={data.workspace.name}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setData((d) => ({ ...d, workspace: { ...d.workspace, name: value } }));
        }}
        onKeyDown={advanceOnEnter(advance)}
        data-autofocus
      />
    ),
    isValid: (d) => d.workspace.name.trim().length > 0,
  },
  {
    id: 'workspace-website',
    question: 'Do you have a website?',
    helper: 'Optional. Skip if you’d rather not share it.',
    optional: true,
    render: (data, setData, advance) => (
      <TextInput
        size="md"
        placeholder="https://acme.example"
        value={data.workspace.website}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setData((d) => ({ ...d, workspace: { ...d.workspace, website: value } }));
        }}
        onKeyDown={advanceOnEnter(advance)}
        data-autofocus
      />
    ),
    isValid: () => true,
  },
  {
    id: 'workspace-industry',
    question: 'What industry are you in?',
    helper: 'Optional — helps tailor diagnoses later.',
    optional: true,
    render: (data, setData, advance) => (
      <TextInput
        size="md"
        placeholder="e.g. SaaS, Manufacturing, Fintech"
        value={data.workspace.industry}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setData((d) => ({ ...d, workspace: { ...d.workspace, industry: value } }));
        }}
        onKeyDown={advanceOnEnter(advance)}
        data-autofocus
      />
    ),
    isValid: () => true,
  },
  {
    id: 'product-name',
    question: "What's your product called?",
    helper: 'The product or service you sell.',
    render: (data, setData, advance) => (
      <TextInput
        size="md"
        placeholder="e.g. Pulse"
        value={data.product.name}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setData((d) => ({ ...d, product: { ...d.product, name: value } }));
        }}
        onKeyDown={advanceOnEnter(advance)}
        data-autofocus
      />
    ),
    isValid: (d) => d.product.name.trim().length > 0,
  },
  {
    id: 'product-description',
    question: 'What do you sell?',
    helper: `In a sentence or two. This flows into every diagnosis — be specific. At least ${MIN_PRODUCT_CHARS} characters.`,
    render: (data, setData) => (
      <LongAnswer
        value={data.product.description}
        onChange={(value) =>
          setData((d) => ({ ...d, product: { ...d.product, description: value } }))
        }
        placeholder="e.g. Pulse is a pipeline-intelligence platform that scores every B2B deal on buyer readiness using meeting evidence."
      />
    ),
    isValid: (d) => d.product.description.trim().length >= MIN_PRODUCT_CHARS,
  },
  {
    id: 'product-target-buyer',
    question: 'Who do you sell to?',
    helper: `Title, segment, company size. At least ${MIN_PRODUCT_CHARS} characters.`,
    render: (data, setData) => (
      <LongAnswer
        value={data.product.targetBuyer}
        onChange={(value) =>
          setData((d) => ({ ...d, product: { ...d.product, targetBuyer: value } }))
        }
        placeholder="e.g. VP of Sales, Head of RevOps at 100-1,000 person SaaS companies with multi-rep teams."
      />
    ),
    isValid: (d) => d.product.targetBuyer.trim().length >= MIN_PRODUCT_CHARS,
  },
  {
    id: 'product-problem-solved',
    question: 'What problem do you usually solve?',
    helper: `In their words, not yours. At least ${MIN_PRODUCT_CHARS} characters.`,
    render: (data, setData) => (
      <LongAnswer
        value={data.product.problemSolved}
        onChange={(value) =>
          setData((d) => ({ ...d, product: { ...d.product, problemSolved: value } }))
        }
        placeholder="e.g. Reps over-call deals in CRM stages, inflating the forecast. We surface those mismatches before forecast day."
      />
    ),
    isValid: (d) => d.product.problemSolved.trim().length >= MIN_PRODUCT_CHARS,
  },
  {
    id: 'crm-stages',
    question: 'How does your team move deals through the pipeline?',
    helper:
      'This drives the Pipeline Reality Check — comparing your CRM stage to the buyer\'s evidence-based readiness.',
    render: (data, setData) => (
      <StepCrmStages
        data={data.crm}
        onChange={(patch) => setData((d) => ({ ...d, crm: { ...d.crm, ...patch } }))}
      />
    ),
    isValid: (d) => isCrmStepValid(d.crm),
  },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const session = useMockStore((s) => s.session);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialWizardData);

  const totalSteps = QUESTIONS.length;
  const current = QUESTIONS[step]!;
  const isLast = step === totalSteps - 1;
  const canContinue = current.isValid(data);

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleContinue = () => {
    if (!canContinue) return;
    if (isLast) {
      handleFinish();
      return;
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };

  const handleFinish = () => {
    if (!session) return;
    if (!QUESTIONS.every((q) => q.isValid(data))) return;

    mockActions.updateWorkspace(session.workspaceId, {
      name: data.workspace.name.trim(),
      website: data.workspace.website.trim() || null,
      industry: data.workspace.industry.trim() || null,
      crmStageTemplate: data.crm.template,
      customCrmStages:
        data.crm.template === 'custom'
          ? data.crm.customStages
              .map((s) => s.name.trim())
              .filter((name) => name.length > 0)
              .map((name, order) => ({ name, order }))
          : null,
    });
    mockActions.upsertProductForWorkspace(session.workspaceId, {
      name: data.product.name.trim(),
      description: data.product.description.trim(),
      targetBuyer: data.product.targetBuyer.trim(),
      problemSolved: data.product.problemSolved.trim(),
    });
    mockActions.completeOnboarding();

    notifications.show({
      color: 'teal',
      title: `Welcome to Pitch Genius, ${session.user.name.split(' ')[0]}!`,
      message: 'Your workspace is ready. Let’s look at the pipeline.',
    });
    navigate({ to: '/opportunities' });
  };

  return (
    <Container size={560} py="xl">
      <Stack gap="xl">
        <Stack gap="md" align="center">
          <Brand size="lg" />
          <Stack gap={4} align="center">
            <Title order={3} ta="center">
              Welcome to Pitch Genius
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              A few quick questions and you’re in.
            </Text>
          </Stack>
        </Stack>

        <Paper p="xl" withBorder radius="md">
          <QuestionScreen
            stepIndex={step}
            totalSteps={totalSteps}
            question={current.question}
            helper={current.helper}
            isOptional={current.optional}
            canContinue={canContinue}
            isLast={isLast}
            onBack={handleBack}
            onContinue={handleContinue}
          >
            {current.render(data, setData, handleContinue)}
          </QuestionScreen>
        </Paper>
      </Stack>
    </Container>
  );
}

function LongAnswer({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const len = value.trim().length;
  const tooShort = len > 0 && len < MIN_PRODUCT_CHARS;
  const helper = `${len} / ~180 chars`;
  return (
    <Textarea
      size="md"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      autosize
      minRows={3}
      maxRows={8}
      error={
        tooShort
          ? `${helper} — needs at least ${MIN_PRODUCT_CHARS} characters before you can continue`
          : undefined
      }
      description={tooShort ? undefined : helper}
      data-autofocus
    />
  );
}

// Enter-to-advance for single-line inputs. Textareas use the Continue button so
// Enter still inserts a newline as expected.
function advanceOnEnter(advance: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      advance();
    }
  };
}

