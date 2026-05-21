import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Badge, Box, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useMoveOpportunityStage } from '../../mock/hooks';
import { BoardCard } from './board-card';
import { groupRowsByStage, UNSTAGED_COLUMN, type StageColumn, type WorkbenchRow } from './workbench-data';

interface BoardViewProps {
  rows: WorkbenchRow[];
  stages: string[];
  showProduct: boolean;
}

// The default Workbench view (PG-200): a Kanban board, one column per CRM stage.
// Dragging a card to another column changes the opportunity's CRM stage and
// re-runs the Pipeline Reality Check (PG-201) — handled by the store action.
export function BoardView({ rows, stages, showProduct }: BoardViewProps) {
  const move = useMoveOpportunityStage();
  const columns = useMemo(() => groupRowsByStage(rows, stages), [rows, stages]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    // No-op drops: same column, or into the synthetic "Unstaged" column.
    if (destination.droppableId === source.droppableId) return;
    if (destination.droppableId === UNSTAGED_COLUMN) return;
    move.mutate({ opportunityId: draggableId, stage: destination.droppableId });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box style={{ overflowX: 'auto' }} pb="sm">
        <Group align="flex-start" gap="md" wrap="nowrap">
          {columns.map((column) => (
            <BoardColumn key={column.stage} column={column} showProduct={showProduct} />
          ))}
        </Group>
      </Box>
    </DragDropContext>
  );
}

interface BoardColumnProps {
  column: StageColumn;
  showProduct: boolean;
}

function BoardColumn({ column, showProduct }: BoardColumnProps) {
  const isUnstaged = column.stage === UNSTAGED_COLUMN;

  return (
    <Box w={300} style={{ flexShrink: 0 }}>
      <Group justify="space-between" align="center" mb={6} px={6}>
        <Text fw={600} size="sm">
          {column.stage}
        </Text>
        <Badge variant="default" size="sm">
          {column.rows.length}
        </Badge>
      </Group>

      <Droppable droppableId={column.stage} isDropDisabled={isUnstaged}>
        {(provided, snapshot) => (
          <Stack
            ref={provided.innerRef}
            {...provided.droppableProps}
            gap="sm"
            p="xs"
            style={{
              minHeight: 96,
              borderRadius: 'var(--mantine-radius-md)',
              background: snapshot.isDraggingOver
                ? 'var(--mantine-color-blue-light)'
                : 'var(--mantine-color-default-hover)',
              transition: 'background 120ms ease',
            }}
          >
            {column.rows.map((row, index) => (
              <Draggable
                key={row.opportunity.id}
                draggableId={row.opportunity.id}
                index={index}
              >
                {(dProvided, dSnapshot) => (
                  <BoardCard
                    row={row}
                    showProduct={showProduct}
                    provided={dProvided}
                    snapshot={dSnapshot}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {column.rows.length === 0 && !snapshot.isDraggingOver && (
              <Text size="xs" c="dimmed" ta="center" py="md">
                {isUnstaged ? 'Nothing here' : 'No deals in this stage'}
              </Text>
            )}
          </Stack>
        )}
      </Droppable>
    </Box>
  );
}
