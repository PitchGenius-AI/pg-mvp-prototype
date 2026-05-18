import { Container, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

// Stub for now — workspace + product editing comes post-MVP.
function SettingsPage() {
  return (
    <Container size="md" py="lg">
      <Stack>
        <Title order={2}>Settings</Title>
        <Text c="dimmed">Workspace and product configuration will live here.</Text>
      </Stack>
    </Container>
  );
}
