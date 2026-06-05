import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconBrandLinkedin, IconMail } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  EMAIL_ENRICH_STEPS,
  LINKEDIN_ENRICH_STEPS,
  fakeEnrichBuyer,
  type BuyerEnrichment,
  type EnrichSource,
} from '../../mock/fake-enrich';

interface BuyerLookupProps {
  // Called with whatever we could enrich (source = how we found it). On a miss
  // we still pass a minimal enrichment seeded with just the entered value so the
  // rep can carry on filling the form in manually.
  onResolve: (source: EnrichSource, enrichment: BuyerEnrichment) => void;
  // Skip enrichment entirely and open a blank form.
  onSkip: () => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const URL_RE = /^https?:\/\//;

// Phase 1 of Manual Entry (PG-210, reworked): start from a single identifier —
// an email or a LinkedIn URL — and let the mock enrichment pre-fill the form,
// rather than presenting every field blank up front.
export function BuyerLookup({ onResolve, onSkip }: BuyerLookupProps) {
  const [source, setSource] = useState<EnrichSource>('email');
  const [value, setValue] = useState('');
  const [running, setRunning] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);

  const steps = source === 'email' ? EMAIL_ENRICH_STEPS : LINKEDIN_ENRICH_STEPS;

  // Cycle the progress messages while enrichment runs, independent of the
  // promise — purely so the wait has a sense of motion (mirrors WebsiteStep).
  useEffect(() => {
    if (!running) return;
    setMessageIndex(0);
    const id = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, steps.length - 1));
    }, 650);
    return () => clearInterval(id);
  }, [running, steps.length]);

  const trimmed = value.trim();
  const validationError = (() => {
    if (!touched || trimmed.length === 0) return null;
    if (source === 'email') return EMAIL_RE.test(trimmed) ? null : 'Enter a valid email';
    return URL_RE.test(trimmed) ? null : 'Enter a full LinkedIn URL (https://…)';
  })();
  const canLookUp =
    trimmed.length > 0 &&
    !running &&
    (source === 'email' ? EMAIL_RE.test(trimmed) : URL_RE.test(trimmed));

  const handleSourceChange = (next: string) => {
    setSource(next as EnrichSource);
    setValue('');
    setFailed(false);
    setTouched(false);
  };

  const handleLookUp = async () => {
    setTouched(true);
    if (!canLookUp) return;
    setFailed(false);
    setRunning(true);
    try {
      const result = await fakeEnrichBuyer(source, trimmed);
      if (result.ok) {
        onResolve(source, result.enrichment);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  };

  // On a miss, carry the one value the rep already typed into the form so they
  // don't re-enter it, and let them fill in the rest by hand.
  const continueManually = () => {
    const blank: BuyerEnrichment = {
      firstName: null,
      lastName: null,
      title: null,
      company: null,
      email: source === 'email' ? trimmed : null,
      linkedin: source === 'linkedin' ? trimmed : null,
      website: null,
    };
    onResolve(source, blank);
  };

  return (
    <Stack gap="lg" maw={520}>
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          Start with one detail
        </Text>
        <Text size="sm" c="dimmed">
          Give us an email or a LinkedIn profile and we’ll pull in what we can —
          you’ll review and finish the rest on the next screen.
        </Text>
      </Stack>

      <SegmentedControl
        value={source}
        onChange={handleSourceChange}
        disabled={running}
        data={[
          {
            value: 'email',
            label: (
              <Group gap={6} wrap="nowrap">
                <IconMail size={16} />
                <span>Email</span>
              </Group>
            ),
          },
          {
            value: 'linkedin',
            label: (
              <Group gap={6} wrap="nowrap">
                <IconBrandLinkedin size={16} />
                <span>LinkedIn</span>
              </Group>
            ),
          },
        ]}
      />

      {source === 'email' ? (
        <TextInput
          size="md"
          label="Buyer’s email"
          description="We’ll read their company from the domain and its website."
          placeholder="jane.doe@acme.com"
          type="email"
          leftSection={<IconMail size={16} />}
          value={value}
          error={validationError}
          disabled={running}
          autoFocus
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleLookUp();
            }
          }}
        />
      ) : (
        <TextInput
          size="md"
          label="LinkedIn profile URL"
          description="We’ll read their name, role, and company, plus the company website."
          placeholder="https://linkedin.com/in/jane-doe"
          leftSection={<IconBrandLinkedin size={16} />}
          value={value}
          error={validationError}
          disabled={running}
          autoFocus
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleLookUp();
            }
          }}
        />
      )}

      {running && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {steps[messageIndex]}
          </Text>
        </Group>
      )}

      {!running && failed && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={18} />}
          title="We couldn’t find much"
        >
          <Stack gap={6}>
            <Text size="sm">
              No problem — you can enter the buyer’s details yourself on the next
              screen.
            </Text>
            <Group gap="sm">
              <Anchor component="button" type="button" size="sm" onClick={continueManually}>
                Enter details manually
              </Anchor>
              <Text size="sm" c="dimmed">
                or fix the {source === 'email' ? 'email' : 'URL'} above and try again
              </Text>
            </Group>
          </Stack>
        </Alert>
      )}

      {!running && (
        <Group justify="space-between">
          <Button onClick={handleLookUp} disabled={!canLookUp}>
            Look up
          </Button>
          <Anchor component="button" type="button" size="sm" c="dimmed" onClick={onSkip}>
            Skip — enter details manually
          </Anchor>
        </Group>
      )}
    </Stack>
  );
}
