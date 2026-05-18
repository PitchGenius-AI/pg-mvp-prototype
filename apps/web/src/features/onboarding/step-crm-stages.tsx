import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Radio,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { SIMPLE_B2B_SALES_STAGES } from '@pg/shared';
import type { WizardData } from './types';

interface StepCrmStagesProps {
  data: WizardData['crm'];
  onChange: (patch: Partial<WizardData['crm']>) => void;
}

let stageIdCounter = 1000;
const newStageId = () => `stage_${++stageIdCounter}`;

export function StepCrmStages({ data, onChange }: StepCrmStagesProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...data.customStages];
    const [moved] = reordered.splice(result.source.index, 1);
    if (!moved) return;
    reordered.splice(result.destination.index, 0, moved);
    onChange({ customStages: reordered });
  };

  const updateStage = (id: string, name: string) => {
    onChange({
      customStages: data.customStages.map((s) => (s.id === id ? { ...s, name } : s)),
    });
  };

  const removeStage = (id: string) => {
    onChange({ customStages: data.customStages.filter((s) => s.id !== id) });
  };

  const addStage = () => {
    onChange({
      customStages: [...data.customStages, { id: newStageId(), name: '' }],
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        How does your team move deals through the pipeline? This drives the Pipeline Reality
        Check — comparing your CRM stage to the buyer's evidence-based readiness.
      </Text>

      <Radio.Group
        value={data.template}
        onChange={(value) =>
          onChange({ template: value as WizardData['crm']['template'] })
        }
      >
        <Stack gap="sm">
          <Paper p="md" withBorder>
            <Radio
              value="simple_b2b_sales"
              label={
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={500}>Simple B2B Sales</Text>
                    <Badge size="xs" variant="light">
                      Recommended
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    The classic 8-stage outbound funnel. Use this if your team uses Salesforce or
                    HubSpot defaults.
                  </Text>
                </Stack>
              }
            />
            {data.template === 'simple_b2b_sales' && (
              <Group gap="xs" mt="sm" pl={30}>
                {SIMPLE_B2B_SALES_STAGES.map((stage) => (
                  <Badge key={stage} variant="light" color="gray">
                    {stage}
                  </Badge>
                ))}
              </Group>
            )}
          </Paper>

          <Paper p="md" withBorder>
            <Radio
              value="custom"
              label={
                <Stack gap={4}>
                  <Text fw={500}>Custom stages</Text>
                  <Text size="xs" c="dimmed">
                    Define your own pipeline. At least 2 stages, drag the handle to reorder.
                  </Text>
                </Stack>
              }
            />
            {data.template === 'custom' && (
              <Stack gap="xs" mt="md" pl={30}>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="custom-stages">
                    {(droppable) => (
                      <Stack
                        gap="xs"
                        ref={droppable.innerRef}
                        {...droppable.droppableProps}
                      >
                        {data.customStages.map((stage, index) => (
                          <Draggable key={stage.id} draggableId={stage.id} index={index}>
                            {(draggable) => (
                              <Group
                                gap="xs"
                                wrap="nowrap"
                                ref={draggable.innerRef}
                                {...draggable.draggableProps}
                                style={draggable.draggableProps.style}
                              >
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label="Drag to reorder"
                                  {...draggable.dragHandleProps}
                                >
                                  <IconGripVertical size={16} />
                                </ActionIcon>
                                <TextInput
                                  value={stage.name}
                                  onChange={(e) =>
                                    updateStage(stage.id, e.currentTarget.value)
                                  }
                                  placeholder={`Stage ${index + 1}`}
                                  style={{ flex: 1 }}
                                />
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label="Remove stage"
                                  onClick={() => removeStage(stage.id)}
                                  disabled={data.customStages.length <= 2}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Group>
                            )}
                          </Draggable>
                        ))}
                        {droppable.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </DragDropContext>
                <Button
                  variant="subtle"
                  leftSection={<IconPlus size={16} />}
                  onClick={addStage}
                  size="xs"
                  w="fit-content"
                >
                  Add stage
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Radio.Group>
    </Stack>
  );
}

export function isCrmStepValid(d: WizardData['crm']): boolean {
  if (d.template === 'simple_b2b_sales') return true;
  const named = d.customStages.filter((s) => s.name.trim().length > 0);
  return named.length >= 2;
}
