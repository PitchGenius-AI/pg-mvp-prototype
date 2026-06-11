import { Anchor, Button, Container, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconTargetArrow } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { authClient } from '../auth-client';

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
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      notifications.show({
        color: 'red',
        title: 'Sign in failed',
        message: error.message ?? 'Check your email and password and try again.',
      });
      return;
    }
    navigate({ to: redirect ?? '/' });
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
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput label="Email" {...form.getInputProps('email')} required />
          <PasswordInput label="Password" {...form.getInputProps('password')} required />
          <Group justify="flex-end" mt={-8}>
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() =>
                notifications.show({
                  title: 'Not implemented yet',
                  message: 'Password reset will land in a later update.',
                })
              }
            >
              Forgot password?
            </Anchor>
          </Group>
          <Button type="submit" loading={submitting}>
            Sign in
          </Button>
          <Anchor component={Link} to="/signup" size="sm">
            Need an account? Sign up
          </Anchor>
        </Stack>
      </form>
    </Container>
  );
}
