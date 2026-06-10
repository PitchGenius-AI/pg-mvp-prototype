import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { SellerProduct, SellerProductContext } from '@pg/shared';

// The desktop Co-pilot's shared mock store (M24 / PG-282).
//
// Holds the seller's product / ICP / problem context (UX_SPEC §4.6, §6.3) —
// captured at onboarding, editable in-app, persisted to localStorage so it
// survives reloads. This is the desktop half of the "shared mock store" the spec
// (§11) describes: once the embedded companion web app lands (one Tauri process,
// one store), this unifies with apps/web's mock store. Until then the desktop
// keeps its own slice; the SellerProductContext shape is the bridge.
//
// The active product for a call is NOT held here — it is inferred + confirmed
// live (§5.3, PG-286) and belongs to call/session state, not this static
// "what I sell" context.

const newId = (prefix: string) =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(
    /-/g,
    '',
  )}`;

// Fields the seller edits — id + isPrimary are managed by the store.
type ProductInput = Omit<SellerProduct, 'id' | 'isPrimary'> & Partial<Pick<SellerProduct, 'isPrimary'>>;

interface ProductState {
  // The seller's product context. Mirrors SellerProductContext.products; an
  // empty array is valid (the product step is fully skippable — 2026-06-10).
  products: SellerProduct[];
  // Whether the first-run onboarding has been completed/dismissed. Drives the
  // App.tsx routing flip (onboarding vs. overlay). Set once the seller finishes
  // or skips onboarding — NOT gated on having ≥1 product.
  onboardingComplete: boolean;
}

interface ProductActions {
  // Add one product. Honors an explicit isPrimary, demoting any current primary;
  // otherwise the product is non-primary (no product is primary by default at
  // onboarding — one emerges over time, §4.6).
  addProduct: (input: ProductInput) => SellerProduct;
  updateProduct: (
    id: string,
    patch: Partial<Pick<SellerProduct, 'name' | 'description' | 'icp' | 'problem' | 'sourceUrl'>>,
  ) => void;
  removeProduct: (id: string) => void;
  // Promote one product to primary, demoting the rest (mirrors the web store's
  // setPrimaryProduct single-primary invariant).
  setPrimary: (id: string) => void;
  // Replace the whole product list from a (mocked) website scrape — PG-281.
  // Every scraped product starts non-primary and carries the source URL.
  prefillFromScrape: (products: SellerProduct[]) => void;
  // Mark first-run onboarding finished or skipped.
  completeOnboarding: () => void;
  // Wipe everything (dev / "start over").
  reset: () => void;
}

const demoteAll = (products: SellerProduct[]): SellerProduct[] =>
  products.map((p) => (p.isPrimary ? { ...p, isPrimary: false } : p));

export const useProductStore = create<ProductState & ProductActions>()(
  persist(
    (set, get) => ({
      products: [],
      onboardingComplete: false,

      addProduct: (input) => {
        const isPrimary = input.isPrimary ?? false;
        const product: SellerProduct = {
          id: newId('sprod'),
          name: input.name,
          description: input.description,
          icp: input.icp,
          problem: input.problem,
          sourceUrl: input.sourceUrl ?? null,
          isPrimary,
        };
        set((state) => ({
          products: [...(isPrimary ? demoteAll(state.products) : state.products), product],
        }));
        return product;
      },

      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removeProduct: (id) =>
        set((state) => ({ products: state.products.filter((p) => p.id !== id) })),

      setPrimary: (id) =>
        set((state) => ({
          products: state.products.map((p) => ({ ...p, isPrimary: p.id === id })),
        })),

      prefillFromScrape: (products) =>
        set(() => ({
          // Scrape results replace the list wholesale; none primary (§4.6).
          products: products.map((p) => ({ ...p, isPrimary: false })),
        })),

      completeOnboarding: () => set(() => ({ onboardingComplete: true })),

      reset: () => set(() => ({ products: [], onboardingComplete: false })),
    }),
    { name: 'pg-copilot-product-context' },
  ),
);

// The store's products as the canonical SellerProductContext shape — the value
// handed to the Rust planner at start_call (PG-284/286).
export const useSellerProductContext = (): SellerProductContext =>
  useProductStore(useShallow((s) => ({ products: s.products })));

export const useProducts = () => useProductStore(useShallow((s) => s.products));

export const useOnboardingComplete = () => useProductStore((s) => s.onboardingComplete);

// Stable action accessors (safe outside React, e.g. when invoking start_call).
export const productActions = {
  addProduct: (input: ProductInput) => useProductStore.getState().addProduct(input),
  updateProduct: (id: string, patch: Parameters<ProductActions['updateProduct']>[1]) =>
    useProductStore.getState().updateProduct(id, patch),
  removeProduct: (id: string) => useProductStore.getState().removeProduct(id),
  setPrimary: (id: string) => useProductStore.getState().setPrimary(id),
  prefillFromScrape: (products: SellerProduct[]) =>
    useProductStore.getState().prefillFromScrape(products),
  completeOnboarding: () => useProductStore.getState().completeOnboarding(),
  reset: () => useProductStore.getState().reset(),
  // Snapshot the current context for a non-React caller (the start_call payload).
  context: (): SellerProductContext => ({ products: useProductStore.getState().products }),
};
