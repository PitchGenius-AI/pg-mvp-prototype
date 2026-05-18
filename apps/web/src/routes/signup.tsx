import { Anchor, Button, Container, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconTargetArrow } from '@tabler/icons-react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { mockActions } from '../mock/store';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (v.length >= 1 ? null : 'Required'),
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
        Create account
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Prototype: signup creates a fresh empty workspace. To see a pre-populated demo
        workspace instead, use the sign-in flow.
      </Text>
      <form
        onSubmit={form.onSubmit((values) => {
          // Fresh user — no relation to the seeded demo user.
          const userId = `user_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '')}`;
          // Empty workspace; onboarding wizard overwrites name/product/CRM stages on submit.
          const workspace = mockActions.addWorkspace({
            name: 'New workspace',
            createdByUserId: userId,
            onboardingCompleted: false,
          });
          mockActions.setSession({
            user: { id: userId, name: values.name, email: values.email },
            workspaceId: workspace.id,
            workspaceOnboardingCompleted: false,
          });
          navigate({ to: '/onboarding' });
        })}
      >
        <Stack>
          <TextInput label="Name" {...form.getInputProps('name')} required />
          <TextInput label="Email" {...form.getInputProps('email')} required />
          <PasswordInput label="Password" {...form.getInputProps('password')} required />
          <Button type="submit">Create account</Button>
          <Anchor component={Link} to="/login" size="sm">
            Already have an account? Sign in
          </Anchor>
        </Stack>
      </form>
    </Container>
  );
}
