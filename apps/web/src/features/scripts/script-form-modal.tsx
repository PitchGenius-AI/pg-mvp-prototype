import {
  Alert,
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconUpload } from '@tabler/icons-react';
import { useAddScriptTemplate, useUpdateScriptTemplate } from '../../mock/hooks';
import type { MockScriptTemplate } from '../../mock/types';

interface ScriptFormModalProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
  // Present → edit mode; absent → add mode.
  template?: MockScriptTemplate | null;
}

// Add / edit a call-script template. The content is the rep's own talk track;
// Pitch Genius models the per-opportunity generated pre-call script on it.
// Setting the primary template is a separate per-card action (see ScriptsPage).
export function ScriptFormModal({
  opened,
  onClose,
  workspaceId,
  template,
}: ScriptFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={template ? 'Edit call script' : 'Add call script'}
      size="lg"
      centered
    >
      {/* Keyed so each open starts from fresh form state for the right template. */}
      {opened && (
        <ScriptFormBody
          key={template?.id ?? 'new'}
          workspaceId={workspaceId}
          template={template}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ScriptFormBody({
  workspaceId,
  template,
  onClose,
}: {
  workspaceId: string;
  template?: MockScriptTemplate | null;
  onClose: () => void;
}) {
  const addTemplate = useAddScriptTemplate();
  const updateTemplate = useUpdateScriptTemplate();

  const form = useForm({
    initialValues: {
      name: template?.name ?? '',
      content: template?.content ?? '',
    },
    validate: {
      name: (v) => (v.trim().length > 0 ? null : 'Required'),
      content: (v) => (v.trim().length > 0 ? null : 'Required'),
    },
  });

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    form.setFieldValue('content', text);
  };

  const submit = form.onSubmit((values) => {
    const fields = { name: values.name.trim(), content: values.content.trim() };
    if (template) {
      updateTemplate.mutate(
        { scriptTemplateId: template.id, patch: fields },
        {
          onSuccess: () => {
            notifications.show({
              color: 'teal',
              title: 'Call script updated',
              message: `${fields.name} has been saved.`,
            });
            onClose();
          },
        },
      );
    } else {
      addTemplate.mutate(
        { workspaceId, template: fields },
        {
          onSuccess: () => {
            notifications.show({
              color: 'teal',
              title: 'Call script added',
              message: `${fields.name} is now in your workspace.`,
            });
            onClose();
          },
        },
      );
    }
  });

  const pending = addTemplate.isPending || updateTemplate.isPending;
  const charCount = form.values.content.trim().length;

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput
          label="Script name"
          placeholder="e.g. Discovery call — readiness-first"
          withAsterisk
          autoFocus
          {...form.getInputProps('name')}
        />
        <Textarea
          label="Script content"
          description={
            charCount > 0 ? `${charCount} characters` : 'Paste your call script or talk track.'
          }
          placeholder="Paste your call script or talk track here…"
          withAsterisk
          autosize
          minRows={6}
          maxRows={16}
          {...form.getInputProps('content')}
        />
        <Group justify="space-between" gap="sm">
          <FileButton onChange={handleUpload} accept=".txt,.md,text/plain,text/markdown">
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                Upload a file
              </Button>
            )}
          </FileButton>
        </Group>

        {template && (
          <Alert
            variant="light"
            color="gray"
            icon={<IconInfoCircle size={16} />}
            title="Edits apply to future scripts only"
          >
            This is your reusable template. Changes shape the pre-call scripts Pitch Genius
            generates from now on — pre-call scripts already generated for an opportunity won't
            change.
          </Alert>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {template ? 'Save changes' : 'Add call script'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
