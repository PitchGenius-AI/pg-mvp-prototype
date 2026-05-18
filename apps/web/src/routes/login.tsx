import { Anchor, Button, Container, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconTargetArrow } from '@tabler/icons-react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { mockActions, useMockStore } from '../mock/store';
import { SEED_USER } from '../mock/seed';

const searchSchema = z.object({
  // Where to send the user after sign-in — populated by the _authed guard when it bounces them here.
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  return (
    <Container size={420} py="xl">
      <Group gap="xs" mb="lg">
        <IconTargetArrow size={22} />
        <Text fw={600} size="lg">
          Pitch Genius
        </Text>
      </Group>
      <Title order={2} mb="md">
        Sign in
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Prototype: any email + password lands you in the demo workspace.
      </Text>
      <form
        onSubmit={form.onSubmit((values) => {
          const workspaceId = pickDemoWorkspaceId();
          mockActions.setSession({
            user: { ...SEED_USER, email: values.email || SEED_USER.email },
            workspaceId,
            workspaceOnboardingCompleted: true,
          });
          navigate({ to: redirect ?? '/opportunities' });
        })}
      >
        <Stack>
          <TextInput label="Email" {...form.getInputProps('email')} required />
          <PasswordInput label="Password" {...form.getInputProps('password')} required />
          <Button type="submit">Sign in</Button>
          <Anchor component={Link} to="/signup" size="sm">
            Need an account? Sign up
          </Anchor>
        </Stack>
      </form>
    </Container>
  );
}

// The seed loads exactly one workspace; resolve its id at call time so we don't
// hardcode a magic string outside of seed.ts.
function pickDemoWorkspaceId(): string {
  const workspaces = Object.values(useMockStore.getState().workspaces);
  const first = workspaces[0];
  if (!first) {
    throw new Error('Mock store has no workspaces — seed did not run.');
  }
  return first.id;
}
