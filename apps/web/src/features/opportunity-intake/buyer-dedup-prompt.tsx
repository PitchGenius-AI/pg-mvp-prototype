import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { MockBuyer } from '../../mock/types';

export type DedupChoice = 'link' | 'create-new' | 'cancel';

interface BuyerDedupPromptProps {
  opened: boolean;
  match: MockBuyer | null;
  onClose: () => void;
  onChoose: (choice: DedupChoice) => void;
}

export function BuyerDedupPrompt({
  opened,
  match,
  onClose,
  onChoose,
}: BuyerDedupPromptProps) {
  if (!match) return null;
  const fullName = [match.firstName, match.lastName].filter(Boolean).join(' ');
  return (
    <Modal
      opened={opened}
      onClose={() => {
        onChoose('cancel');
        onClose();
      }}
      title="Buyer already exists"
      centered
      size="md"
      withCloseButton
    >
      <Stack gap="md">
        <Text size="sm">
          <strong>{fullName}</strong> at <strong>{match.company}</strong> is already a buyer
          in your workspace. Would you like to link this new opportunity to that buyer, or
          create a separate buyer record?
        </Text>
        {match.email && (
          <Text size="xs" c="dimmed">
            Existing record: {match.email}
            {match.title ? ` · ${match.title}` : ''}
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          <Button
            variant="default"
            onClick={() => {
              onChoose('cancel');
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onChoose('create-new');
              onClose();
            }}
          >
            Create new buyer
          </Button>
          <Button
            onClick={() => {
              onChoose('link');
              onClose();
            }}
          >
            Link to existing
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
