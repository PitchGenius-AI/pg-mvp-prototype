import {
  Button,
  Center,
  Code,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | null;
  onRetry?: () => void;
  homeLabel?: string;
  homeTo?: string;
}

// Designed error state for use anywhere that needs to render an error card —
// query failures, partial-load failures, programmatic catches. The route-level
// boundary (RouteErrorComponent below) wraps this with retry + back-to-list defaults.
export function ErrorState({
  title = 'Something went wrong',
  description = "We hit an issue loading this. The error has been logged — you can retry, or head back to your opportunities.",
  error,
  onRetry,
  homeLabel = 'Back to opportunities',
  homeTo = '/opportunities',
}: ErrorStateProps) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={560}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={36} color="var(--mantine-color-red-6)" />
          <Title order={3}>{title}</Title>
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
          {error?.message && (
            <Code block style={{ fontSize: 11, maxWidth: '100%' }}>
              {error.message}
            </Code>
          )}
          <Group gap="xs" mt="sm">
            {onRetry && (
              <Button
                leftSection={<IconRefresh size={14} />}
                variant="filled"
                onClick={onRetry}
              >
                Retry
              </Button>
            )}
            <Button
              component={Link}
              to={homeTo}
              leftSection={<IconArrowLeft size={14} />}
              variant="default"
            >
              {homeLabel}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
}

// Route-level error boundary for TanStack Router. Receives `error` + `reset`
// from the router; reset clears the boundary and re-renders the matched route.
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <Container size="md" py="xl">
      <ErrorState
        error={error instanceof Error ? error : null}
        onRetry={reset}
      />
    </Container>
  );
}
