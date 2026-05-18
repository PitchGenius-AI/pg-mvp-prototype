import { Anchor, Button, Container, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { signUp } from '../auth-client';

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
      <Title order={2} mb="md">
        Create account
      </Title>
      <form
        onSubmit={form.onSubmit(async (values) => {
          const { error } = await signUp.email({
            email: values.email,
            password: values.password,
            name: values.name,
          });
          if (error) {
            notifications.show({ color: 'red', title: 'Sign up failed', message: error.message ?? '' });
            return;
          }
          navigate({ to: '/onboarding' });
        })}
      >
        <Stack>
          <TextInput label="Name" {...form.getInputProps('name')} required />
          <TextInput label="Email" {...form.getInputProps('email')} required />
          <PasswordInput label="Password" {...form.getInputProps('password')} required />
          <Button type="submit" loading={form.submitting}>
            Create account
          </Button>
          <Anchor component={Link} to="/login" size="sm">
            Already have an account? Sign in
          </Anchor>
        </Stack>
      </form>
    </Container>
  );
}
