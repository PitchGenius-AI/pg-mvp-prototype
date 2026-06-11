import { z } from 'zod';

// Output contract for the website-scrape extraction chain (M30). The onboarding
// flow pastes a URL; the server fetches the page and Claude extracts the seller's
// industry, products, target customer, and core problem to pre-fill onboarding.

export const websiteProductSchema = z.object({
  name: z.string().describe('Product or service name'),
  description: z.string().describe('One-sentence description of what it does'),
});
export type WebsiteProduct = z.infer<typeof websiteProductSchema>;

export const websiteExtractionSchema = z.object({
  industry: z.string().describe('The industry / market the company operates in'),
  products: z
    .array(websiteProductSchema)
    .describe('The products or services the company sells (best-effort from the page)'),
  targetCustomer: z.string().describe('Who the company sells to — the ideal customer profile'),
  coreProblem: z.string().describe('The core problem the company solves for that customer'),
});
export type WebsiteExtraction = z.infer<typeof websiteExtractionSchema>;
