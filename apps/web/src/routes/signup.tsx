import {
  Anchor,
  Button,
  Container,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Brand } from '../components/layout/brand';
import { authClient } from '../auth-client';
import { mockActions } from '../mock/store';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

// Onboarding step 1 (PG-189): account creation via Better Auth. Creates the real
// user + session, then drops the rep into the onboarding wizard at step 2.

function emailError(value: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(value)) return 'Enter a valid email address';
  return null;
}

// Weak-password check: at least 8 characters, mixing a letter and a number.
function passwordError(value: string): string | null {
  if (value.length < 8) return 'Use at least 8 characters';
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Too weak — add a letter and a number';
  }
  return null;
}

function SignupPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    // Inline validation — errors surface as the rep leaves each field.
    validateInputOnBlur: true,
    validate: {
      name: (v) => (v.trim().length >= 1 ? null : 'Enter your name'),
      email: emailError,
      password: passwordError,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await authClient.signUp.email({
      email: values.email.trim(),
      password: values.password,
      name: values.name.trim(),
    });
    setSubmitting(false);
    if (error) {
      notifications.show({
        color: 'red',
        title: 'Could not create account',
        message: error.message ?? 'That email may already be registered.',
      });
      return;
    }
    // Start the onboarding wizard from a clean slate at step 2.
    mockActions.resetOnboardingDraft();
    navigate({ to: '/onboarding' });
  });

  const showLegalNotice = (doc: string) =>
    notifications.show({
      title: 'Not implemented in prototype',
      message: `The ${doc} page will land with the real product.`,
    });

  return (
    <Container size={420} py="xl">
      <Brand size="lg" />
      <Title order={2} mt="lg" mb={4}>
        Create your account
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Prototype: signup creates a fresh, empty workspace. To explore a pre-populated demo
        workspace instead, use the sign-in flow.
      </Text>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Full name"
            placeholder="Casey Morgan"
            {...form.getInputProps('name')}
            required
          />
          <TextInput
            label="Work email"
            placeholder="you@company.com"
            {...form.getInputProps('email')}
            required
          />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            {...form.getInputProps('password')}
            required
          />
          <Button type="submit" loading={submitting}>
            Create account
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            By creating an account, you agree to our{' '}
            <Anchor component="button" type="button" size="xs" onClick={() => showLegalNotice('Terms of Service')}>
              Terms of Service
            </Anchor>{' '}
            and{' '}
            <Anchor component="button" type="button" size="xs" onClick={() => showLegalNotice('Privacy Policy')}>
              Privacy Policy
            </Anchor>
            .
          </Text>
          <Anchor component={Link} to="/login" size="sm" ta="center">
            Already have an account? Sign in
          </Anchor>
        </Stack>
      </form>
    </Container>
  );
}
