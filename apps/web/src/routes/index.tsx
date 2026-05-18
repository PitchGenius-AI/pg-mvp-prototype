import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useSession } from '../auth-client';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { data: session, isPending } = useSession();

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Pitch Genius</Title>
        <Text c="dimmed">Buyer Readiness Intelligence for individual sales reps.</Text>
        {!isPending && !session && (
          <Stack gap="xs" mt="md">
            <Button component={Link} to="/login" variant="filled">
              Sign in
            </Button>
            <Button component={Link} to="/signup" variant="default">
              Create account
            </Button>
          </Stack>
        )}
        {session && (
          <Button component={Link} to="/opportunities" mt="md">
            Go to opportunities
          </Button>
        )}
      </Stack>
    </Container>
  );
}
