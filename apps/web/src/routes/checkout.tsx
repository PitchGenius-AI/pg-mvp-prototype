import {
  Alert,
  Anchor,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconCreditCard,
  IconLock,
} from '@tabler/icons-react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '../components/layout/brand';
import { hasActiveSubscription } from '../mock/access';
import { useClearSession } from '../mock/hooks';
import { mockActions, useCurrentSession, useMockStore } from '../mock/store';

// Onboarding step 11 (PG-196): a mock Stripe checkout rendered outside the app
// shell. The hard paywall (PG-197) holds an onboarded-but-unpaid rep here; a
// successful mock payment flips the subscription to `active` (PG-198) and drops
// them into the Workbench.
export const Route = createFileRoute('/checkout')({
  beforeLoad: () => {
    const { session, workspaces } = useMockStore.getState();
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: '/checkout' } });
    }
    // Checkout is the last onboarding step — the workspace must be configured
    // first. An unfinished signup bounces back to the wizard.
    if (!session.workspaceOnboardingCompleted) {
      throw redirect({ to: '/onboarding' });
    }
    // Already paid? Nothing to do here — send them to the app.
    if (hasActiveSubscription(workspaces[session.workspaceId])) {
      throw redirect({ to: '/' });
    }
  },
  component: CheckoutPage,
});

// [FLAG — pending Russell] Pricing, the single-plan-vs-tiers decision, and the
// no-trial assumption are all unconfirmed (PG-196). The values below are
// placeholders so the mock checkout renders a believable screen for the client
// demo — they are NOT final pricing.
const PLAN = {
  name: 'Pitch Genius — Individual',
  price: '$49',
  cadence: 'per month',
  features: [
    'Unlimited opportunities & buyer-readiness diagnoses',
    'Pipeline Reality Check on every deal',
    'Pre-call intelligence & the Live Co-pilot',
    'CRM import / export round-trip',
  ],
} as const;

// Mirrors Stripe's classic decline test card (4000 0000 0000 0002): a card
// number whose digits end in 0002 simulates a declined payment for the demo.
const DECLINE_SUFFIX = '0002';
const PROCESSING_MS = 1900;
const REDIRECT_MS = 1300;

type PaymentStatus = 'idle' | 'processing' | 'declined' | 'success';

// --- Card-field formatting -------------------------------------------------

const digitsOnly = (value: string) => value.replace(/\D/g, '');

function formatCardNumber(raw: string): string {
  return digitsOnly(raw)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

// --- Card-field validation -------------------------------------------------

function cardNumberError(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length === 0) return 'Enter your card number';
  if (digits.length < 13) return 'Card number looks incomplete';
  return null;
}

function expiryError(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return 'Use MM / YY';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Invalid month';
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return 'Card has expired';
  }
  return null;
}

function cvcError(value: string): string | null {
  return /^\d{3,4}$/.test(value.trim()) ? null : 'CVC is 3–4 digits';
}

function CheckoutPage() {
  const navigate = useNavigate();
  const session = useCurrentSession();
  const { mutate: signOut } = useClearSession();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  // Sequential demo timers (processing → success → redirect) — cleared on
  // unmount so a fast navigate-away can't fire a setState on a dead component.
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const form = useForm({
    initialValues: { cardNumber: '', expiry: '', cvc: '', name: '' },
    validateInputOnBlur: true,
    validate: {
      cardNumber: cardNumberError,
      expiry: expiryError,
      cvc: cvcError,
      name: (v) => (v.trim().length >= 2 ? null : 'Enter the name on the card'),
    },
  });

  const busy = status === 'processing' || status === 'success';
  const firstName = session?.user.name.trim().split(/\s+/)[0] ?? 'there';

  const handleSubmit = form.onSubmit((values) => {
    setStatus('processing');
    const declined = digitsOnly(values.cardNumber).endsWith(DECLINE_SUFFIX);
    timers.current.push(
      window.setTimeout(() => {
        if (declined) {
          setStatus('declined');
          return;
        }
        // Payment "cleared" — flip the workspace to a paid subscription so the
        // paywall guards let the rep through.
        mockActions.activateSubscription();
        setStatus('success');
        timers.current.push(window.setTimeout(() => navigate({ to: '/' }), REDIRECT_MS));
      }, PROCESSING_MS),
    );
  });

  const handleSignOut = () => signOut(undefined, { onSuccess: () => navigate({ to: '/login' }) });

  return (
    <Container size={420} py="xl">
      <Stack gap="lg">
        <Group justify="center">
          <Brand size="lg" />
        </Group>

        {status === 'success' ? (
          <Paper withBorder radius="md" p="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={52} radius="xl" color="teal" variant="light">
                <IconCircleCheck size={32} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                Payment successful
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                You’re all set, {firstName}. Taking you to your workspace…
              </Text>
              <Loader size="sm" mt={4} />
            </Stack>
          </Paper>
        ) : (
          <>
            <Stack gap={4}>
              <Text size="xs" c="dimmed" fw={500}>
                Step 11 of 11
              </Text>
              <Progress value={100} size="xs" radius="xl" />
            </Stack>

            <Stack gap={6}>
              <Title order={2}>Activate your subscription</Title>
              <Text size="sm" c="dimmed">
                Your workspace is configured — add a payment method to start diagnosing your
                pipeline.
              </Text>
            </Stack>

            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Text fw={600}>{PLAN.name}</Text>
                  <Text size="xs" c="dimmed">
                    Billed monthly · cancel anytime
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text fw={700} size="xl">
                    {PLAN.price}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {PLAN.cadence}
                  </Text>
                </div>
              </Group>
              <Divider my="sm" />
              <Stack gap={6}>
                {PLAN.features.map((feature) => (
                  <Group key={feature} gap="xs" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={18} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">{feature}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  <Text size="sm" fw={500}>
                    Payment details
                  </Text>
                  <TextInput
                    label="Card number"
                    placeholder="1234 1234 1234 1234"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    leftSection={<IconCreditCard size={16} />}
                    disabled={busy}
                    {...form.getInputProps('cardNumber')}
                    onChange={(e) =>
                      form.setFieldValue('cardNumber', formatCardNumber(e.currentTarget.value))
                    }
                  />
                  <Group grow align="flex-start">
                    <TextInput
                      label="Expiry"
                      placeholder="MM / YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      disabled={busy}
                      {...form.getInputProps('expiry')}
                      onChange={(e) =>
                        form.setFieldValue('expiry', formatExpiry(e.currentTarget.value))
                      }
                    />
                    <TextInput
                      label="CVC"
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      disabled={busy}
                      {...form.getInputProps('cvc')}
                      onChange={(e) =>
                        form.setFieldValue('cvc', digitsOnly(e.currentTarget.value).slice(0, 4))
                      }
                    />
                  </Group>
                  <TextInput
                    label="Name on card"
                    placeholder="Casey Morgan"
                    autoComplete="cc-name"
                    disabled={busy}
                    {...form.getInputProps('name')}
                  />

                  {status === 'declined' && (
                    <Alert
                      color="red"
                      variant="light"
                      icon={<IconAlertCircle size={16} />}
                      title="Card declined"
                    >
                      Your card was declined. Check the details and try again, or use a different
                      card.
                    </Alert>
                  )}

                  <Button type="submit" fullWidth loading={status === 'processing'} disabled={busy}>
                    Pay {PLAN.price} and continue
                  </Button>
                </Stack>
              </form>
            </Paper>

            <Stack gap={4}>
              <Group gap={6} justify="center">
                <IconLock size={13} />
                <Text size="xs" c="dimmed">
                  Mock checkout — no real charge is made.
                </Text>
              </Group>
              <Text size="xs" c="dimmed" ta="center">
                Any card works. A number ending in {DECLINE_SUFFIX} simulates a decline.
              </Text>
              <Anchor
                component="button"
                type="button"
                size="xs"
                c="dimmed"
                ta="center"
                onClick={handleSignOut}
              >
                Sign out
              </Anchor>
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}
