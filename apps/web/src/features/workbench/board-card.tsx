import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Badge, Paper, Stack, Text, Group, Tooltip } from '@mantine/core';
import { IconAlertTriangleFilled, IconNotesOff } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { relativeTime } from '../../lib/relative-time';
import { ReadinessBadge } from './readiness-badge';
import { buyerName, companyName, type WorkbenchRow } from './workbench-data';

interface BoardCardProps {
  row: WorkbenchRow;
  showProduct: boolean;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}

// One opportunity on the Kanban board. The whole card is the drag handle; a
// click (without a drag) routes to the opportunity detail. @hello-pangea/dnd
// suppresses the post-drag click so dropping never navigates by accident.
export function BoardCard({ row, showProduct, provided, snapshot }: BoardCardProps) {
  const navigate = useNavigate();
  const { opportunity, buyer } = row;
  const company = companyName(row);
  const name = buyer ? buyerName(row) : opportunity.opportunityName;

  return (
    <Paper
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      withBorder
      radius="md"
      p="sm"
      shadow={snapshot.isDragging ? 'md' : undefined}
      onClick={() =>
        navigate({ to: '/opportunities/$opportunityId', params: { opportunityId: opportunity.id } })
      }
      style={{
        ...provided.draggableProps.style,
        cursor: 'pointer',
      }}
    >
      <Stack gap={8}>
        <Group gap={6} align="center" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
            {name}
          </Text>
          {opportunity.atRisk && (
            <Tooltip label="Flagged at risk">
              <IconAlertTriangleFilled size={14} color="var(--mantine-color-red-6)" />
            </Tooltip>
          )}
        </Group>

        <Text size="xs" c="dimmed" lineClamp={1}>
          {[company, showProduct ? row.product?.name : null].filter(Boolean).join(' · ') ||
            opportunity.opportunityName}
        </Text>

        <Group gap={6}>
          <ReadinessBadge
            state={opportunity.currentReadinessState}
            score={opportunity.currentReadinessScore}
            size="xs"
          />
          {row.activityCount === 0 && (
            <Tooltip
              label="No activity yet — add a call, email, or note to sharpen this deal's readiness."
              multiline
              w={220}
            >
              <Badge
                variant="light"
                color="orange"
                size="xs"
                leftSection={<IconNotesOff size={10} />}
              >
                No activity
              </Badge>
            </Tooltip>
          )}
        </Group>

        <AlignmentBadge
          outcome={opportunity.currentAlignmentOutcome}
          level={opportunity.currentAlignmentLevel}
        />

        {row.primaryBlocker && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            <Text span fw={600} c="dimmed">
              Blocker:{' '}
            </Text>
            {row.primaryBlocker}
          </Text>
        )}

        <Text size="xs" c="dimmed">
          {relativeTime(row.latestActivityDate)}
        </Text>
      </Stack>
    </Paper>
  );
}
