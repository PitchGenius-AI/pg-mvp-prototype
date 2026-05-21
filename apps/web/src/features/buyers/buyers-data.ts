import type { BuyerRow } from '../../mock/buyer-rows';
import type { MockBuyer } from '../../mock/types';
import type { BuyersSearchParams } from './buyers-search';

export type { BuyerRow };

// Buyer display name — "First Last", or just "First" when no last name.
export const buyerFullName = (buyer: MockBuyer): string =>
  [buyer.firstName, buyer.lastName].filter(Boolean).join(' ');

// Apply the status filter + free-text search to the directory rows. Search
// matches name and company (PG-205) — not title/email, which a rep is unlikely
// to search a people directory by.
export function filterBuyerRows(rows: BuyerRow[], params: BuyersSearchParams): BuyerRow[] {
  let result = rows;

  if (params.status && params.status !== 'all') {
    result = result.filter((r) => r.status === params.status);
  }

  const query = params.q?.trim().toLowerCase();
  if (query) {
    result = result.filter((r) => {
      const haystack = `${buyerFullName(r.buyer)} ${r.buyer.company}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  return result;
}
