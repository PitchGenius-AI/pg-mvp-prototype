import { useEffect, useRef, useState } from 'react';
import type { SellerProduct } from '@pg/shared';
import { useFitWindowToContent } from '../components/Overlay';
import { useProducts, productActions } from '../mock/store';
import { FAKE_SCRAPE_STEPS, blankProduct, fakeScrapeWebsite } from '../mock/fake-scrape';

// First-run onboarding — product / ICP / problem context capture (§4.6, PG-281).
//
// The hero interaction is "paste your website link → mocked scrape → prefill",
// then every field is editable and the seller can add more than one product. The
// step is FULLY SKIPPABLE (gating decision 2026-06-10): onboarding does NOT
// require a product — with zero products the planner falls back to product-neutral
// discovery. The seller never picks a product for the call here; the active
// product is matched live (§5.3, PG-286).
//
// Persists to the shared product store (mock/store.ts) — editable later in-app.
// This is the only onboarding step built for v1; the seller-profile / permissions
// steps (§4.1–4.5) are not in scope for M24's first slice.

type Phase = 'url' | 'scraping' | 'edit';

// — One editable product card (Name · Description · ICP · Problem, §4.6) — //
const FIELDS: Array<{
  key: 'name' | 'description' | 'icp' | 'problem';
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: 'name', label: 'Name', placeholder: 'Product name' },
  {
    key: 'description',
    label: 'Description',
    placeholder: 'What it is / does, in a sentence or two',
    multiline: true,
  },
  { key: 'icp', label: 'ICP', placeholder: "Who it's for (ideal customer profile)", multiline: true },
  { key: 'problem', label: 'Problem', placeholder: 'The problem it solves', multiline: true },
];

function ProductCard({
  product,
  index,
  onRemove,
}: {
  product: SellerProduct;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="ob-product">
      <div className="ob-product-head">
        <span className="ob-product-tag">Product {index + 1}</span>
        <button type="button" className="ob-remove" onClick={onRemove} title="Remove this product">
          Remove
        </button>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="ob-field">
          <span className="ob-field-label">{f.label}</span>
          {f.multiline ? (
            <textarea
              className="ob-input ob-input--area"
              rows={2}
              value={product[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => productActions.updateProduct(product.id, { [f.key]: e.target.value })}
            />
          ) : (
            <input
              className="ob-input"
              value={product[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => productActions.updateProduct(product.id, { [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function OnboardingFlow() {
  const products = useProducts();
  // Land straight in edit mode if context already exists (returning seller).
  const [phase, setPhase] = useState<Phase>(products.length > 0 ? 'edit' : 'url');
  const [url, setUrl] = useState('');
  const [stepIdx, setStepIdx] = useState(0);
  const [scrapeNote, setScrapeNote] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  useFitWindowToContent(shellRef, inTauri);

  // Cycle the "reading your site…" messages while the mocked scrape runs.
  useEffect(() => {
    if (phase !== 'scraping') return;
    setStepIdx(0);
    const id = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, FAKE_SCRAPE_STEPS.length - 1));
    }, 420);
    return () => clearInterval(id);
  }, [phase]);

  const runScrape = async () => {
    if (!url.trim()) return;
    setScrapeNote(null);
    setPhase('scraping');
    const result = await fakeScrapeWebsite(url.trim());
    if (result.ok) {
      productActions.prefillFromScrape(result.products);
    } else {
      // Manual-entry fallback: explain, then drop into edit with one blank product.
      setScrapeNote(result.reason);
      if (products.length === 0) productActions.addProduct(blankProduct());
    }
    setPhase('edit');
  };

  const enterManually = () => {
    if (products.length === 0) productActions.addProduct(blankProduct());
    setPhase('edit');
  };

  const finish = () => productActions.completeOnboarding();

  return (
    <div className="overlay-shell ob-shell" data-tauri-drag-region ref={shellRef}>
      <div className="rail" data-tauri-drag-region>
        <span className="rail-brand" data-tauri-drag-region>
          <span className="rail-dot" data-tauri-drag-region />
          Pitch Genius
        </span>
        <span className="ob-step-hint" data-tauri-drag-region>
          Set up
        </span>
      </div>

      {phase === 'url' && (
        <div className="ob-body">
          <h2 className="ob-title">Tell us what you sell</h2>
          <p className="ob-sub">
            Paste your website and we'll learn your products — it grounds the live coaching to what
            you actually sell.
          </p>
          <input
            className="ob-input"
            type="url"
            inputMode="url"
            placeholder="yourcompany.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runScrape()}
          />
          <button type="button" className="ob-cta" onClick={runScrape} disabled={!url.trim()}>
            Read my site
          </button>
          <div className="ob-secondary-row">
            <button type="button" className="ob-link" onClick={enterManually}>
              Enter manually instead
            </button>
            <button type="button" className="ob-link" onClick={finish}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {phase === 'scraping' && (
        <div className="ob-body ob-scraping">
          <span className="ob-spinner" />
          <p className="ob-scrape-note">{FAKE_SCRAPE_STEPS[stepIdx]}</p>
        </div>
      )}

      {phase === 'edit' && (
        <div className="ob-body">
          <h2 className="ob-title">Review what you sell</h2>
          <p className="ob-sub">
            {scrapeNote ??
              "Edit anything that's off, and add any other products you sell. No need to pick one for the call — we match it live."}
          </p>

          <div className="ob-products">
            {products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                index={i}
                onRemove={() => productActions.removeProduct(p.id)}
              />
            ))}
            {products.length === 0 && (
              <p className="ob-empty">No products yet — add one, or skip and coach product-neutral.</p>
            )}
          </div>

          <button
            type="button"
            className="ob-add"
            onClick={() => productActions.addProduct(blankProduct())}
          >
            + Add another product
          </button>

          <div className="ob-footer">
            <button type="button" className="ob-link" onClick={finish}>
              Skip for now
            </button>
            <button type="button" className="ob-cta ob-cta--inline" onClick={finish}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
