import { mockAiCall } from './mock-api';

// Fake website scrape for onboarding step 3 (PG-192). Stands in for the real
// website-scrape profile-extraction chain that would live in packages/ai. It
// returns either canned extraction (confirmation mode for steps 4–7) or a
// failure (manual-entry fallback). All mock-backed — no network.

export interface ScrapeExtraction {
  industry: string;
  products: Array<{ name: string; description: string }>;
  targetCustomer: string;
  coreProblem: string;
}

export type ScrapeResult =
  | { ok: true; extraction: ScrapeExtraction }
  | { ok: false; reason: string };

// Staged messages shown during the simulated read so the wait has a sense of
// progress. Cycled on a timer by the step component, independent of the promise.
export const FAKE_SCRAPE_STEPS = [
  'Fetching your homepage…',
  'Reading your product pages…',
  'Identifying who you sell to…',
  'Summarizing what you do…',
] as const;

// The scrape "fails" (thin site) for any URL containing `fail` — a deterministic
// hook so a demoer can show the manual-entry fallback on demand. Every other URL
// succeeds. Documented in docs/demo-walkthrough.md.
function shouldScrapeFail(url: string): boolean {
  return url.toLowerCase().includes('fail');
}

// Canned extraction. Weaves the workspace name into the product names so the
// result feels like it actually came from the user's own site.
function buildExtraction(workspaceName: string): ScrapeExtraction {
  const brand = workspaceName.trim() || 'Your company';
  return {
    industry: 'B2B SaaS',
    products: [
      {
        name: `${brand} Platform`,
        description:
          'The core platform — a single workspace where revenue teams capture, score, and act on every active deal.',
      },
      {
        name: `${brand} Pipeline Insights`,
        description:
          'An analytics add-on that surfaces forecast risk and stalled deals across the whole pipeline.',
      },
    ],
    targetCustomer:
      'VP of Sales, RevOps leaders, and frontline sales managers at 50–500 person B2B companies running a multi-rep outbound motion.',
    coreProblem:
      "Sales teams can't reliably tell which pipeline deals are genuinely progressing and which are stalled but still being forecast — so the forecast slips and coaching arrives too late.",
  };
}

export function fakeScrapeWebsite(
  url: string,
  workspaceName: string,
): Promise<ScrapeResult> {
  return mockAiCall<ScrapeResult>(() => {
    if (shouldScrapeFail(url)) {
      return {
        ok: false,
        reason: "We couldn't read enough from your site to fill this in automatically.",
      };
    }
    return { ok: true, extraction: buildExtraction(workspaceName) };
  });
}
