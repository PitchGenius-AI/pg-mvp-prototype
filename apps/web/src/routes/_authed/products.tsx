import { createFileRoute } from '@tanstack/react-router';
import { ProductsPage } from '../../features/products';

// The Products management page (M16, PG-219) — the post-onboarding home for the
// workspace's products. Add, edit, and set-primary; no deletion in MVP.
export const Route = createFileRoute('/_authed/products')({
  component: ProductsPage,
});
