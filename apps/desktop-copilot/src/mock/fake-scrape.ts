import type { SellerProduct } from '@pg/shared';

// Mocked website scrape for the onboarding product-context step (§4.6, PG-281).
// Stands in for the real website-scrape extraction chain that would live in
// packages/ai — consistent with every other AI/auth surface in this build (no
// network). Mirrors apps/web/src/mock/fake-scrape.ts in spirit; kept desktop-local
// since the two apps don't share a package yet.

const newId = (prefix: string) =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(
    /-/g,
    '',
  )}`;

export type ScrapeResult =
  | { ok: true; products: SellerProduct[] }
  | { ok: false; reason: string };

// Staged messages shown during the simulated read so the wait has a sense of
// progress (the "reading your site…" beat). Cycled on a timer by the step
// component, independent of the promise.
export const FAKE_SCRAPE_STEPS = [
  'Fetching your homepage…',
  'Reading your product pages…',
  'Identifying who you sell to…',
  'Summarizing what each product solves…',
] as const;

// Pull a readable brand from the URL host so the canned result feels like it came
// from the seller's own site (acme.com → "Acme").
function brandFromUrl(url: string): string {
  try {
    const host = new URL(url.includes('://') ? url : `https://${url}`).hostname;
    const label = host.replace(/^www\./, '').split('.')[0] ?? '';
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Your company';
  } catch {
    return 'Your company';
  }
}

// The scrape "fails" (thin site) for any URL containing `fail` — a deterministic
// hook so a demoer can show the manual-entry fallback on demand. Every other URL
// succeeds with canned multi-product extraction.
function shouldScrapeFail(url: string): boolean {
  return url.toLowerCase().includes('fail');
}

// Canned multi-product extraction — two products so the multi-product capture
// (no up-front pick) is exercised. None is primary (one emerges over time, §4.6).
function buildProducts(url: string): SellerProduct[] {
  const brand = brandFromUrl(url);
  return [
    {
      id: newId('sprod'),
      name: `${brand} Platform`,
      description:
        'The core platform — a single workspace where revenue teams capture, score, and act on every active deal.',
      icp: 'VP of Sales and RevOps leaders at 50–500 person B2B companies running a multi-rep outbound motion.',
      problem:
        "Sales teams can't reliably tell which pipeline deals are genuinely progressing versus stalled-but-still-forecast, so the forecast slips and coaching arrives too late.",
      sourceUrl: url,
      isPrimary: false,
    },
    {
      id: newId('sprod'),
      name: `${brand} Pipeline Insights`,
      description:
        'An analytics add-on that surfaces forecast risk and stalled deals across the whole pipeline.',
      icp: 'Frontline sales managers and sales-ops analysts who own forecast accuracy.',
      problem:
        'Managers lack an early, evidence-based read on which deals are at risk before the forecast call.',
      sourceUrl: url,
      isPrimary: false,
    },
  ];
}

// Simulate the network + extraction latency so the "reading your site…" beat has
// time to read as real. Resolves with canned products, or a failure for the
// manual-entry fallback path.
export function fakeScrapeWebsite(url: string): Promise<ScrapeResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (shouldScrapeFail(url)) {
        resolve({
          ok: false,
          reason: "We couldn't read enough from your site to fill this in automatically.",
        });
      } else {
        resolve({ ok: true, products: buildProducts(url) });
      }
    }, 1600);
  });
}

// A blank product the seller can fill in by hand (manual-entry fallback, or "add
// another product"). Stamped with an id; not primary.
export function blankProduct(): SellerProduct {
  return {
    id: newId('sprod'),
    name: '',
    description: '',
    icp: '',
    problem: '',
    sourceUrl: null,
    isPrimary: false,
  };
}
