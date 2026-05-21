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
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { SIMPLE_B2B_SALES_STAGES, type CrmStageTemplate } from '@pg/shared';
import { newDraftId } from '../../../mock/types';

// Reusable CRM-stage picker — Simple B2B Sales template vs. custom add/rename/
// reorder. Extracted from the M3 onboarding step so the M10 wizard (and a future
// settings surface) can share it.

type CustomStage = { id: string; name: string };

interface CrmStagesEditorProps {
  template: CrmStageTemplate;
  customStages: CustomStage[];
  onChange: (patch: { template?: CrmStageTemplate; customStages?: CustomStage[] }) => void;
}

export function areStagesValid(
  template: CrmStageTemplate,
  customStages: CustomStage[],
): boolean {
  if (template === 'simple_b2b_sales') return true;
  return customStages.filter((s) => s.name.trim().length > 0).length >= 2;
}

export function CrmStagesEditor({ template, customStages, onChange }: CrmStagesEditorProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...customStages];
    const [moved] = reordered.splice(result.source.index, 1);
    if (!moved) return;
    reordered.splice(result.destination.index, 0, moved);
    onChange({ customStages: reordered });
  };

  const updateStage = (id: string, name: string) =>
    onChange({
      customStages: customStages.map((s) => (s.id === id ? { ...s, name } : s)),
    });

  const removeStage = (id: string) =>
    onChange({ customStages: customStages.filter((s) => s.id !== id) });

  const addStage = () =>
    onChange({ customStages: [...customStages, { id: newDraftId('stage'), name: '' }] });

  return (
    <Radio.Group
      value={template}
      onChange={(value) => onChange({ template: value as CrmStageTemplate })}
    >
      <Stack gap="sm">
        <Paper p="md" withBorder radius="md">
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
                  The classic outbound funnel. Use this if your team runs on HubSpot or
                  Pipedrive defaults.
                </Text>
              </Stack>
            }
          />
          {template === 'simple_b2b_sales' && (
            <Group gap="xs" mt="sm" pl={30}>
              {SIMPLE_B2B_SALES_STAGES.map((stage) => (
                <Badge key={stage} variant="light" color="gray">
                  {stage}
                </Badge>
              ))}
            </Group>
          )}
        </Paper>

        <Paper p="md" withBorder radius="md">
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
          {template === 'custom' && (
            <Stack gap="xs" mt="md" pl={30}>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="custom-stages">
                  {(droppable) => (
                    <Stack gap="xs" ref={droppable.innerRef} {...droppable.droppableProps}>
                      {customStages.map((stage, index) => (
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
                                onChange={(e) => updateStage(stage.id, e.currentTarget.value)}
                                placeholder={`Stage ${index + 1}`}
                                style={{ flex: 1 }}
                              />
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label="Remove stage"
                                onClick={() => removeStage(stage.id)}
                                disabled={customStages.length <= 2}
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
  );
}
