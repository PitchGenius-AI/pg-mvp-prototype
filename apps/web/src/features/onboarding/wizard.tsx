import { Button, Container, Group, Paper, Stack, Stepper, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Brand } from '../../components/layout/brand';
import { mockActions, useMockStore } from '../../mock/store';
import { isCrmStepValid, StepCrmStages } from './step-crm-stages';
import { isProductStepValid, StepProduct } from './step-product';
import { isWorkspaceStepValid, StepWorkspace } from './step-workspace';
import { initialWizardData, type WizardData } from './types';

const STEP_COUNT = 3;

export function OnboardingWizard() {
  const navigate = useNavigate();
  const session = useMockStore((s) => s.session);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<WizardData>(initialWizardData);

  const stepValid = [
    isWorkspaceStepValid(data.workspace),
    isProductStepValid(data.product),
    isCrmStepValid(data.crm),
  ];
  const currentValid = stepValid[active] ?? false;

  const handleNext = () => {
    if (active < STEP_COUNT - 1) setActive((a) => a + 1);
  };
  const handleBack = () => {
    if (active > 0) setActive((a) => a - 1);
  };

  const handleFinish = () => {
    if (!session) return;
    if (!stepValid.every(Boolean)) return;

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
    <Container size={680} py="xl">
      <Stack gap="lg">
        <Group justify="center">
          <Brand size="lg" />
        </Group>

        <Stack gap={4} align="center">
          <Title order={2}>Welcome to Pitch Genius</Title>
          <Stack gap={0} align="center">
            <span style={{ fontSize: 14, color: 'var(--mantine-color-dimmed)' }}>
              Five minutes to set up your workspace, product, and pipeline.
            </span>
          </Stack>
        </Stack>

        <Paper p="lg" withBorder radius="md">
          <Stack gap="xl">
            <Stepper active={active} onStepClick={setActive} size="sm">
              <Stepper.Step label="Workspace" description="Name + basics">
                <StepWorkspace
                  data={data.workspace}
                  onChange={(patch) =>
                    setData((d) => ({ ...d, workspace: { ...d.workspace, ...patch } }))
                  }
                />
              </Stepper.Step>
              <Stepper.Step label="Product" description="What you sell">
                <StepProduct
                  data={data.product}
                  onChange={(patch) =>
                    setData((d) => ({ ...d, product: { ...d.product, ...patch } }))
                  }
                />
              </Stepper.Step>
              <Stepper.Step label="Pipeline" description="CRM stages">
                <StepCrmStages
                  data={data.crm}
                  onChange={(patch) =>
                    setData((d) => ({ ...d, crm: { ...d.crm, ...patch } }))
                  }
                />
              </Stepper.Step>
            </Stepper>

            <Group justify="space-between">
              <Button variant="default" onClick={handleBack} disabled={active === 0}>
                Back
              </Button>
              {active < STEP_COUNT - 1 ? (
                <Button onClick={handleNext} disabled={!currentValid}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={!stepValid.every(Boolean)}>
                  Finish onboarding
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
