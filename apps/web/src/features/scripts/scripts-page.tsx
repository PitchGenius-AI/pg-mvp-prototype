import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPlus, IconStar } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  useCurrentWorkspace,
  useScriptTemplates,
  useSetPrimaryScriptTemplate,
} from '../../mock/hooks';
import { relativeTime } from '../../lib/relative-time';
import type { MockScriptTemplate } from '../../mock/types';
import { ScriptFormModal } from './script-form-modal';
import { ScriptsEmpty, ScriptsError, ScriptsLoading } from './scripts-states';

// The Call Scripts management page (M16, PG-220) — the editing home for the
// call-script template captured at onboarding step 8. List, add, edit, and
// set-primary. MVP supports one template in practice; the page is built so
// adding more later is purely additive.
export function ScriptsPage() {
  const { data: workspace } = useCurrentWorkspace();
  const templates = useScriptTemplates();
  const setPrimary = useSetPrimaryScriptTemplate();

  const [modalOpen, { open, close }] = useDisclosure(false);
  // The template being edited; null → the modal is in add mode.
  const [editing, setEditing] = useState<MockScriptTemplate | null>(null);
  // The template mid-promotion, so its row action shows a spinner.
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Primary first, then alphabetical — a stable order the rep can scan.
  const sorted = useMemo(() => {
    const list = templates.data ?? [];
    return [...list].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [templates.data]);

  const openAdd = () => {
    setEditing(null);
    open();
  };

  const openEdit = (template: MockScriptTemplate) => {
    setEditing(template);
    open();
  };

  const handleSetPrimary = (template: MockScriptTemplate) => {
    setPromotingId(template.id);
    setPrimary.mutate(template.id, {
      onSuccess: () => {
        notifications.show({
          color: 'teal',
          title: 'Primary script updated',
          message: `${template.name} now anchors your generated pre-call scripts.`,
        });
      },
      onSettled: () => setPromotingId(null),
    });
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2}>Call scripts</Title>
            <Text size="sm" c="dimmed">
              Your reusable call-script templates — the talk tracks you already use.
            </Text>
          </Stack>
          {sorted.length > 0 && (
            <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
              Add script
            </Button>
          )}
        </Group>

        {sorted.length > 0 && (
          <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
            These are templates, not the finished article. For every opportunity, Pitch Genius
            generates a tailored pre-call script — modeled on your primary template and the
            buyer's profile. Editing a template shapes future generated scripts, not ones
            already produced.
          </Alert>
        )}

        {templates.isPending ? (
          <ScriptsLoading />
        ) : templates.isError ? (
          <ScriptsError onRetry={() => void templates.refetch()} />
        ) : sorted.length === 0 ? (
          <ScriptsEmpty onAdd={openAdd} />
        ) : (
          <Stack gap="md">
            {sorted.map((template) => (
              <ScriptCard
                key={template.id}
                template={template}
                onEdit={() => openEdit(template)}
                onSetPrimary={() => handleSetPrimary(template)}
                promoting={promotingId === template.id}
                promoteDisabled={setPrimary.isPending}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {workspace && (
        <ScriptFormModal
          opened={modalOpen}
          onClose={close}
          workspaceId={workspace.id}
          template={editing}
        />
      )}
    </Container>
  );
}

function ScriptCard({
  template,
  onEdit,
  onSetPrimary,
  promoting,
  promoteDisabled,
}: {
  template: MockScriptTemplate;
  onEdit: () => void;
  onSetPrimary: () => void;
  promoting: boolean;
  promoteDisabled: boolean;
}) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Group gap="xs" align="center" wrap="wrap">
            <Text fw={600} size="lg">
              {template.name}
            </Text>
            {template.isPrimary && (
              <Badge variant="light" leftSection={<IconStar size={11} />}>
                Primary
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            {!template.isPrimary && (
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconStar size={14} />}
                onClick={onSetPrimary}
                loading={promoting}
                disabled={promoteDisabled && !promoting}
              >
                Set as primary
              </Button>
            )}
            <Button size="xs" variant="default" onClick={onEdit}>
              Edit
            </Button>
          </Group>
        </Group>

        <Paper bg="var(--mantine-color-default-hover)" radius="sm" p="sm">
          <Text
            size="sm"
            c="dimmed"
            lineClamp={6}
            style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--mantine-font-family-monospace)' }}
          >
            {template.content}
          </Text>
        </Paper>

        <Text size="xs" c="dimmed">
          Updated {relativeTime(template.updatedAt)}
        </Text>
      </Stack>
    </Paper>
  );
}
