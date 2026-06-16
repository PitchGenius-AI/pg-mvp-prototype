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
import type { EnrichedBuyerFields, EnrichmentCandidate, EnrichSource } from '@pg/shared';
import { trpc } from '../../trpc';
import { CandidatePicker } from './candidate-picker';

interface BuyerLookupProps {
  // Called with the buyer fields we resolved (source = how we found them). On a
  // miss we pass a minimal set seeded with just the entered value so the rep can
  // carry on filling the form in manually.
  onResolve: (source: EnrichSource, fields: EnrichedBuyerFields) => void;
  // Skip enrichment entirely and open a blank form.
  onSkip: () => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const URL_RE = /^https?:\/\//;

// Staged progress messages, cycled on a timer while the lookup runs — purely so
// the wait has a sense of motion.
const EMAIL_STEPS = [
  'Searching the web for this person…',
  'Reading what we found…',
  'Sorting out who’s who…',
] as const;
const LINKEDIN_STEPS = [
  'Opening the LinkedIn profile…',
  'Searching the web for this person…',
  'Sorting out who’s who…',
] as const;

// Phase 1 of Manual Entry (PG-210 / PG-288): start from a single identifier — an
// email or a LinkedIn URL — run real enrichment, then either auto-fill (one clear
// match) or let the rep pick among same-name candidates before pre-filling.
export function BuyerLookup({ onResolve, onSkip }: BuyerLookupProps) {
  const [source, setSource] = useState<EnrichSource>('email');
  const [value, setValue] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  // Populated when enrichment returns more than one candidate — the rep disambiguates.
  const [candidates, setCandidates] = useState<EnrichmentCandidate[] | null>(null);

  const resolveLead = trpc.enrichment.resolveLead.useMutation();
  const running = resolveLead.isPending;
  const steps = source === 'email' ? EMAIL_STEPS : LINKEDIN_STEPS;

  // Cycle the progress messages while enrichment runs, independent of the promise.
  useEffect(() => {
    if (!running) return;
    setMessageIndex(0);
    const id = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, steps.length - 1));
    }, 800);
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
    setCandidates(null);
  };

  const handleLookUp = async () => {
    setTouched(true);
    if (!canLookUp) return;
    setFailed(false);
    setCandidates(null);
    try {
      const result = await resolveLead.mutateAsync({ source, value: trimmed });
      if (result.candidates.length === 0) {
        setFailed(true);
      } else if (result.candidates.length === 1) {
        // One clear match — pre-fill straight away.
        onResolve(source, result.candidates[0]!.fields);
      } else {
        // Ambiguous — let the rep pick the right person.
        setCandidates(result.candidates);
      }
    } catch {
      setFailed(true);
    }
  };

  // On a miss, carry the one value the rep already typed into the form so they
  // don't re-enter it, and let them fill in the rest by hand.
  const continueManually = () => {
    const seeded: EnrichedBuyerFields = {
      firstName: null,
      lastName: null,
      title: null,
      company: null,
      email: source === 'email' ? trimmed : null,
      linkedin: source === 'linkedin' ? trimmed : null,
      website: null,
    };
    onResolve(source, seeded);
  };

  // Candidate disambiguation — the rep picks among same-name people.
  if (candidates) {
    return (
      <CandidatePicker
        candidates={candidates}
        onPick={(candidate) => onResolve(source, candidate.fields)}
        onManual={continueManually}
      />
    );
  }

  return (
    <Stack gap="lg" maw={520}>
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          Start with one detail
        </Text>
        <Text size="sm" c="dimmed">
          Give us an email or a LinkedIn profile and we’ll pull in what we can — you’ll review and
          finish the rest on the next screen.
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
          description="We’ll search the web for who they are and where they work."
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
              No problem — you can enter the buyer’s details yourself on the next screen.
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
