import { Modal, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClipboardText, IconFileSpreadsheet, IconForms } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { CsvUpload } from './csv-upload';
import { QuickPaste } from './quick-paste';
import { StructuredForm } from './structured-form';

interface AddOpportunityModalProps {
  opened: boolean;
  onClose: () => void;
}

export function AddOpportunityModal({ opened, onClose }: AddOpportunityModalProps) {
  const navigate = useNavigate();

  const handleSingleOpportunitySuccess = (opportunityId: string, sourceLabel: string) => {
    notifications.show({
      color: 'teal',
      title: 'Opportunity added',
      message: `Saved via ${sourceLabel}.`,
    });
    onClose();
    navigate({ to: '/opportunities/$opportunityId', params: { opportunityId } });
  };

  const handleBatchSuccess = (created: number, linked: number) => {
    notifications.show({
      color: 'teal',
      title: 'Import complete',
      message:
        linked > 0
          ? `Created ${created} opportunities, linked ${linked} to existing buyers.`
          : `Created ${created} opportunities.`,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add opportunity"
      size="lg"
      centered
      // Remount the tab content on each open so each session starts fresh.
      keepMounted={false}
    >
      <Tabs defaultValue="structured" keepMounted={false}>
        <Tabs.List grow mb="md">
          <Tabs.Tab value="structured" leftSection={<IconForms size={16} />}>
            Structured form
          </Tabs.Tab>
          <Tabs.Tab value="paste" leftSection={<IconClipboardText size={16} />}>
            Quick paste
          </Tabs.Tab>
          <Tabs.Tab value="csv" leftSection={<IconFileSpreadsheet size={16} />}>
            CSV upload
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="structured">
          <StructuredForm
            onSuccess={(id) => handleSingleOpportunitySuccess(id, 'structured form')}
          />
        </Tabs.Panel>
        <Tabs.Panel value="paste">
          <QuickPaste
            onSuccess={(id) => handleSingleOpportunitySuccess(id, 'quick paste')}
          />
        </Tabs.Panel>
        <Tabs.Panel value="csv">
          <CsvUpload onSuccess={handleBatchSuccess} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
