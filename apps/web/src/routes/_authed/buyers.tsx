import { Center, Container, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Placeholder for the Buyers directory. The full people-directory table and the
// product-assignment flow land in M13 (PG-205–208); this route exists now so the
// Workbench's unassigned-buyers banner (PG-203) has a real deep-link target.
// `status` is honoured here so M13 can build straight onto the same URL contract.
export const Route = createFileRoute('/_authed/buyers')({
  validateSearch: z.object({
    status: z.enum(['all', 'unassigned']).optional(),
  }),
  component: BuyersPage,
});

function BuyersPage() {
  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Title order={2}>Buyers</Title>
        <Center py="xl">
          <Paper withBorder radius="md" p="xl" maw={460}>
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconUsers size={26} />
              </ThemeIcon>
              <Text fw={600}>Buyers directory is coming soon</Text>
              <Text size="sm" c="dimmed" ta="center">
                This is where you'll see every buyer in your workspace and assign products to
                the ones still waiting — turning them into opportunities on your workbench.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Stack>
    </Container>
  );
}
