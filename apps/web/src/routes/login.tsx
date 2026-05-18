import { Anchor, Button, Container, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { signIn } from '../auth-client';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  return (
    <Container size={420} py="xl">
      <Title order={2} mb="md">
        Sign in
      </Title>
      <form
        onSubmit={form.onSubmit(async (values) => {
          const { error } = await signIn.email(values);
          if (error) {
            notifications.show({ color: 'red', title: 'Sign in failed', message: error.message ?? '' });
            return;
          }
          navigate({ to: '/opportunities' });
        })}
      >
        <Stack>
          <TextInput label="Email" {...form.getInputProps('email')} required />
          <PasswordInput label="Password" {...form.getInputProps('password')} required />
          <Button type="submit" loading={form.submitting}>
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
